// The play library and playbooks. Every play belongs to a formation (its set): the set
// decides the personnel on the field and where everyone lines up; the play art and the
// call decide what the sim runs. Playbooks are folders of plays, one folder per set,
// and the user can build their own: rename, add and remove plays, draw new ones, and
// choose who plays which spot in each set (formation subs).
import type { League, CustomPlay, CustomDefPlay, Playbook } from '../core/types';
import type { DefCall, DefSet, OffCall, Personnel } from '../sim/game';
import { bookOf, teamDefBook, TEAM_PLAYS, TEAM_DEFS } from './teamplays';
import { PLAY_ART, DEF_ART, PLAY_ALIGN, FORMATION, block, olPush, type Art, type Align } from './playart';

// ---- formations ---------------------------------------------------------------------------
export interface OffSetDef { label: string; pers: Personnel; align: Align; note: string }
const A = (o: Partial<Align>): Align => ({ ...FORMATION, ...o });
export const OFF_SETS: Record<string, OffSetDef> = {
  Shotgun: { label: 'Shotgun Trips', pers: '11', align: A({}), note: '11 personnel · 3 WR, 1 TE, 1 RB' },
  'Gun Doubles': { label: 'Gun Doubles', pers: '11', align: A({ S: [-1, -11], RB: [-5, -2] }), note: '11 personnel · two receivers each side' },
  Singleback: { label: 'Singleback Ace', pers: '12', align: A({ QB: [-1, 0], RB: [-7, 0], S: [0, -4.5] }), note: '12 personnel · 2 TE, under center' },
  'I-Form': { label: 'I-Form Pro', pers: '21', align: A({ QB: [-1, 0], S: [-4, 0], RB: [-7, 0] }), note: '21 personnel · fullback leads the way' },
  Pistol: { label: 'Pistol', pers: '11', align: A({ QB: [-4, 0], RB: [-7, 0] }), note: '11 personnel · back behind the quarterback' },
  Empty: { label: 'Empty Bunch', pers: '10', align: A({ RB: [-1, -12], TE: [-1, 8], S: [-1, 13] }), note: '10 personnel · five out, nobody in the backfield' },
  'Gun Bunch': { label: 'Gun Bunch', pers: '11', align: A({ Z: [0, 13], S: [-1, 11.5], TE: [-1.5, 14.5] }), note: '11 personnel · three receivers stacked tight' },
  'Pistol Wing': { label: 'Pistol Wing', pers: '12', align: A({ QB: [-4, 0], RB: [-7, 0], S: [-1, -6], Z: [0, 16] }), note: '12 personnel · wing tight end off the edge' },
  'Goal Line': { label: 'Goal Line', pers: '22', align: A({ QB: [-1, 0], RB: [-7, 0], S: [-4, 0], Z: [0, -4.5], X: [0, -14] }), note: '22 personnel · 2 TE, fullback, heavy' },
};
export const DEF_SETS: Record<DefSet, { label: string; note: string }> = {
  Base: { label: '4-3 Base', note: '4 DL, 3 LB, 2 CB, 2 S · stops the run' },
  Nickel: { label: 'Nickel 4-2-5', note: 'A third corner for the slot' },
  Dime: { label: 'Dime 4-1-6', note: 'Six defensive backs · obvious passing downs' },
  'Goal Line': { label: 'Goal Line 6-3', note: 'Everyone in the box' },
};

// ---- the library ---------------------------------------------------------------------------
export interface LibOff { name: string; set: string; icon: string; desc: string; call: OffCall; /** Second install: added on top of each team's original book. */ extra?: boolean }
export interface LibDef { name: string; set: DefSet; desc: string; call: Omit<DefCall, 'box'> & { box?: number }; extra?: boolean }
const r = (who: Art['who'], pts: [number, number][], primary?: boolean, motion?: [number, number][]): Art => ({ who, pts, kind: 'route', primary, motion });
const run = (who: Art['who'], pts: [number, number][], primary = true): Art => ({ who, pts, kind: 'run', primary });

function off(name: string, set: string, icon: string, desc: string, call: Omit<OffCall, 'name'>, art: Art[]): LibOff {
  PLAY_ART[name] = art;
  if (set !== 'Shotgun') PLAY_ALIGN[name] = OFF_SETS[set].align;
  return { name, set, icon, desc, call: { ...call, name, pers: OFF_SETS[set].pers } };
}
const pass = olPush(-1.2, 0), runL = olPush(2.5, 0);

