/**
 * Door registry.
 *
 * Doors are the unit of tactical decision-making in this game, so they are
 * real objects: id, hinge side, swing, lock state, material, integrity and an
 * animated leaf that actually blocks the doorway while it is closed. The
 * navmesh deliberately ignores door leaves, so a path always routes *through*
 * a doorway; whether the door is open, locked or has to be breached is a
 * behaviour question, not a pathing one.
 */

import * as THREE from 'three';
import { bus } from '../core/events';
import { Brickyard } from './brickyard';
import type { DoorRig } from './builder';
import type { WorldDoor, DoorState } from './types';

export class DoorRegistry {
  private byId = new Map<number, DoorRig>();
  private animating: DoorRig[] = [];

  constructor(private yard: Brickyard, rigs: DoorRig[]) {
    for (const r of rigs) {
      this.byId.set(r.door.id, r);
      // Apply the authored initial state to the leaf transform.
      this.applyTransform(r);
      if (r.door.openAmount !== r.door.targetOpen) this.animating.push(r);
    }
  }

  get all(): WorldDoor[] {
    return [...this.byId.values()].map((r) => r.door);
  }

  get count(): number {
    return this.byId.size;
  }

  get(id: number): WorldDoor | undefined {
    return this.byId.get(id)?.door;
  }

  /** Nearest door within `radius` — the interaction prompt uses this. */
  nearest(p: THREE.Vector3, radius = 2.2): WorldDoor | null {
    let best: WorldDoor | null = null;
    let bestD = radius * radius;
    for (const r of this.byId.values()) {
      const d = r.door;
      const dx = d.x - p.x, dy = d.y + d.height / 2 - p.y, dz = d.z - p.z;
      const dist = dx * dx + dy * dy * 0.25 + dz * dz;
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  /** Doors bordering a room. */
  forRoom(roomId: number): WorldDoor[] {
    const out: WorldDoor[] = [];
    for (const r of this.byId.values()) {
      if (r.door.roomA === roomId || r.door.roomB === roomId) out.push(r.door);
    }
    return out;
  }

  /**
   * Open a door. `fast` marks a kick/shoulder entry — three times the speed
   * and audible much further, which the audio and AI systems key off.
   */
  open(id: number, byActorId = -1, fast = false): boolean {
    const rig = this.byId.get(id);
    if (!rig) return false;
    const d = rig.door;
    if (d.locked && !d.destroyed) {
      bus.emit('door:locked', { doorId: id });
      return false;
    }
    if (d.targetOpen >= 1) return true;
    d.targetOpen = 1;
    d.speed = fast ? 7.5 : 2.4;
    d.state = 'open';
    this.queue(rig);
    bus.emit('door:opened', { doorId: id, fast, byActorId });
    return true;
  }

  close(id: number, byActorId = -1): boolean {
    const rig = this.byId.get(id);
    if (!rig || rig.door.destroyed) return false;
    const d = rig.door;
    if (d.targetOpen <= 0) return true;
    d.targetOpen = 0;
    d.speed = 2.4;
    d.state = 'closed';
    this.queue(rig);
    bus.emit('door:closed', { doorId: id, byActorId });
    return true;
  }

  toggle(id: number, byActorId = -1, fast = false): boolean {
    const d = this.get(id);
    if (!d) return false;
    return d.targetOpen > 0.5 ? this.close(id, byActorId) : this.open(id, byActorId, fast);
  }

  setLocked(id: number, locked: boolean): void {
    const d = this.get(id);
    if (!d || d.destroyed) return;
    d.locked = locked;
    if (locked && d.targetOpen > 0) this.close(id);
    d.state = locked ? 'locked' : d.openAmount > 0.5 ? 'open' : 'closed';
  }

  /**
   * Breaching. Charges and shotguns take the leaf off its hinges; a kick just
   * defeats the lock. A destroyed leaf is sunk out of the doorway so the
   * opening is permanently clear.
   */
  breach(id: number, method: string, damage = 1): boolean {
    const rig = this.byId.get(id);
    if (!rig) return false;
    const d = rig.door;
    if (d.destroyed) return true;
    if (!d.breachable) return false;
    bus.emit('breach:started', { doorId: id, method });
    d.integrity = Math.max(0, d.integrity - damage);
    if (d.integrity > 0) {
      // Partial: the lock gives but the leaf survives.
      d.locked = false;
      return false;
    }
    d.destroyed = true;
    d.locked = false;
    d.state = 'open';
    d.targetOpen = 1;
    d.openAmount = 1;
    // Drop the leaf below the floor: cheaper than a separate destroyed mesh and
    // it keeps the doorway genuinely clear for collision and line of sight.
    this.yard.setTransform(rig.brick, rig.hingeX, -60, rig.hingeZ, rig.baseYaw);
    bus.emit('breach:completed', {
      doorId: id, method, position: new THREE.Vector3(d.x, d.y + d.height / 2, d.z),
    });
    bus.emit('door:opened', { doorId: id, fast: true, byActorId: -1 });
    return true;
  }

  /** True when the doorway is clear enough for an agent to walk through. */
  isPassable(id: number): boolean {
    const d = this.get(id);
    if (!d) return false;
    return d.destroyed || (!d.locked && d.openAmount > 0.6);
  }

  stateOf(id: number): DoorState | null {
    return this.get(id)?.state ?? null;
  }

  private queue(rig: DoorRig): void {
    if (!this.animating.includes(rig)) this.animating.push(rig);
  }

  update(dt: number): void {
    for (let i = this.animating.length - 1; i >= 0; i--) {
      const rig = this.animating[i];
      const d = rig.door;
      if (d.destroyed) { this.animating.splice(i, 1); continue; }
      const dir = Math.sign(d.targetOpen - d.openAmount);
      d.openAmount += dir * d.speed * dt;
      if ((dir > 0 && d.openAmount >= d.targetOpen) || (dir < 0 && d.openAmount <= d.targetOpen)) {
        d.openAmount = d.targetOpen;
        this.animating.splice(i, 1);
      }
      this.applyTransform(rig);
    }
  }

  private applyTransform(rig: DoorRig): void {
    const d = rig.door;
    if (d.destroyed) return;
    if (rig.maxAngle === 0) {
      // Sliding gate: translate the leaf along the wall instead of swinging.
      const slide = d.openAmount * rig.leafLen;
      this.yard.setTransform(
        rig.brick,
        rig.hingeX + rig.ux * (rig.leafLen / 2 + slide),
        rig.centerY,
        rig.hingeZ + rig.uz * (rig.leafLen / 2 + slide),
        rig.baseYaw,
      );
      return;
    }
    // Ease-out so the leaf settles rather than snapping.
    const a = d.openAmount;
    const eased = a * a * (3 - 2 * a);
    const theta = eased * rig.maxAngle;
    const c = Math.cos(theta), s = Math.sin(theta);
    const ux = c * rig.ux + s * rig.uz;
    const uz = -s * rig.ux + c * rig.uz;
    this.yard.setTransform(
      rig.brick,
      rig.hingeX + ux * (rig.leafLen / 2),
      rig.centerY,
      rig.hingeZ + uz * (rig.leafLen / 2),
      rig.baseYaw + theta,
    );
  }
}
