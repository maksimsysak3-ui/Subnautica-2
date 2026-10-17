// The contract between the game engine and the live play engine (src/ui/field/live.ts).
// The game engine hands over the situation, the call and every player's ratings; the live
// engine runs the play as 22 players moving in real time and reports what happened, plus the
// recording the field draws. Nothing here decides an outcome: that comes out of the play.
import type { PassDepth } from './game';

/** Field slots, the same names the renderer uses. */
export const OFF_SLOTS = ['OL0', 'OL1', 'OL2', 'OL3', 'OL4', 'QB', 'RB', 'X', 'Z', 'S', 'TE'] as const;
export const DEF_SLOTS = ['DL0', 'DL1', 'DL2', 'DL3', 'LB0', 'LB1', 'DB0', 'DB1', 'DB2', 'DB3', 'FS'] as const;
export type LiveSlot = typeof OFF_SLOTS[number] | typeof DEF_SLOTS[number];

/** Recorded actions: the animation draws these instead of guessing from motion. */
export const ACT = { stand: 0, run: 1, backpedal: 2, block: 3, fight: 4, down: 5, carry: 6, stance: 7 } as const;

export interface LiveCtx {
  seed: number;
  /** 1: the offense attacks toward x = 110 (home has the ball); -1 toward x = 10. */
  s: 1 | -1;
  yl: number; togo: number; down: number;
  kind: 'pass' | 'run';
  depth?: PassDepth; run?: 'inside' | 'outside' | 'qb'; pa?: boolean; call?: string;
  primary?: 'X' | 'Z' | 'SLOT' | 'TE' | 'RB';
  shell: string; dcall?: string; rush: number;
  /** Defenders in the box (6 light .. 8 loaded) on this call. */
  box: number;
  /** The front the call lines up in (4-3, 3-4, 3-3-5, Bear, ...). */
  front?: string;
  /** Rating 0..~105 for the player in a slot (fatigue, form, coaching already applied). */
  rate: (slot: LiveSlot, attr: string) => number;
  has: (slot: LiveSlot, ability: string) => boolean;
  ids: Partial<Record<LiveSlot, string>>;
  wind: number; wet: boolean;
  /** Late and trailing: carriers look for the sideline to stop the clock. */
  hurry: boolean;
}

/** The recording: positions at `hz` per second for each slot, the ball, who holds it. */
export interface LiveRec {
  hz: number; frames: number;
  slots: LiveSlot[];
  xs: Float32Array[]; ys: Float32Array[];
  /** Ball x, y, height per frame. */
  bx: Float32Array; by: Float32Array; bz: Float32Array;
  /** Index into `slots` of whoever has the ball (-1 in the air or loose). */
  hold: Int8Array;
  /** What each man is doing every frame (ACT_*), and which way he faces (1 or -1, along x). */
  acts: Uint8Array[]; faces: Int8Array[];
  throwF?: number; catchF?: number; endF: number; tackleF?: number; wrapF?: number;
  target?: number; tackler?: number; swatter?: number;
  breaks: { f: number; who: number; back: boolean }[];
  missed: { f: number; who: number }[];
  /** The carrier making a man miss: juke, spin or stiff-arm, and who he beat. */
  jukes: { f: number; who: number; kind: 'juke' | 'spin' | 'stiff' | 'jumpcut' }[];
  /** Rushers beating their blocker: the move, the rusher and the man he beat. */
  sheds: { f: number; rusher: number; blocker: number; kind: 'swim' | 'rip' | 'spinmove' }[];
}

export interface LiveResult {
  type: 'run' | 'pass' | 'sack' | 'scramble';
  /** Yards from the line of scrimmage to where the ball was dead (whole yards). */
  yards: number;
  air?: number; complete?: boolean; int?: boolean; td?: boolean; safety?: boolean; oob?: boolean;
  throwaway?: boolean; dropped?: boolean; defended?: boolean; hurried?: boolean;
  carrier?: LiveSlot; target?: LiveSlot; tackler?: LiveSlot; sacker?: LiveSlot; picker?: LiveSlot; swatter?: LiveSlot;
  /** Interception return yards (from the catch spot, toward the other goal). */
  ret?: number;
  dir: -1 | 0 | 1;
  rec: LiveRec;
}