export const OFF_LIB: LibOff[] = [
  // Shotgun (the classic eight keep their art from playart.tsx)
  { name: 'Inside Zone', set: 'Shotgun', icon: '⬆', desc: 'Downhill between the tackles', call: { kind: 'run', run: 'inside', name: 'Inside Zone', pers: '11' } },
  { name: 'Outside Zone', set: 'Shotgun', icon: '↗', desc: 'Stretch the edge, cut back', call: { kind: 'run', run: 'outside', name: 'Outside Zone', pers: '11' } },
  { name: 'QB Keep', set: 'Shotgun', icon: '⚡', desc: 'Designed quarterback run', call: { kind: 'run', run: 'qb', name: 'QB Keep', pers: '11' } },
  { name: 'Quick Slants', set: 'Shotgun', icon: '↘', desc: 'Ball out fast, beats the blitz', call: { kind: 'pass', depth: 'quick', name: 'Quick Slants', pers: '11', primary: 'X' } },
  { name: 'Curl Flat', set: 'Shotgun', icon: '↩', desc: 'Short, high-percentage', call: { kind: 'pass', depth: 'short', name: 'Curl Flat', pers: '11', primary: 'X' } },
  { name: 'Dig', set: 'Shotgun', icon: '→', desc: 'Intermediate in-breakers', call: { kind: 'pass', depth: 'medium', name: 'Dig', pers: '11', primary: 'X' } },
  { name: 'Four Verticals', set: 'Shotgun', icon: '⇈', desc: 'Take a shot downfield', call: { kind: 'pass', depth: 'deep', name: 'Four Verticals', pers: '11', primary: 'X' } },
  { name: 'Screen', set: 'Shotgun', icon: '⤺', desc: 'Let the rush come, dump it off', call: { kind: 'pass', depth: 'screen', name: 'Screen', pers: '11', primary: 'RB' } },
  off('Mesh', 'Shotgun', '⨯', 'Two shallow crossers rub man coverage', { kind: 'pass', depth: 'short', primary: 'SLOT' },
    [r('S', [[2, 11], [3, -6]], true), r('TE', [[3, 4.5], [3, 12]]), r('X', [[12, -19], [12, -12]]), r('Z', [[18, 19], [22, 12]]), r('RB', [[-4, -5], [2, -10]]), ...pass]),
  off('Smash', 'Shotgun', '⌐', 'Hitch underneath, corner over the top', { kind: 'pass', depth: 'medium', primary: 'SLOT' },
    [r('S', [[10, 11], [16, 18]], true), r('Z', [[5, 19], [4, 18]]), r('X', [[5, -19], [4, -18]]), r('TE', [[8, 4.5], [14, 0]]), block('RB', -1, 1.5), ...pass]),
  off('Stick', 'Shotgun', '┤', 'Tight end sits down at six yards', { kind: 'pass', depth: 'quick', primary: 'TE' },
    [r('TE', [[6, 4.5], [6, 3]], true), r('S', [[2, 11], [3, 18]]), r('Z', [[16, 19]]), r('X', [[6, -19], [6, -16]]), block('RB', -1, -1.5), ...pass]),
  off('Corner Post', 'Shotgun', '⟋', 'Double move to the middle of the field', { kind: 'pass', depth: 'deep', primary: 'Z' },
    [r('Z', [[10, 19], [14, 23], [24, 12]], true), r('S', [[12, 11], [18, 4]]), r('X', [[14, -19], [22, -12]]), r('TE', [[5, 4.5], [5, 9]]), block('RB', -1, 1.5), ...olPush(-2, 0)]),
  off('Bubble Screen', 'Shotgun', '◠', 'Slot flares out behind two blockers', { kind: 'pass', depth: 'screen', primary: 'SLOT' },
    [r('S', [[-2, 14], [3, 18]], true), block('Z', 2, -2), block('TE', 2, 5), r('X', [[10, -19]]), block('RB', -1, 1.5), ...olPush(-1, 0)]),
  off('HB Draw', 'Shotgun', '⬍', 'Show pass, hand it off late', { kind: 'run', run: 'inside' },
    [...olPush(-1, 0), run('RB', [[-5, 0.5], [0, 0.5], [7, 1]]), r('X', [[10, -19]], false), r('Z', [[10, 19]], false), block('S', 3), block('TE', 2)]),
  off('HB Wheel', 'Shotgun', '⤴', 'Back up the sideline against a linebacker', { kind: 'pass', depth: 'medium', primary: 'RB' },
    [r('RB', [[-4, -6], [2, -14], [16, -16]], true), r('X', [[10, -19], [8, -12]]), r('S', [[14, 11], [20, 4]]), r('Z', [[12, 19], [12, 14]]), block('TE', -1), ...pass]),
  // Gun Doubles
  off('Spacing', 'Gun Doubles', '⋯', 'Five underneath routes stretch the zone', { kind: 'pass', depth: 'quick', primary: 'SLOT' },
    [r('S', [[5, -11], [5, -8]], true), r('X', [[5, -19], [5, -17]]), r('Z', [[5, 19], [5, 17]]), r('TE', [[5, 4.5], [5, 2]]), r('RB', [[-5, -6], [0, -12]]), ...pass]),
  off('Levels', 'Gun Doubles', '≡', 'Two in-breakers at different depths', { kind: 'pass', depth: 'medium', primary: 'X' },
    [r('X', [[13, -19], [13, -3]], true), r('S', [[5, -11], [5, 0]]), r('Z', [[18, 19]]), r('TE', [[9, 4.5], [9, 12]]), block('RB', -1, -1), ...pass]),
  off('Slot Fade', 'Gun Doubles', '⇗', 'Back-shoulder shot from the slot', { kind: 'pass', depth: 'deep', primary: 'SLOT' },
    [r('S', [[24, -15]], true), r('X', [[12, -19], [10, -17]]), r('Z', [[12, 19], [10, 17]]), r('TE', [[8, 4.5], [8, 0]]), block('RB', -1, -1), ...olPush(-2, 0)]),
  // Singleback (12)
  off('Power', 'Singleback', '⬆', 'Gap scheme: the backside guard pulls', { kind: 'run', run: 'inside' },
    [...olPush(2.5, 1), { who: 'OL', pts: [[-1, -2], [1, 3.5]], kind: 'block' }, run('RB', [[-3, 1], [3, 3], [9, 4]]), block('TE', 2, 1), block('S', 2, -1), block('X', 3), block('Z', 3)]),
  off('Counter', 'Singleback', '↶', 'Step one way, cut back the other', { kind: 'run', run: 'outside' },
    [...olPush(2.5, -1), run('RB', [[-7, 2], [-3, -3], [3, -6], [8, -7]]), block('S', 2, -2), block('TE', 1.5, -3), block('X', 3), block('Z', 3)]),
  off('Y-Cross', 'Singleback', '⤫', 'Tight end crosses the whole field', { kind: 'pass', depth: 'medium', primary: 'TE' },
    [r('TE', [[8, 4.5], [14, -16]], true), r('S', [[3, -4.5], [3, -10]]), r('X', [[18, -19]]), r('Z', [[12, 19], [16, 12]]), block('RB', -2, 1), ...pass]),
  off('PA Boot', 'Singleback', '↪', 'Fake the run, roll out to the flat', { kind: 'pass', depth: 'short', primary: 'TE', pa: true },
    [{ who: 'RB', pts: [[-4, -2], [-2, -4]], kind: 'run' }, r('TE', [[2, 4.5], [4, 14]], true), r('S', [[8, -4.5], [12, 8]]), r('Z', [[16, 19], [20, 14]]), r('X', [[14, -19], [16, -10]]), ...olPush(1.5, -1)]),
  off('TE Seam', 'Singleback', '‖', 'Both tight ends up the seams', { kind: 'pass', depth: 'medium', primary: 'TE' },
    [r('TE', [[18, 6]], true), r('S', [[18, -6]]), r('X', [[10, -19], [8, -17]]), r('Z', [[10, 19], [8, 17]]), block('RB', -2, 0), ...olPush(-1.5, 0)]),
  // I-Form (21)
  off('Iso', 'I-Form', '▮', 'Fullback isolates on the linebacker', { kind: 'run', run: 'inside' },
    [...runL, block('S', 4, 1), run('RB', [[-3, 0.5], [3, 1], [8, 1]]), block('TE', 2), block('X', 3), block('Z', 3)]),
  off('Toss', 'I-Form', '⟿', 'Pitch it wide and race the edge', { kind: 'run', run: 'outside' },
    [...olPush(2, 3), block('S', 1, 6), run('RB', [[-6, 6], [-2, 12], [6, 14]]), block('TE', 1.5, 3), block('X', 3, 2), block('Z', 3, -2)]),
  off('PA Deep Post', 'I-Form', '⇡', 'Sell the run, throw over the top', { kind: 'pass', depth: 'deep', primary: 'X', pa: true },
    [{ who: 'RB', pts: [[-4, 0.5], [-2, 2]], kind: 'run' }, block('S', -1, 2), r('X', [[14, -19], [28, -6]], true), r('Z', [[12, 19], [10, 16]]), r('TE', [[6, 4.5], [10, 10]]), ...olPush(-1.5, 0)]),
  // Pistol
  off('Read Option', 'Pistol', '⇄', 'Quarterback reads the end and keeps or gives', { kind: 'run', run: 'qb' },
    [...olPush(2, -1), run('QB', [[-4, 4], [1, 8], [8, 10]]), { who: 'RB', pts: [[-4, -2], [2, -2]], kind: 'run', primary: false }, block('TE', 2, 1), block('S', 2), block('X', 3), block('Z', 3)]),
  off('Jet Sweep', 'Pistol', '⇉', 'Slot in jet motion takes it around the end', { kind: 'run', run: 'outside', motion: 'SLOT' },
    [...olPush(2, -3), { who: 'S', pts: [[-1, -4], [-1, -12], [6, -17]], kind: 'run', primary: true, motion: [[-1, 4]] }, block('RB', 1, -5), block('TE', 1.5, -2), block('X', 3, 2), block('Z', 3)]),
  off('RPO Slant', 'Pistol', '↘', 'Run look, ball out to the slant', { kind: 'pass', depth: 'quick', primary: 'X' },
    [r('X', [[3, -19], [7, -13]], true), { who: 'RB', pts: [[-4, 1], [0, 2]], kind: 'run' }, r('S', [[3, 11], [8, 11]]), r('Z', [[12, 19]]), block('TE', 2), ...olPush(1, 0)]),
  // Empty (10)
  off('Empty Mesh', 'Empty', '⨯', 'Five out, crossers underneath', { kind: 'pass', depth: 'short', primary: 'SLOT' },
    [r('S', [[2, 13], [3, -6]], true), r('TE', [[3, 8], [3, -12]]), r('RB', [[6, -12], [6, -6]]), r('X', [[14, -19], [18, -12]]), r('Z', [[14, 19], [18, 12]]), ...olPush(-1.6, 0)]),
  off('Empty Verts', 'Empty', '⇈', 'Five vertical routes', { kind: 'pass', depth: 'deep', primary: 'Z' },
    [r('Z', [[28, 19]], true), r('X', [[28, -19]]), r('S', [[26, 9]]), r('TE', [[26, 4]]), r('RB', [[8, -12], [7, -10]]), ...olPush(-2, 0)]),
  // ---- the deeper install: concepts most teams carry in some form ----
  off('Snag', 'Shotgun', '⌐', 'Slot sits under a corner route, back to the flat', { kind: 'pass', depth: 'short', primary: 'SLOT' },
    [r('S', [[5, 11], [5, 8]], true), r('Z', [[10, 19], [16, 22]]), r('TE', [[2, 4.5], [2, 12]]), r('X', [[12, -19], [10, -17]]), r('RB', [[-4, -5], [1, -12]]), ...pass]),
  off('Y-Option', 'Shotgun', '⊥', 'Tight end wins inside or out on the linebacker', { kind: 'pass', depth: 'short', primary: 'TE' },
    [r('TE', [[6, 4.5], [6, 1], [6, 7]], true), r('S', [[14, 11], [18, 16]]), r('Z', [[18, 19]]), r('X', [[10, -19], [10, -12]]), block('RB', -1, -1.5), ...pass]),
  off('Drive', 'Shotgun', '⇶', 'Shallow under a dig: high-low the linebacker', { kind: 'pass', depth: 'short', primary: 'SLOT' },
    [r('S', [[2, 11], [3, -8]], true), r('X', [[12, -19], [12, -2]]), r('Z', [[18, 19]]), r('TE', [[5, 4.5], [5, 10]]), block('RB', -1, 1.5), ...pass]),
  off('Sail', 'Shotgun', '◸', 'Three levels to the sideline: flat, out, go', { kind: 'pass', depth: 'medium', primary: 'SLOT' },
    [r('S', [[12, 11], [12, 19]], true), r('Z', [[24, 19]]), r('RB', [[-4, 4], [1, 16]]), r('X', [[14, -19], [14, -6]]), r('TE', [[6, 4.5], [6, 0]]), ...pass]),
  off('Mills', 'Shotgun', '⟆', 'Post over a dig, both from the same side', { kind: 'pass', depth: 'deep', primary: 'SLOT' },
    [r('S', [[12, 11], [24, 2]], true), r('Z', [[14, 19], [14, 8]]), r('X', [[20, -19]]), r('TE', [[5, 4.5], [5, 9]]), block('RB', -1, 1.5), ...olPush(-2, 0)]),
  off('Tunnel Screen', 'Shotgun', '⤽', 'Receiver comes inside behind a wall of linemen', { kind: 'pass', depth: 'screen', primary: 'X' },
    [r('X', [[-1, -17], [0, -12], [6, -10]], true), block('S', 2, -6), block('TE', 2, -2), r('Z', [[12, 19]]), ...olPush(2, -6)]),
  off('Shovel Option', 'Shotgun', '⇣', 'Quarterback flips it inside to the tight end', { kind: 'run', run: 'inside' },
    [...olPush(2, 2), { who: 'TE', pts: [[-2, 2], [-2, -1], [5, -1]], kind: 'run', primary: true }, { who: 'QB', pts: [[-4, 4]], kind: 'run' }, block('RB', 1, 4), block('X', 3), block('Z', 3), block('S', 3)]),
  off('Duo', 'Shotgun', '⬆', 'Double teams at the point, back reads the linebacker', { kind: 'run', run: 'inside' },
    [...olPush(3, 0), run('RB', [[-3, -0.5], [3, -1], [9, -1]]), block('TE', 3, -1), block('S', 3), block('X', 3), block('Z', 3)]),
  off('Trap', 'Shotgun', '⊢', 'Let the tackle in, kick him out with a pulling guard', { kind: 'run', run: 'inside' },
    [...olPush(2.5, 0), { who: 'OL', pts: [[-1, 2], [1, -1]], kind: 'block' }, run('RB', [[-3, 0], [4, 0], [9, 0]]), block('TE', 2), block('S', 3), block('X', 3), block('Z', 3)]),
  // Gun Doubles
  off('Hank', 'Gun Doubles', '∩', 'Curls outside, a hook in the middle', { kind: 'pass', depth: 'quick', primary: 'X' },
    [r('X', [[8, -19], [6, -18]], true), r('Z', [[8, 19], [6, 18]]), r('S', [[6, -11], [5, -6]]), r('TE', [[6, 4.5], [5, 1]]), r('RB', [[-4, -5], [1, -10]]), ...pass]),
  off('Double Post', 'Gun Doubles', '⋀', 'Two posts split the safeties', { kind: 'pass', depth: 'deep', primary: 'X' },
    [r('X', [[12, -19], [26, -8]], true), r('S', [[14, -11], [26, 2]]), r('Z', [[10, 19], [8, 17]]), r('TE', [[6, 4.5], [6, 9]]), block('RB', -1, 1), ...olPush(-2, 0)]),
  off('Dagger', 'Gun Doubles', '⟊', 'Slot clears the seam, outside dig behind it', { kind: 'pass', depth: 'medium', primary: 'X' },
    [r('X', [[15, -19], [15, -4]], true), r('S', [[24, -11]]), r('Z', [[6, 19], [6, 15]]), r('TE', [[8, 4.5], [8, 10]]), block('RB', -1, 1), ...pass]),
  off('RB Swing', 'Gun Doubles', '⤻', 'Back swings wide with the receivers blocking', { kind: 'pass', depth: 'screen', primary: 'RB' },
    [r('RB', [[-4, -8], [-2, -14], [5, -17]], true), block('X', 2, 1), block('S', 2, -2), r('Z', [[12, 19]]), r('TE', [[8, 4.5]]), ...pass]),
  // Gun Bunch
  off('Bunch Flood', 'Gun Bunch', '◹', 'Corner, out and flat from the bunch', { kind: 'pass', depth: 'medium', primary: 'SLOT' },
    [r('S', [[10, 11.5], [12, 19]], true), r('Z', [[14, 13], [22, 20]]), r('TE', [[2, 14.5], [3, 20]]), r('X', [[14, -19], [14, -8]]), block('RB', -1, -1.5), ...pass]),
  off('Bunch Snag', 'Gun Bunch', '⌗', 'Point man sits, the others spring corner and flat', { kind: 'pass', depth: 'quick', primary: 'TE' },
    [r('TE', [[5, 14.5], [5, 11]], true), r('Z', [[10, 13], [15, 20]]), r('S', [[1, 11.5], [2, 19]]), r('X', [[3, -19], [7, -14]]), block('RB', -1, -1.5), ...pass]),
  off('Bunch Screen', 'Gun Bunch', '◠', 'Two lead blockers, the third catches it', { kind: 'pass', depth: 'screen', primary: 'SLOT' },
    [r('S', [[-2, 13], [2, 17]], true), block('Z', 2, 2), block('TE', 2, 3), r('X', [[10, -19]]), block('RB', -1, 1.5), ...olPush(-1, 0)]),
  off('Bunch Verticals', 'Gun Bunch', '⇈', 'Everyone vertical out of the stack', { kind: 'pass', depth: 'deep', primary: 'Z' },
    [r('Z', [[26, 18]], true), r('S', [[26, 8]]), r('TE', [[12, 14.5], [14, 4]]), r('X', [[26, -19]]), block('RB', -1, -1), ...olPush(-2, 0)]),
  // Pistol
  off('Inverted Veer', 'Pistol', '⇋', 'Back sweeps outside, quarterback keeps inside', { kind: 'run', run: 'qb' },
    [...olPush(2.5, -1), run('QB', [[-3, 1], [3, 1], [9, 0]]), { who: 'RB', pts: [[-6, 4], [-3, 10]], kind: 'run', primary: false }, block('TE', 2, 2), block('S', 3), block('X', 3), block('Z', 3)]),
  off('Speed Option', 'Pistol', '⤳', 'Option the end man, pitch on the edge', { kind: 'run', run: 'outside' },
    [...olPush(2, 3), { who: 'QB', pts: [[-3, 5], [0, 8]], kind: 'run' }, run('RB', [[-6, 6], [-4, 12], [4, 15]]), block('TE', 1.5, 4), block('S', 3, 2), block('X', 3), block('Z', 3, -2)]),
  off('Bubble RPO', 'Pistol', '◠', 'Read the apex: hand off or throw the bubble', { kind: 'pass', depth: 'screen', primary: 'SLOT' },
    [r('S', [[-2, 14], [3, 18]], true), { who: 'RB', pts: [[-4, 1], [0, 2]], kind: 'run' }, block('Z', 2, -2), block('TE', 2), r('X', [[3, -19], [7, -14]]), ...olPush(2, 0)]),
  // Pistol Wing (12)
  off('Pin Pull Sweep', 'Pistol Wing', '⟿', 'Linemen pull and lead the back to the edge', { kind: 'run', run: 'outside' },
    [...olPush(1.5, 5), run('RB', [[-6, 5], [-2, 12], [6, 14]]), block('TE', 1.5, 4), block('S', 1, 2), block('Z', 3, -2), block('X', 3)]),
  off('Wing Counter', 'Pistol Wing', '↶', 'Guard and wing pull back across the formation', { kind: 'run', run: 'inside' },
    [...olPush(2.5, 1), { who: 'OL', pts: [[-1, -2], [1, 4]], kind: 'block' }, { who: 'S', pts: [[-1, 0], [1, 5]], kind: 'block' }, run('RB', [[-7, -2], [-3, 3], [7, 5]]), block('TE', 2, 1), block('X', 3), block('Z', 3)]),
  off('Wing Leak', 'Pistol Wing', '↪', 'Boot away, the wing leaks across late', { kind: 'pass', depth: 'medium', primary: 'TE', pa: true },
    [{ who: 'RB', pts: [[-5, 2], [-3, 5]], kind: 'run' }, r('S', [[2, -6], [8, 6], [16, 14]]), r('TE', [[4, 4.5], [6, -14]], true), r('X', [[18, -19]]), r('Z', [[14, 16], [16, 8]]), ...olPush(1.5, 1)]),
  // Singleback
  off('Texas', 'Singleback', '⌒', 'Back runs an angle route inside the linebacker', { kind: 'pass', depth: 'short', primary: 'RB' },
    [r('RB', [[-4, 4], [3, 2]], true), r('TE', [[14, 4.5], [18, 10]]), r('S', [[10, -4.5], [10, -12]]), r('X', [[16, -19]]), r('Z', [[12, 19], [10, 17]]), ...pass]),
  off('Scissors', 'Singleback', '✕', 'Post and corner cross over the top', { kind: 'pass', depth: 'deep', primary: 'Z' },
    [r('Z', [[12, 19], [24, 10]], true), r('TE', [[10, 4.5], [20, 16]]), r('S', [[6, -4.5], [6, -10]]), r('X', [[14, -19], [12, -17]]), block('RB', -2, 1), ...olPush(-2, 0)]),
  // I-Form
  off('Yankee', 'I-Form', '⤫', 'Max protect, two deep crossers off a hard fake', { kind: 'pass', depth: 'deep', primary: 'Z', pa: true },
    [{ who: 'RB', pts: [[-4, 0.5], [-2, 2]], kind: 'run' }, block('S', -1, -1), block('TE', -1, 3), r('Z', [[16, 19], [26, -4]], true), r('X', [[14, -19], [18, 2]]), ...olPush(-1.5, 0)]),
  off('Lead Draw', 'I-Form', '⬍', 'Fullback leads through the A gap on a delayed handoff', { kind: 'run', run: 'inside' },
    [...olPush(-1, 0), block('S', 4, -1), run('RB', [[-7, 0], [-2, -1], [7, -1]]), r('X', [[10, -19]], false), r('Z', [[10, 19]], false), block('TE', 2)]),
  // Goal Line (22)
  off('QB Sneak', 'Goal Line', '▲', 'Quarterback behind the center', { kind: 'run', run: 'qb' },
    [...olPush(1.5, 0), run('QB', [[1, 0], [2, 0]]), block('RB', 0, 0), block('S', 0, 0), block('TE', 1), block('Z', 1), block('X', 2)]),
  off('Goal Line Power', 'Goal Line', '⬆', 'Everybody blocks, back hits the hole', { kind: 'run', run: 'inside' },
    [...olPush(2, 1), block('S', 2, 2), run('RB', [[-3, 1], [1, 2.5], [4, 3]]), block('TE', 1.5, 1), block('Z', 1.5, -1), block('X', 2)]),
  off('PA Flat', 'Goal Line', '↗', 'Fake the dive, tight end leaks to the flat', { kind: 'pass', depth: 'quick', primary: 'TE', pa: true },
    [{ who: 'RB', pts: [[-3, 1], [-1, 2]], kind: 'run' }, r('TE', [[1, 6], [3, 12]], true), r('Z', [[4, -4.5], [6, 2]]), block('S', 0, 2), r('X', [[6, -14], [6, -10]]), ...olPush(0.5, 0)]),
  // ---- second install: pass concepts every team adds on top of its original book ----
  ...[
    off('Shallow Cross', 'Shotgun', '⟶', 'Split end drags under the linebackers, dig behind him', { kind: 'pass', depth: 'short', primary: 'X' },
      [r('X', [[2, -19], [3, 6]], true), r('Z', [[12, 19], [12, 8]]), r('S', [[18, 11]]), r('TE', [[5, 4.5], [5, 2]]), r('RB', [[-4, 5], [1, 14]]), ...pass]),
    off('Out and Up', 'Shotgun', '⌈', 'Sell the quick out, then go over the top', { kind: 'pass', depth: 'deep', primary: 'Z' },
      [r('Z', [[7, 19], [7, 21], [24, 21]], true), r('S', [[10, 11], [10, 4]]), r('X', [[6, -19], [5, -17]]), r('TE', [[12, 4.5], [18, 10]]), block('RB', -1, 1.5), ...olPush(-2, 0)]),
    off('Post Wheel', 'Gun Doubles', '⤒', 'Post clears the corner, slot wheels up the sideline', { kind: 'pass', depth: 'deep', primary: 'SLOT' },
      [r('S', [[3, -11], [6, -17], [24, -18]], true), r('X', [[12, -19], [24, -8]]), r('Z', [[6, 19], [5, 17]]), r('TE', [[6, 4.5], [6, 9]]), block('RB', -1, 1), ...olPush(-2, 0)]),
    off('Curl Seam', 'Gun Doubles', '⥾', 'Curls outside, seams split the safeties', { kind: 'pass', depth: 'medium', primary: 'X' },
      [r('X', [[11, -19], [9, -18]], true), r('S', [[20, -11]]), r('Z', [[11, 19], [9, 18]]), r('TE', [[18, 4.5]]), r('RB', [[-4, -5], [1, -12]]), ...pass]),
    off('Flanker Drive', 'Singleback', '⇢', 'Flanker drives across at five, tight ends clear it out', { kind: 'pass', depth: 'short', primary: 'Z' },
      [r('Z', [[3, 19], [5, -2]], true), r('TE', [[11, 4.5], [11, -8]]), r('S', [[16, -4.5], [22, -10]]), r('X', [[16, -19]]), block('RB', -2, 1), ...pass]),
    off('Trips Slant', 'Gun Bunch', '⟍', 'Point man slants inside, the stack breaks out', { kind: 'pass', depth: 'quick', primary: 'Z' },
      [r('Z', [[3, 13], [7, 6]], true), r('S', [[2, 11.5], [4, 19]]), r('TE', [[6, 14.5], [10, 18]]), r('X', [[3, -19], [7, -13]]), block('RB', -1, -1.5), ...pass]),
  ].map(p => ({ ...p, extra: true })),
];

