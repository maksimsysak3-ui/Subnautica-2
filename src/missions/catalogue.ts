/**
 * Mission catalogue.
 *
 * OWNED BY: Mission design.
 *
 * Missions are authored as data so that adding one is an entry in this file
 * rather than a new system. Each is built around a *question* the map can ask,
 * not around a body count:
 *
 *  - Casa Verdugo is a walled estate with one obvious way in and three quiet
 *    ones, so its missions are about whether you take the loud route.
 *  - Meridian Quay has height and a maze, so its missions are about who owns
 *    the catwalks and whether you can get out through the yard once the alarm
 *    has gone up.
 *
 * Coordinates are the site's own, and every one of them was taken from the
 * geometry rather than guessed: an objective marker floating inside a wall is
 * worse than no marker.
 */

import type { ObjectiveKind } from '../core/contracts';

export interface ObjectiveTemplate {
  id: string;
  kind: ObjectiveKind;
  label: string;
  description: string;
  /** World position, if the objective has one. */
  at?: [number, number, number];
  /** Metres. How close counts, or how wide "this room" is. */
  radius?: number;
  required?: number;
  optional?: boolean;
  hidden?: boolean;
  dependsOn?: string[];
  /** For eliminateHVT: which archetype is the target. */
  archetype?: string;
}

export interface MissionTemplate {
  id: string;
  siteId: 'villa' | 'quay';
  name: string;
  codename: string;
  difficulty: number;
  hour: number;
  briefing: string;
  intel: string[];
  objectives: ObjectiveTemplate[];
  rewards: { xp: number; cash: number; reputation: Record<string, number> };
}

