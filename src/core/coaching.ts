// The head coach's ability tree: six trees, three tiers each. Abilities are bought with
// coach points (one tier = one point, so a capstone costs three) and earned by levelling
// the coach. Every ability here is wired into the game: XP, the game sim, injuries,
// trades, fans and the owner. Effects only ever apply to the user's team.
import type { League } from './types';

export type CoachTreeName = 'Development' | 'Game Day' | 'Offense' | 'Defense' | 'Health' | 'Front Office';
export interface CoachAbility { id: string; tree: CoachTreeName; tier: 1 | 2 | 3; desc: string; effect: string; needs?: string }

export const COACH_TREES: CoachTreeName[] = ['Development', 'Game Day', 'Offense', 'Defense', 'Health', 'Front Office'];
export const TREE_INFO: Record<CoachTreeName, { color: string; glyph: string; blurb: string }> = {
  Development: { color: '#3fd07f', glyph: 'M12 3l7 7h-4v8H9v-8H5z', blurb: 'Faster growth for the whole roster.' },
  'Game Day': { color: '#f2c230', glyph: 'M13 2 4 14h6l-1 8 9-12h-6z', blurb: 'Sideline leadership when it counts.' },
  Offense: { color: '#ff7a45', glyph: 'M3 12c3-6 15-6 18 0-3 6-15 6-18 0zm6 0h6M10.5 10.5v3M13.5 10.5v3', blurb: 'Scheme edges with the ball.' },
  Defense: { color: '#ff4d6d', glyph: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z', blurb: 'Pressure, coverage, takeaways.' },
  Health: { color: '#4fb6ff', glyph: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', blurb: 'Keep your best players on the field.' },
  'Front Office': { color: '#c9a8ff', glyph: 'M4 7h16v12H4zm5-3h6v3H9z', blurb: 'Money, trades, fans and the owner.' },
};

export const COACH_ABILITIES: CoachAbility[] = [
  // Development
  { id: 'Mentor', tree: 'Development', tier: 1, desc: 'A teaching staff that gets more out of every rep.', effect: '+12% XP, whole roster' },
  { id: 'Rookie Camp', tree: 'Development', tier: 2, needs: 'Mentor', desc: 'First- and second-year players get extra installs and film work.', effect: '+15% XP, rookies' },
  { id: 'QB Whisperer', tree: 'Development', tier: 2, needs: 'Mentor', desc: 'You built your name coaching quarterbacks.', effect: '+20% XP, quarterbacks' },
  { id: 'Veteran Care', tree: 'Development', tier: 2, needs: 'Mentor', desc: 'Tailored programs keep older players sharp.', effect: '+25% XP, age 30+' },
  { id: 'Player Development II', tree: 'Development', tier: 3, needs: 'Rookie Camp', desc: 'A full development department.', effect: '+12% more XP, whole roster' },
  { id: 'Archetype Lab', tree: 'Development', tier: 3, needs: 'QB Whisperer', desc: 'Position coaches turn every milestone into a new skill.', effect: '+1 bonus skill point per goal' },
  // Game Day
  { id: 'Motivator', tree: 'Game Day', tier: 1, desc: 'Your players run through walls for you.', effect: '+0.6 to every rating on game day' },
  { id: 'Disciplinarian', tree: 'Game Day', tier: 2, needs: 'Motivator', desc: 'Laps for every false start.', effect: '40% fewer pre-snap penalties' },
  { id: 'Home Fortress', tree: 'Game Day', tier: 2, needs: 'Motivator', desc: 'Nobody wins in your building.', effect: '+0.6 at home' },
  { id: 'Clock Manager', tree: 'Game Day', tier: 2, needs: 'Motivator', desc: 'You manage the last five minutes better than anyone.', effect: '+1.5 in the final 5:00 of a one-score game' },
  { id: 'Road Warriors', tree: 'Game Day', tier: 3, needs: 'Home Fortress', desc: 'Hostile crowds only focus your team.', effect: '+0.7 on the road' },
  { id: 'Big Game Coach', tree: 'Game Day', tier: 3, needs: 'Clock Manager', desc: 'Your teams are at their best in January.', effect: '+1 in the playoffs' },
  // Offense
  { id: 'Scheme Expert', tree: 'Offense', tier: 1, desc: 'Your system puts players in the right spots.', effect: '+0.5 to the offense' },
  { id: 'Air Raid', tree: 'Offense', tier: 2, needs: 'Scheme Expert', desc: 'Spread them out and throw it around.', effect: '+0.6 for QBs, WRs and TEs' },
  { id: 'Ground Game', tree: 'Offense', tier: 2, needs: 'Scheme Expert', desc: 'Physical, downhill, every week.', effect: '+0.6 for RBs, FBs and the line' },
  { id: 'Two-Minute Drill', tree: 'Offense', tier: 3, needs: 'Air Raid', desc: 'No-huddle package ready for the end of each half.', effect: '+1 offense in the final 2:00 of a half' },
  { id: 'Red Zone Specialist', tree: 'Offense', tier: 3, needs: 'Ground Game', desc: 'Touchdowns, not field goals.', effect: '+1.2 offense inside the 20' },
  // Defense
  { id: 'Defensive Mind', tree: 'Defense', tier: 1, desc: 'Sound fits and smart calls.', effect: '+0.5 to the defense' },
  { id: 'Pressure Package', tree: 'Defense', tier: 2, needs: 'Defensive Mind', desc: 'Simulated pressures and stunts.', effect: '+1.2 pass rush moves' },
  { id: 'Lockdown Coverage', tree: 'Defense', tier: 2, needs: 'Defensive Mind', desc: 'Disguised shells and pattern-matching.', effect: '+1 man and zone coverage' },
  { id: 'Goal Line Stand', tree: 'Defense', tier: 3, needs: 'Pressure Package', desc: 'The field shrinks and your defense gets meaner.', effect: '+1.2 defense inside your 20' },
  { id: 'Takeaway Drills', tree: 'Defense', tier: 3, needs: 'Lockdown Coverage', desc: 'Every practice ends with ball drills.', effect: '+4 catching for defenders, more picks' },
  // Health
  { id: 'Sports Science', tree: 'Health', tier: 1, desc: 'Sleep, nutrition and GPS load tracking.', effect: '+6 condition recovered each week' },
  { id: 'Fresh Legs', tree: 'Health', tier: 2, needs: 'Sports Science', desc: 'Conditioning that lasts into the fourth quarter.', effect: '30% less in-game fatigue' },
  { id: 'Iron Program', tree: 'Health', tier: 2, needs: 'Sports Science', desc: 'Prehab work that protects soft tissue.', effect: '25% fewer in-game injuries' },
  { id: 'Recovery Lab', tree: 'Health', tier: 3, needs: 'Iron Program', desc: 'A medical staff on the cutting edge.', effect: 'Injuries heal 25% faster' },
  // Front Office
  { id: 'Cap Guru', tree: 'Front Office', tier: 1, desc: 'You know every clause in every contract.', effect: 'Re-signings ask 6% less' },
  { id: 'Eye for Talent', tree: 'Front Office', tier: 1, desc: 'Your scouts find what others miss.', effect: 'Scouting costs 25% less' },
  { id: 'Trade Shark', tree: 'Front Office', tier: 2, needs: 'Cap Guru', desc: 'Other GMs leave the table feeling they won.', effect: 'AI teams accept 5% less value' },
  { id: 'Media Darling', tree: 'Front Office', tier: 2, needs: 'Cap Guru', desc: 'The city loves your press conferences.', effect: '+0.5 fan support every week' },
  { id: 'Auto Depth', tree: 'Front Office', tier: 2, needs: 'Eye for Talent', desc: 'A staff that keeps the depth chart optimal.', effect: 'Depth chart re-sorts itself weekly' },
  { id: "Owner's Trust", tree: 'Front Office', tier: 3, needs: 'Media Darling', desc: 'The owner believes in the plan.', effect: '+0.5 job security per win' },
];

/** Has the user's coach unlocked this ability? */
export const coachHas = (L: League, id: string) => L.coachTree.unlocked.includes(id);
/** XP needed to go from `level` to the next one. Flat enough that the tree fills over a long career. */
export const coachXpNeed = (level: number) => 350 + level * 100;
/** Coach points earned per level. */
export const POINTS_PER_LEVEL = 2;