// Play-action versions of every dropback pass: the back fakes the run first.
for (const p of OFF_LIB) if (p.call.kind === 'pass' && p.call.depth !== 'screen' && !p.call.pa && PLAY_ART[p.name] && !PLAY_ART[`PA ${p.name}`]) {
  PLAY_ART[`PA ${p.name}`] = [{ who: 'RB', pts: [[-3, 0.5], [-1, 2]], kind: 'run' }, ...PLAY_ART[p.name].filter(a => a.who !== 'RB')];
}

function dplay(name: string, set: DefSet, desc: string, call: LibDef['call'], art?: Art[]): LibDef {
  if (art) DEF_ART[name] = art;
  return { name, set, desc, call: { ...call, name, set } };
}
const Z = (x: number, y: number, rr: number): Art => ({ who: 'DEF', pts: [[x, y]], kind: 'zone', r: rr });
const BL = (pts: [number, number][]): Art => ({ who: 'DEF', pts, kind: 'blitz' });
const M = (y: number): Art => ({ who: 'DEF', pts: [[5, y], [1, y]], kind: 'man' });
export const DEF_LIB: LibDef[] = [
  dplay('Cover 2', 'Nickel', 'Two deep safeties, squat corners', { shell: 'Cover 2', blitz: false }),
  dplay('Cover 3', 'Nickel', 'Three deep, four under', { shell: 'Cover 3', blitz: false }),
  dplay('Cover 4', 'Nickel', 'Quarters: nothing over the top', { shell: 'Cover 4', blitz: false }),
  dplay('Cover 1 Man', 'Nickel', 'Man coverage, one robber', { shell: 'Cover 1', blitz: false }),
  dplay('Cover 1 Blitz', 'Nickel', 'Send five, man behind', { shell: 'Cover 1', blitz: true }),
  dplay('Cover 0 Blitz', 'Nickel', 'All-out pressure, no help', { shell: 'Cover 0', blitz: true }),
  dplay('Prevent', 'Dime', 'Keep everything in front', { shell: 'Prevent', blitz: false }),
  dplay('Tampa 2', 'Base', 'Mike runs the deep middle between two safeties', { shell: 'Cover 2', blitz: false },
    [Z(17, -13, 9), Z(17, 13, 9), Z(13, 0, 5), Z(5, -16, 4.5), Z(5, 16, 4.5), Z(5, -6, 4), Z(5, 6, 4)]),
  dplay('Cover 3 Sky', 'Base', 'Safety rolls down, three deep', { shell: 'Cover 3', blitz: false },
    [Z(18, -16, 7.5), Z(18, 0, 7.5), Z(18, 16, 7.5), Z(6, -14, 4.5), Z(6, -4, 4.5), Z(6, 5, 4.5), Z(6, 14, 4.5)]),
  dplay('Mike Blitz', 'Base', 'Middle linebacker shoots the A gap', { shell: 'Cover 1', blitz: true },
    [Z(20, 0, 9), M(-19), M(19), M(4.5), BL([[5, 0], [-3, 0]])]),
  dplay('Cover 3 Fire Zone', 'Nickel', 'Five rush, three deep, three under', { shell: 'Cover 3', blitz: true },
    [Z(18, -16, 7.5), Z(18, 0, 7.5), Z(18, 16, 7.5), Z(6, -9, 5), Z(6, 9, 5), BL([[5, -6], [-3, -2]])]),
  dplay('Cover 6', 'Nickel', 'Quarters to the strength, Cover 2 away', { shell: 'Cover 4', blitz: false },
    [Z(18, 8, 6), Z(18, 18, 6), Z(17, -13, 9), Z(5, -17, 4.5), Z(6, -6, 4.5), Z(6, 4, 4.5)]),
  dplay('Cover 2 Man', 'Nickel', 'Man underneath, two safeties over the top', { shell: 'Cover 2', blitz: false },
    [Z(18, -13, 9), Z(18, 13, 9), M(-19), M(19), M(11), M(4.5)]),
  dplay('Dime Cover 4', 'Dime', 'Six defensive backs, deep quarters', { shell: 'Cover 4', blitz: false },
    [Z(19, -18, 6), Z(19, -6, 6), Z(19, 6, 6), Z(19, 18, 6), Z(7, -10, 5), Z(7, 10, 5)]),
  dplay('Dime Blitz', 'Dime', 'A defensive back off the edge on third down', { shell: 'Cover 1', blitz: true },
    [Z(20, 0, 9), M(-19), M(19), M(11), BL([[6, -14], [-3, -4]])]),
  dplay('Goal Line 0', 'Goal Line', 'Everyone in the box, man on the rest', { shell: 'Cover 0', blitz: true, box: 9, rush: 7 },
    [M(-14), M(4.5), BL([[2, -2], [-2, -1]]), BL([[2, 2], [-2, 1]]), BL([[3, 0], [-2, 0]])]),
  dplay('Goal Line Zone', 'Goal Line', 'Squeeze the end zone, no gaps', { shell: 'Cover 2', blitz: false, box: 8 },
    [Z(6, -10, 5), Z(6, 0, 5), Z(6, 10, 5), Z(9, -6, 4), Z(9, 6, 4)]),
  // ---- second install: more pressure ----
  ...[
    dplay('Double A Gap', 'Nickel', 'Both linebackers walk up and shoot the A gaps', { shell: 'Cover 1', blitz: true, rush: 6 },
      [Z(20, 0, 9), M(-19), M(19), M(11), BL([[2, -2], [-3, -1]]), BL([[2, 2], [-3, 1]])]),
    dplay('Base Fire Zone', 'Base', 'Will linebacker off the edge, three deep behind it', { shell: 'Cover 3', blitz: true },
      [Z(18, -16, 7.5), Z(18, 0, 7.5), Z(18, 16, 7.5), Z(6, -6, 5), Z(6, 8, 5), BL([[5, -8], [-3, -5]])]),
    dplay('Zero Pressure', 'Nickel', 'Six rush, man everywhere, nobody deep', { shell: 'Cover 0', blitz: true, rush: 6 },
      [M(-19), M(19), M(11), M(4.5), BL([[3, -3], [-3, -1]]), BL([[3, 3], [-3, 1]])]),
    dplay('Overload', 'Base', 'Three rushers to one side: somebody comes free', { shell: 'Cover 1', blitz: true },
      [Z(20, 0, 9), M(-19), M(19), BL([[5, 5], [-3, 3]]), BL([[6, 9], [-3, 6]])]),
    dplay('Drop Eight', 'Nickel', 'Rush three, eight in coverage: no windows', { shell: 'Cover 3', blitz: false, rush: 3 },
      [Z(18, -16, 7.5), Z(18, 0, 7.5), Z(18, 16, 7.5), Z(6, -12, 4.5), Z(6, -4, 4.5), Z(6, 4, 4.5), Z(6, 12, 4.5), Z(4, 0, 3.5)]),
  ].map(p => ({ ...p, extra: true })),
];