export const MISSIONS: MissionTemplate[] = [
  // =========================================================================
  // CASA VERDUGO
  // =========================================================================
  {
    id: 'villa-hvt',
    siteId: 'villa',
    name: 'Casa Verdugo',
    codename: 'BROKEN LANTERN',
    difficulty: 4,
    hour: 15.2,
    briefing:
      'Ernesto Verdugo is at the house and his detail is with him. Take him off the '
      + 'board and recover whatever is in the office safe. The gate is watched; the '
      + 'service side is not.',
    intel: [
      'Two on the approach road, four in the compound, two on the principal.',
      'The staff block has a service alley that never enters the courtyard.',
      'The office is on the ground floor of the main house, east side.',
    ],
    objectives: [
      {
        id: 'hvt', kind: 'eliminateHVT', archetype: 'bodyguard',
        label: 'Neutralise the detail',
        description: 'The principal does not move without his two bodyguards.',
        required: 2,
      },
      {
        id: 'intel', kind: 'secureIntel',
        label: 'Recover the ledger',
        description: 'Ground floor office, east side of the main house.',
        at: [-6, 3.4, 4], radius: 3.5,
      },
      {
        id: 'exfil', kind: 'extract',
        label: 'Exfiltrate',
        description: 'Back out to the access road north of the gate.',
        at: [0, 2.2, 96], radius: 8,
        dependsOn: ['hvt', 'intel'],
      },
      {
        id: 'quiet', kind: 'survive', optional: true,
        label: 'Leave no witnesses to your entry',
        description: 'Finish without being seen. Optional, and worth more than the job.',
      },
    ],
    rewards: { xp: 900, cash: 12000, reputation: { cartel: -30 } },
  },
  {
    id: 'villa-sabotage',
    siteId: 'villa',
    name: 'Casa Verdugo — motor pool',
    codename: 'DRY SEASON',
    difficulty: 3,
    hour: 21.4,
    briefing:
      'Their vehicles move product north twice a week. Disable the motor pool and '
      + 'the workshop generator, then get out. You are not here for the people.',
    intel: [
      'Night. They run lights in the courtyard and nowhere else.',
      'The workshop is on the service spur, east of the compound.',
      'The generator is loud. So is what happens when it stops.',
    ],
    objectives: [
      {
        id: 'gen', kind: 'sabotage',
        label: 'Kill the generator',
        description: 'Workshop, service spur.',
        at: [40, 2.2, -30], radius: 5,
      },
      {
        id: 'vehicles', kind: 'destroy',
        label: 'Disable the motor court vehicles',
        description: 'Three vehicles on the drive.',
        at: [-8, 2.2, 30], radius: 12,
      },
      {
        id: 'exfil', kind: 'extract',
        label: 'Exfiltrate',
        description: 'The arroyo west of the compound.',
        at: [-86, 2.0, 20], radius: 9,
        dependsOn: ['gen', 'vehicles'],
      },
    ],
    rewards: { xp: 600, cash: 7000, reputation: { cartel: -18 } },
  },

  // =========================================================================
  // MERIDIAN QUAY
  // =========================================================================
  {
    id: 'quay-intercept',
    siteId: 'quay',
    name: 'Meridian Quay',
    codename: 'COLD MANIFEST',
    difficulty: 6,
    hour: 6.6,
    briefing:
      'A container came in overnight and is being held in the bonded store. Get the '
      + 'manifest, then clear the warehouse floor so the follow-on team can work. '
      + 'They have people on the catwalks — look up before you commit.',
    intel: [
      'Thirteen on site. Two are above the warehouse floor.',
      'The bonded store is locked; the office link is the other way in.',
      'The rail spur cuts the fence east. Nobody watches the rails.',
    ],
    objectives: [
      {
        id: 'manifest', kind: 'secureIntel',
        label: 'Recover the manifest',
        description: 'Bonded store, office block.',
        at: [-50, 2.2, -46], radius: 5,
      },
      {
        id: 'floor', kind: 'clear',
        label: 'Clear the warehouse floor',
        description: 'Nothing hostile left standing inside the shell.',
        at: [-49, 2.2, 13], radius: 40,
      },
      {
        id: 'overwatch', kind: 'eliminate', optional: true,
        label: 'Take the catwalks',
        description: 'Two shooters have the height. Optional — but they have the height.',
        at: [-49, 9.4, 13], radius: 42, required: 2,
      },
      {
        id: 'exfil', kind: 'extract',
        label: 'Exfiltrate by rail',
        description: 'East along the spur, through the fence gap.',
        at: [110, 2.2, -9], radius: 10,
        dependsOn: ['manifest', 'floor'],
      },
    ],
    rewards: { xp: 1400, cash: 19000, reputation: { syndicate: -40 } },
  },
  {
    id: 'quay-coldstore',
    siteId: 'quay',
    name: 'Meridian Quay — cold store',
    codename: 'HARD FROST',
    difficulty: 5,
    hour: 23.0,
    briefing:
      'Somebody is being kept in the cold store and we want them out breathing. '
      + 'Three chambers, heavy doors, and the only light in there is what they left '
      + 'on. Do not start a firefight in a room with one way out.',
    intel: [
      'Night. The yard lamps are on; the chambers are not.',
      'Three chambers off one lobby. Two are cargo.',
      'The side door is locked from the outside.',
    ],
    objectives: [
      {
        id: 'find', kind: 'rescue',
        label: 'Locate the hostage',
        description: 'One of the three chambers.',
        at: [-5, 2.2, -40], radius: 9,
      },
      {
        id: 'quiet', kind: 'survive', optional: true,
        label: 'Do not raise the alarm',
        description: 'A firefight in the cold store ends one way.',
      },
      {
        id: 'exfil', kind: 'extract',
        label: 'Exfiltrate south',
        description: 'Out through the main gate and down the road.',
        at: [0, 2.0, -110], radius: 10,
        dependsOn: ['find'],
      },
    ],
    rewards: { xp: 1100, cash: 15000, reputation: { syndicate: -25 } },
  },
  // =========================================================================
  // SAN VERDUGO — the town below the compound
  // =========================================================================
  {
    id: 'villa-halcones',
    siteId: 'villa',
    name: 'San Verdugo',
    codename: 'BLIND CORNER',
    difficulty: 3,
    hour: 21.4,
    briefing:
      'Before anyone goes near the house, the town has to stop talking. Verdugo keeps '
      + 'lookouts on the corners of the Calle Real and one up in the parroquia tower, and '
      + 'every one of them has a radio. Take them quietly, lift the ledger the cantina '
      + 'keeps behind the bar, and get out the way you came.',
    intel: [
      'Three halcones on the Calle Real corners, two at the town checkpoint.',
      'The tower lookout sees the whole plaza. The ladder is inside the north tower.',
      'The backyards between the rows are walled but not locked — that is the quiet way in.',
      'Night. The plaza lamps and the cantina sign are the only real light.',
    ],
    objectives: [
      {
        id: 'lookouts', kind: 'eliminate',
        label: 'Silence the halcones',
        description: 'The corner lookouts on the Calle Real.',
        at: [0, 2.2, 170], radius: 60, required: 3,
      },
      {
        id: 'tower', kind: 'eliminate', optional: true,
        label: 'Take the tower',
        description: 'The lookout in the parroquia bell tower.',
        at: [-56.5, 13.6, 155.5], radius: 8,
      },
      {
        id: 'ledger', kind: 'secureIntel',
        label: 'Lift the cantina ledger',
        description: 'Behind the bar, Cantina El Farol, south-west corner of the plaza.',
        at: [-46, 2.2, 134], radius: 5,
      },
      {
        id: 'exfil', kind: 'extract',
        label: 'Exfiltrate south',
        description: 'Back out past the checkpoint to the road.',
        at: [0, 2.2, 266], radius: 10,
        dependsOn: ['lookouts', 'ledger'],
      },
    ],
    rewards: { xp: 1000, cash: 12000, reputation: { cartel: -20 } },
  },
  // =========================================================================
  // PUERTO MERIDIAN — the district outside the wire
  // =========================================================================
  {
    id: 'quay-ancla',
    siteId: 'quay',
    name: 'Puerto Meridian',
    codename: 'DEAD LETTER',
    difficulty: 4,
    hour: 19.2,
    briefing:
      'The gate crew at the terminal are paid in the cantina on Calle del Muelle, and the '
      + 'man who pays them keeps a book. Get it before the shift changes, deal with the '
      + 'shooter the syndicate keeps on the dormitory roof, and walk out through the '
      + 'district as if you belonged there.',
    intel: [
      'The cantina is the first building on the south side of Calle del Muelle.',
      'Four storeys of dormitory at the south end of the district; someone lives on the roof.',
      'The customs house overlooks the port road. Assume it is watched.',
      'The ditch beside the road still runs all the way to the checkpoint.',
    ],
    objectives: [
      {
        id: 'book', kind: 'secureIntel',
        label: 'Take the paymaster\'s book',
        description: 'Cantina La Ancla, Calle del Muelle.',
        at: [-50, 2.2, -110], radius: 5,
      },
      {
        id: 'roof', kind: 'eliminate',
        label: 'Clear the dormitory roof',
        description: 'The shooter over the port road.',
        at: [-46, 15, -172], radius: 12,
      },
      {
        id: 'exfil', kind: 'extract',
        label: 'Exfiltrate south',
        description: 'Down the port road, out of the district.',
        at: [0, 2.2, -182], radius: 10,
        dependsOn: ['book', 'roof'],
      },
    ],
    rewards: { xp: 1200, cash: 14000, reputation: { syndicate: -25 } },
  },
];

/** Every mission that can be run on a given site. */
export function missionsFor(siteId: 'villa' | 'quay'): MissionTemplate[] {
  return MISSIONS.filter((m) => m.siteId === siteId);
}