// ---- custom plays --------------------------------------------------------------------------
/** A drawn defensive play: one assignment per defender. */
export const DEF_SPOTS: Record<CustomDefPlay['assigns'][number]['who'], [number, number]> = {
  DL0: [1, -5], DL1: [1, -1.7], DL2: [1, 1.7], DL3: [1, 5], LB0: [5, -3.5], LB1: [5, 3.5],
  CB0: [7, -18], CB1: [7, 18], NB: [6, 10], SS: [11, 6], FS: [13, -2],
};
export function defArt(p: CustomDefPlay): Art[] {
  const out: Art[] = [];
  for (const a of p.assigns) {
    const st = DEF_SPOTS[a.who];
    if (a.kind === 'zone' && a.pts[0]) out.push({ who: 'DEF', pts: [a.pts[0]], kind: 'zone', r: a.pts[0][0] >= 12 ? 8 : 4.5 });
    else if (a.kind === 'blitz' && a.pts.length) out.push({ who: 'DEF', pts: [st, ...a.pts], kind: 'blitz' });
    else if (a.kind === 'man' && a.pts[0]) out.push({ who: 'DEF', pts: [st, a.pts[0]], kind: 'man' });
  }
  return out;
}
/** What a drawn defense plays as in the sim: rushers, deep zones and man looks decide it. */
export function defCallFor(p: CustomDefPlay): DefCall {
  const rush = p.assigns.filter(a => a.kind === 'blitz' && !a.who.startsWith('DL')).length;
  const dl = 4 - p.assigns.filter(a => a.who.startsWith('DL') && a.kind !== 'blitz' && a.kind !== 'rush').length;
  const deep = p.assigns.filter(a => a.kind === 'zone' && (a.pts[0]?.[0] ?? 0) >= 12).length;
  const man = p.assigns.filter(a => a.kind === 'man').length;
  const shell: DefCall['shell'] = deep === 0 ? (rush > 0 || man >= 3 ? 'Cover 0' : 'Cover 2')
    : deep === 1 ? (man >= 2 ? 'Cover 1' : 'Cover 3') : deep === 2 ? 'Cover 2' : deep === 3 ? 'Cover 3' : deep >= 5 ? 'Prevent' : 'Cover 4';
  const box = Math.max(5, Math.min(9, dl + 2 + rush + (p.set === 'Goal Line' ? 2 : p.set === 'Base' ? 1 : 0)));
  return { shell, blitz: rush + dl >= 5, box, name: p.name, set: p.set };
}
export const defSummary = (p: CustomDefPlay) => { const c = defCallFor(p); return `Plays as ${c.shell}${c.blitz ? ', pressure' : ''} · ${c.box} in the box`; };

// ---- playbooks ---------------------------------------------------------------------------
const folder = (set: string, side: 'off' | 'def') => ({ name: side === 'off' ? OFF_SETS[set]?.label ?? set : DEF_SETS[set as DefSet]?.label ?? set, set, plays: (side === 'off' ? OFF_LIB : DEF_LIB).filter(p => p.set === set).map(p => p.name) });
export function defaultBooks(): Playbook[] {
  return [
    { id: 'pb-off', name: 'Franchise Offense', side: 'off', folders: Object.keys(OFF_SETS).map(s => folder(s, 'off')) },
    { id: 'pb-def', name: 'Franchise Defense', side: 'def', folders: (Object.keys(DEF_SETS) as DefSet[]).map(s => folder(s, 'def')) },
  ];
}
export function books(L: League): Playbook[] {
  if (!L.playbooks?.length) { L.playbooks = defaultBooks(); L.activeBook = { off: 'pb-off', def: 'pb-def' }; }
  // The team's own starting offense: its concepts, in its staff's terminology. Added once and made
  // active; the generic library book stays as a template.
  const me = L.teams[L.user];
  if (me) {
    const tb = bookOf(me);
    if (!L.playbooks.some(b => b.id === 'pb-team')) {
      const sets = [...new Set(tb.map(p => p.set))];
      L.playbooks.unshift({ id: 'pb-team', rev: 3, name: `${me.name} Offense`, side: 'off', folders: sets.map(set => ({ name: OFF_SETS[set]?.label ?? set, set, plays: tb.filter(p => p.set === set).map(p => p.name) })) });
      L.activeBook = { ...(L.activeBook ?? { def: 'pb-def' }), off: 'pb-team' } as typeof L.activeBook;
    }
    const db = teamDefBook(me);
    if (!L.playbooks.some(b => b.id === 'pb-team-def')) {
      L.playbooks.unshift({ id: 'pb-team-def', rev: 3, name: `${me.name} Defense`, side: 'def', folders: (Object.keys(DEF_SETS) as DefSet[]).map(set => ({ name: DEF_SETS[set].label, set, plays: db.filter(p => p.set === set).map(p => p.name) })) });
      L.activeBook = { ...L.activeBook, def: 'pb-team-def' };
    }
  }
  // Old saves: the team books get the second install once (new concepts, never re-adding cuts after).
  if (me) for (const [id, plays] of [['pb-team', bookOf(me)], ['pb-team-def', teamDefBook(me)]] as const) {
    const b = L.playbooks.find(x => x.id === id);
    if (!b || (b.rev ?? 0) >= 3) continue;
    const have = new Set(b.folders.flatMap(f => f.plays));
    for (const p of plays as { name: string; set: string; extra?: boolean }[]) {
      if (!p.extra || have.has(p.name)) continue;
      let f = b.folders.find(x => x.set === p.set);
      if (!f) b.folders.push(f = { name: (b.side === 'off' ? OFF_SETS[p.set]?.label : DEF_SETS[p.set as DefSet]?.label) ?? p.set, set: p.set, plays: [] });
      f.plays.push(p.name);
    }
    b.rev = 3;
  }
  // Drawn plays without a home go into a "My Plays" folder of the active book.
  const act = activeBook(L, 'off');
  const homed = new Set(L.playbooks.flatMap(b => b.folders.flatMap(f => f.plays)));
  const loose = (L.customPlays ?? []).filter(p => !homed.has(p.name)).map(p => p.name);
  if (loose.length && act) { let f = act.folders.find(x => x.name === 'My Plays'); if (!f) act.folders.push(f = { name: 'My Plays', set: 'Shotgun', plays: [] }); f.plays.push(...loose); }
  return L.playbooks;
}
export function activeBook(L: League, side: 'off' | 'def'): Playbook | undefined {
  const all = L.playbooks ?? [];
  return all.find(b => b.id === L.activeBook?.[side] && b.side === side) ?? all.find(b => b.side === side);
}
/** Look up any play by name: library, then the user's drawn plays. */
export function offPlay(L: League, name: string): { call: OffCall; desc: string; icon: string; set: string } | undefined {
  const lib = OFF_LIB.find(p => p.name === name) ?? TEAM_PLAYS.get(name);
  if (lib) return lib;
  const cp = L.customPlays?.find(p => p.name === name);
  return cp ? { call: { ...customCall(cp), pers: OFF_SETS[cp.set ?? 'Shotgun']?.pers ?? '11' }, desc: `Your ${cp.type} play`, icon: '✎', set: cp.set ?? 'Shotgun' } : undefined;
}
export function defPlay(L: League, name: string): { call: DefCall; desc: string; set: DefSet } | undefined {
  const lib = DEF_LIB.find(p => p.name === name) ?? TEAM_DEFS.get(name);
  if (lib) return { call: { ...lib.call, box: lib.call.box ?? (lib.call.shell === 'Prevent' ? 6 : lib.call.blitz ? 7 : lib.set === 'Base' ? 7 : 6) }, desc: lib.desc, set: lib.set };
  const cp = L.customDefPlays?.find(p => p.name === name);
  return cp ? { call: defCallFor(cp), desc: defSummary(cp), set: cp.set } : undefined;
}
let customCall: (p: CustomPlay) => OffCall = () => ({ kind: 'pass', depth: 'short' });
export const setCustomCall = (f: typeof customCall) => { customCall = f; };
/** The formation subs the user set for a set, as call subs. */
export const subsFor = (L: League, set: string) => L.formSubs?.[set];
