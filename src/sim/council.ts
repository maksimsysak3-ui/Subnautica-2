/**
 * The council: who the city is, what they think of how it is run, and the
 * chamber that has to agree before anything big changes.
 *
 * City Hall's elections choose a mayor every couple of months. This is the
 * government in between, and it is where most of politics actually happens:
 *
 *   VOTERS come in six blocs -- workers, families, business, students,
 *   retirees and the green vote -- each sized from the city itself (a works
 *   town is a workers' town; a university grows students) and each keeping its
 *   own opinion of the administration, drawn from the problems it cares about:
 *   jobs and rent, schools and crime, trade and rates, fares, clinics, air.
 *
 *   THE COUNCIL is elected from those blocs every month: what a bloc does not
 *   give the administration it gives to the party that speaks for it, and the
 *   seats are shared out by D'Hondt. So a city that neglects its students
 *   finds Movement councillors in the chamber.
 *
 *   BILLS are the big levers ordinances are not: rent control, a minimum
 *   wage, a carbon levy, an austerity budget, a municipal bond. Tabling one
 *   costs political capital; the chamber votes after two days in committee,
 *   every councillor weighing their party's line against what the public
 *   thinks. The whip count is shown before a vote, and capital can be spent
 *   lobbying the waverers. A law in force changes the simulation through the
 *   same effects the ordinances use, and changes how every bloc feels.
 *
 *   PETITIONS arrive in the inbox: somebody wants something, it costs
 *   something, and saying no costs something else. Ignored, they lapse, and
 *   the people who sent them remember.
 *
 *   PROTESTS follow a bloc left below a fifth for long enough: marches, and if
 *   it is the workers, a strike.
 *
 * Deterministic -- a seeded generator for the petitions -- so a save restores
 * to the same inbox and the tests can play it.
 */

import type { Effects, Extra, Policies, Price } from './policies';
import type { Budget } from './budget';
import { PARTIES, PLAYER_PARTY } from './politics';
import type { Issues, Party } from './politics';
import type { Newsroom } from './news';
import { CURRENCY } from './difficulty';

/** Residents at which the town gets a council. */
export const COUNCIL_POPULATION = 1200;
/** Game days between council elections. */
export const COUNCIL_TERM = 28;
/** Game days a bill spends in committee before the vote. */
export const COMMITTEE_DAYS = 2;
/** Political capital: the most that can be banked. */
export const CAPITAL_MAX = 100;
/** What one round of lobbying costs, and how far it moves a councillor. */
export const LOBBY_COST = 6;
const LOBBY_PULL = 0.22;
export const LOBBY_MAX = 4;
/** How far an opposition councillor leans against an administration bill by default. */
const OPPOSITION = 0.28;
/** Approval below which a bloc takes to the streets, and above which it goes home. */
export const PROTEST_BELOW = 0.22;
const PROTEST_ENDS = 0.3;
/** Petitions open at once, and the days one waits for an answer. */
const PETITIONS_OPEN = 3;
const PETITION_DAYS = 6;

export type BlocId = 'workers' | 'families' | 'business' | 'students' | 'retirees' | 'greens';

export interface Bloc {
  id: BlocId;
  name: string;
  colour: string;
  /** What they vote on, in a line. */
  cares: string;
}

export const BLOCS: readonly Bloc[] = [
  { id: 'workers', name: 'Workers', colour: '#e8b454', cares: 'Jobs, wages, the cost of living' },
  { id: 'families', name: 'Families', colour: '#6fd3ff', cares: 'Schools, safe streets, clinics' },
  { id: 'business', name: 'Business', colour: '#c98bdb', cares: 'Rates, customers, moving traffic' },
  { id: 'students', name: 'Students', colour: '#ff7a6b', cares: 'Colleges, fares, rent' },
  { id: 'retirees', name: 'Retirees', colour: '#9fb4c9', cares: 'Health care, safety, low taxes' },
  { id: 'greens', name: 'Green vote', colour: '#5cc98a', cares: 'Clean air, parks, less rubbish' },
];

export const BLOC_COUNT = BLOCS.length;
const BI: Record<BlocId, number> = {
  workers: 0, families: 1, business: 2, students: 3, retirees: 4, greens: 5,
};

/** The chamber's parties: the administration's own, then the five in `politics.ts`. */
export const COUNCIL_PARTIES: readonly Party[] = [PLAYER_PARTY, ...PARTIES];

/**
 * Where each bloc's vote goes when it does not go to the administration,
 * over PARTIES: Green Streets, Prosper, Civic Union, Heritage, Movement.
 */
const LEANING: readonly (readonly number[])[] = [
  [0.12, 0.08, 0.25, 0.12, 0.43], // workers
  [0.14, 0.14, 0.36, 0.22, 0.14], // families
  [0.04, 0.68, 0.14, 0.10, 0.04], // business
  [0.36, 0.04, 0.10, 0.00, 0.50], // students
  [0.04, 0.20, 0.26, 0.46, 0.04], // retirees
  [0.72, 0.00, 0.05, 0.08, 0.15], // greens
];

/** What the chamber's laws and the city's temporary measures act through. */
export interface EnactContext {
  budget: Budget;
  population: number;
  day: number;
}

export interface BillDef {
  id: string;
  name: string;
  /** A sentence, in the paper's words. */
  summary: string;
  /** The short lines the card lists. */
  says: readonly string[];
  /** Political capital to table it. */
  capital: number;
  /** Paid on passing, per resident, in the game's designed money. */
  upfront?: number;
  /** Weekly while in force, as the ordinances price themselves. */
  price?: Price;
  apply?: (e: Effects) => void;
  /** Mood points it adds for everybody while in force. */
  mood?: number;
  /** How each bloc takes it, -1 hates to +1 loves. */
  blocs: Partial<Record<BlocId, number>>;
  /** Each opposition party's line: Green Streets, Prosper, Civic Union, Heritage, Movement. */
  parties: readonly [number, number, number, number, number];
  /** Days it runs before lapsing; absent, it stands until repealed. */
  lasts?: number;
  /** Something done once on passing. */
  enact?: (c: EnactContext, law: Law) => void;
  /** Smallest city it can be tabled in. */
  minPop?: number;
}

export const BILLS: readonly BillDef[] = [
  {
    id: 'rentControl', name: 'Rent Control Act',
    summary: 'Caps what landlords may raise rents by each year.',
    says: ['Everybody a little happier', 'Housing pays 8% less tax'],
    capital: 22, mood: 5,
    apply: (e) => { e.residentialYield *= 0.92; },
    blocs: { workers: 0.6, families: 0.5, students: 0.8, business: -0.7, retirees: 0.1 },
    parties: [0.4, -0.9, 0.1, -0.2, 0.9],
  },
  {
    id: 'minimumWage', name: 'Living Wage Ordinance',
    summary: 'A city minimum wage above the national one, for every employer.',
    says: ['Mood up for everyone in work', 'Shops earn 7% less, works 5% less'],
    capital: 20, mood: 4,
    apply: (e) => { e.commercialYield *= 0.93; e.industrialYield *= 0.95; },
    blocs: { workers: 0.9, students: 0.4, families: 0.3, business: -0.9 },
    parties: [0.3, -1, 0.1, -0.3, 0.9],
  },
  {
    id: 'incentives', name: 'Enterprise Zone',
    summary: 'Rate holidays and fast-track permits for firms that move here.',
    says: ['Works and offices earn 8% more', 'Costs 0.6 a job a week', 'Mood down a little'],
    capital: 18, mood: -2, price: { perJob: 0.6 },
    apply: (e) => { e.industrialYield *= 1.08; e.officeYield *= 1.08; },
    blocs: { business: 0.9, workers: 0.2, greens: -0.5, students: -0.2 },
    parties: [-0.6, 1, 0.2, 0, -0.4],
  },
  {
    id: 'carbonLevy', name: 'Carbon Levy',
    summary: 'A charge on every tonne the works put in the air, paid to the city.',
    says: ['Industrial pollution down 20%', 'Industry earns 8% less', 'Earns 0.5 a job a week'],
    capital: 20, price: { perJob: -0.5 },
    apply: (e) => { e.industrialPollution *= 0.8; e.industrialYield *= 0.92; },
    blocs: { greens: 1, students: 0.4, families: 0.2, business: -0.8, workers: -0.3 },
    parties: [1, -0.9, 0, -0.2, 0.3],
  },
  {
    id: 'publicSafety', name: 'Safer Streets Act',
    summary: 'More officers on foot, longer shifts, better lighting.',
    says: ['Police and fire reach 15% further', 'Services cost 4% more'],
    capital: 16,
    apply: (e) => { e.safetyReach *= 1.15; e.serviceUpkeep *= 1.04; },
    blocs: { retirees: 0.8, families: 0.7, business: 0.3, students: -0.3 },
    parties: [-0.2, 0.3, 0.9, 0.8, -0.2],
  },
  {
    id: 'education', name: 'Schools and Skills Act',
    summary: 'Smaller classes, adult places, and a college bursary.',
    says: ['Schools reach 20% further', 'Office work earns 5% more', 'Costs 1.6 a resident a week'],
    capital: 18, price: { perResident: 1.6 },
    apply: (e) => { e.learningReach *= 1.2; e.officeYield *= 1.05; },
    blocs: { students: 0.9, families: 0.8, workers: 0.2, retirees: -0.3, business: 0.1 },
    parties: [0.5, -0.3, 0.8, 0, 0.7],
  },
  {
    id: 'austerity', name: 'Austerity Budget',
    summary: 'Every department cut, every grant frozen, every vacancy left empty.',
    says: ['Services cost 12% less to run', 'Everybody unhappier'],
    capital: 26, mood: -8,
    apply: (e) => { e.serviceUpkeep *= 0.88; },
    blocs: { business: 0.7, retirees: 0.1, workers: -0.7, families: -0.6, students: -0.6, greens: -0.3 },
    parties: [-0.8, 1, -0.1, 0.4, -1],
  },
  {
    id: 'congestion', name: 'Congestion Charge',
    summary: 'A daily fee to drive into the city, and the income from it.',
    says: ['Fewer drive, more ride', 'Shops take 4% less', 'Earns 1.1 a job a week'],
    capital: 20, price: { perJob: -1.1 },
    apply: (e) => { e.parkingCharge += 0.4; e.commercialYield *= 0.96; },
    blocs: { greens: 0.8, students: 0.3, workers: -0.6, business: -0.5, retirees: -0.2 },
    parties: [0.9, -0.6, 0, -0.5, 0.2],
  },
  {
    id: 'housing', name: 'Affordable Homes Programme',
    summary: 'The city builds and lets homes below the market rent.',
    says: ['Mood up', 'Land worth a little less', 'Costs 1.2 a resident a week'],
    capital: 18, mood: 4, price: { perResident: 1.2 },
    apply: (e) => { e.landValue -= 0.02; },
    blocs: { workers: 0.7, families: 0.6, students: 0.7, business: -0.3, retirees: -0.2 },
    parties: [0.3, -0.7, 0.3, -0.4, 0.9],
  },
  {
    id: 'tourism', name: 'Visit the City Campaign',
    summary: 'Posters in every station from here to the coast.',
    says: ['Shops earn 7% more', 'Costs a flat 3,000 a week'],
    capital: 12, price: { flat: 3000 },
    apply: (e) => { e.commercialYield *= 1.07; },
    blocs: { business: 0.8, workers: 0.2, retirees: -0.2, greens: -0.2 },
    parties: [-0.1, 0.8, 0.2, 0.3, 0],
  },
  {
    id: 'bond', name: 'Municipal Bond',
    summary: 'Borrow against the city\'s future on the bond market; repay over twelve weeks.',
    says: ['Raises 60 a resident now', 'Repays 5.5 a resident a week for 12 weeks'],
    capital: 24, lasts: 84, minPop: 2500,
    enact: (c, law) => {
      const raised = 60 * c.population * CURRENCY;
      c.budget.credit(raised);
      law.flat = 5.5 * c.population;
    },
    blocs: { business: 0.3, retirees: -0.5, families: -0.1 },
    parties: [0, 0.3, 0.2, -0.8, 0.4],
  },
  {
    id: 'health', name: 'Community Health Act',
    summary: 'Walk-in clinics, home visits and free screening.',
    says: ['Mood up', 'Costs 1.4 a resident a week'],
    capital: 16, mood: 4, price: { perResident: 1.4 },
    blocs: { retirees: 0.9, families: 0.6, workers: 0.3, business: -0.2 },
    parties: [0.3, -0.4, 0.6, 0.5, 0.6],
  },
  {
    id: 'deregulation', name: 'Planning Freedom Bill',
    summary: 'Fewer permits, faster approvals, looser rules on what goes where.',
    says: ['Shops earn 4% more, homes pay 3% more', 'Land worth a little less'],
    capital: 18,
    apply: (e) => { e.commercialYield *= 1.04; e.residentialYield *= 1.03; e.landValue -= 0.02; },
    blocs: { business: 0.8, workers: 0.1, retirees: -0.6, greens: -0.7, families: -0.2 },
    parties: [-0.8, 0.9, 0, -0.9, 0.1],
  },
  {
    id: 'nightEconomy', name: 'Night Economy Licence',
    summary: 'Late licences for bars, clubs and all-night buses.',
    says: ['Shops earn 6% more', 'Retirees and families object'],
    capital: 14,
    apply: (e) => { e.commercialYield *= 1.06; },
    blocs: { students: 0.9, business: 0.6, workers: 0.2, retirees: -0.8, families: -0.4 },
    parties: [0.1, 0.5, -0.4, -0.8, 0.6],
  },
];

export function billById(id: string): BillDef | undefined {
  return BILLS.find((b) => b.id === id);
}

/** A law in force. */
export interface Law {
  id: string;
  since: number;
  /** Day it lapses, for a bill that runs for a time. */
  until?: number;
  /** A flat weekly figure set on passing, in designed money: a bond's repayment. */
  flat?: number;
}

/** A bill in committee. */
export interface Pending {
  id: string;
  /** True to repeal the law of that id rather than pass it. */
  repeal: boolean;
  tabled: number;
  lobbied: number;
}

/** A result, kept for the chamber's record. */
export interface Division {
  id: string;
  repeal: boolean;
  day: number;
  ayes: number;
  noes: number;
  passed: boolean;
}

// ---- petitions ----------------------------------------------------------------

export interface PetitionOption {
  label: string;
  /** What it does, in a line. */
  says: string;
  /** Paid now, per resident, in designed money. Negative is money in. */
  cost?: number;
  blocs: Partial<Record<BlocId, number>>;
  /** A temporary measure: mood, effects and weekly price for `days`. */
  days?: number;
  mood?: number;
  apply?: (e: Effects) => void;
  price?: Price;
  /** Chance it comes out later as a scandal. */
  scandal?: number;
}

export interface PetitionDef {
  id: string;
  from: BlocId;
  title: string;
  body: string;
  options: readonly PetitionOption[];
  when?: (c: CouncilCity) => boolean;
}

export const PETITIONS: readonly PetitionDef[] = [
  {
    id: 'playScheme', from: 'families', title: 'A summer play scheme',
    body: 'Parents from across the city ask for supervised play and meals through the school holidays.',
    options: [
      { label: 'Fund it', says: 'Costs 6 a resident; families pleased, mood up for two weeks',
        cost: 6, days: 14, mood: 2, blocs: { families: 0.1, workers: 0.03 } },
      { label: 'Decline', says: 'Families disappointed', blocs: { families: -0.05 } },
    ],
  },
  {
    id: 'busPay', from: 'workers', title: 'Bus drivers want a pay rise',
    body: 'The transport union says wages have fallen behind rents, and asks the city to match inflation.',
    options: [
      { label: 'Grant it', says: 'Costs 0.4 a resident a week for four weeks; workers pleased',
        days: 28, price: { perResident: 0.4 }, blocs: { workers: 0.09, students: 0.02 } },
      { label: 'Refuse', says: 'Workers angry; a week of slower services', days: 7, mood: -2,
        blocs: { workers: -0.08 } },
    ],
    when: (c) => c.transport < 0.5,
  },
  {
    id: 'lateTrading', from: 'business', title: 'Late-night trading licences',
    body: 'The Chamber of Commerce asks for shops to open until midnight, seven days a week.',
    options: [
      { label: 'Approve', says: 'Shops earn 4% more for two weeks; retirees object',
        days: 14, apply: (e) => { e.commercialYield *= 1.04; },
        blocs: { business: 0.09, students: 0.03, retirees: -0.05 } },
      { label: 'Decline', says: 'Business disappointed', blocs: { business: -0.05, retirees: 0.02 } },
    ],
  },
  {
    id: 'carFree', from: 'greens', title: 'A car-free Sunday',
    body: 'Campaigners want the centre closed to cars one day a week, for walking, cycling and markets.',
    options: [
      { label: 'Approve', says: 'Green vote delighted; shops take 2% less for a week',
        days: 7, apply: (e) => { e.commercialYield *= 0.98; e.industrialPollution *= 0.9; },
        blocs: { greens: 0.12, families: 0.03, business: -0.04 } },
      { label: 'Decline', says: 'Green vote disappointed', blocs: { greens: -0.06 } },
    ],
  },
  {
    id: 'studentFares', from: 'students', title: 'Discount fares for students',
    body: 'The students\' union asks for half-price travel on every line in term time.',
    options: [
      { label: 'Approve', says: 'Costs 0.35 a resident a week for four weeks; students pleased',
        days: 28, price: { perResident: 0.35 }, blocs: { students: 0.12 } },
      { label: 'Decline', says: 'Students disappointed', blocs: { students: -0.06 } },
    ],
  },
  {
    id: 'fuelGrant', from: 'retirees', title: 'A winter fuel grant',
    body: 'Pensioners\' groups ask for help with heating bills through the cold months.',
    options: [
      { label: 'Pay it', says: 'Costs 4 a resident; retirees pleased', cost: 4,
        blocs: { retirees: 0.12, families: 0.02 } },
      { label: 'Decline', says: 'Retirees angry', blocs: { retirees: -0.08 } },
    ],
  },
  {
    id: 'developer', from: 'business', title: 'A developer offers a deal',
    body: 'A developer offers the city a sizeable contribution in exchange for fast-tracked planning on a riverside site.',
    options: [
      { label: 'Take the deal', says: 'Raises 14 a resident; business pleased; greens object; may come out later',
        cost: -14, scandal: 0.35, blocs: { business: 0.07, greens: -0.06, families: -0.02 } },
      { label: 'Refuse', says: 'Business cooler; greens approve', blocs: { business: -0.03, greens: 0.03 } },
    ],
  },
  {
    id: 'safetyDrive', from: 'workers', title: 'A workplace safety drive',
    body: 'The unions want inspectors in every works after a string of accidents.',
    options: [
      { label: 'Fund inspectors', says: 'Costs 3 a resident; workers pleased; business grumbles',
        cost: 3, blocs: { workers: 0.08, business: -0.03 } },
      { label: 'Decline', says: 'Workers angry', blocs: { workers: -0.06 } },
    ],
    when: (c) => c.industry > 0.15,
  },
  {
    id: 'nightNoise', from: 'families', title: 'Noise complaints from night traffic',
    body: 'Residents near the main roads ask for lorry curfews after ten at night.',
    options: [
      { label: 'Impose a curfew', says: 'Families pleased; works earn 3% less for two weeks',
        days: 14, apply: (e) => { e.industrialYield *= 0.97; },
        blocs: { families: 0.08, retirees: 0.04, business: -0.05 } },
      { label: 'Decline', says: 'Families disappointed', blocs: { families: -0.05 } },
    ],
  },
  {
    id: 'festival', from: 'students', title: 'A city festival',
    body: 'Organisers propose a week of music, food and fireworks in the main square.',
    options: [
      { label: 'Back it', says: 'Costs 8 a resident; everybody happier for a week', cost: 8, days: 7, mood: 5,
        blocs: { students: 0.06, families: 0.04, business: 0.04, workers: 0.04, retirees: 0.01, greens: 0.01 } },
      { label: 'Not this year', says: 'A few are disappointed', blocs: { students: -0.03 } },
    ],
  },
  {
    id: 'treePlanting', from: 'greens', title: 'Ten thousand trees',
    body: 'A coalition of residents\' groups asks the city to plant a tree on every street.',
    options: [
      { label: 'Plant them', says: 'Costs 5 a resident; land worth more for four weeks', cost: 5,
        days: 28, apply: (e) => { e.landValue += 0.02; }, blocs: { greens: 0.1, families: 0.04 } },
      { label: 'Decline', says: 'Green vote disappointed', blocs: { greens: -0.05 } },
    ],
  },
  {
    id: 'clinicHours', from: 'retirees', title: 'Longer clinic hours',
    body: 'Patients\' groups ask for evening and weekend opening at every clinic.',
    options: [
      { label: 'Extend hours', says: 'Services cost 3% more for four weeks; retirees pleased',
        days: 28, apply: (e) => { e.serviceUpkeep *= 1.03; }, blocs: { retirees: 0.1, families: 0.04 } },
      { label: 'Decline', says: 'Retirees disappointed', blocs: { retirees: -0.06 } },
    ],
    when: (c) => c.health > 0.02,
  },
];

export function petitionById(id: string): PetitionDef | undefined {
  return PETITIONS.find((p) => p.id === id);
}

// ---- city projects --------------------------------------------------------------

/**
 * A programme the city runs for weeks and keeps the result of for good.
 *
 * Where a bill is a switch and a petition is an answer, a project is an
 * investment: a weekly bill for a couple of months, and then a permanent
 * change to the city. Started from the projects office with political
 * capital, because a council has to be persuaded to commit to one; one at a
 * time, because a city's engineers are only so many.
 */
export interface ProjectDef {
  id: string;
  name: string;
  summary: string;
  /** What it leaves behind. */
  says: readonly string[];
  weeks: number;
  /** What it costs each week while it runs, as the ordinances price themselves. */
  price: Price;
  capital: number;
  minPop: number;
  apply?: (e: Effects) => void;
  mood?: number;
  /** How each bloc takes it when it is finished. */
  blocs: Partial<Record<BlocId, number>>;
}

export const PROJECTS: readonly ProjectDef[] = [
  {
    id: 'fibre', name: 'Fibre to Every Door', minPop: 2000, weeks: 8, capital: 14,
    summary: 'Gigabit broadband dug into every street in the city.',
    says: ['Offices earn 8% more', 'Shops earn 3% more'],
    price: { perResident: 1.4 },
    apply: (e) => { e.officeYield *= 1.08; e.commercialYield *= 1.03; },
    blocs: { business: 0.08, students: 0.08, workers: 0.03 },
  },
  {
    id: 'cleanRiver', name: 'Clean River Programme', minPop: 1500, weeks: 8, capital: 12,
    summary: 'Interceptor sewers, reed beds and a new outfall. The river runs clear.',
    says: ['Industrial pollution down 15%', 'Land worth more everywhere'],
    price: { perResident: 1.1 },
    apply: (e) => { e.industrialPollution *= 0.85; e.landValue += 0.02; },
    blocs: { greens: 0.12, families: 0.05, retirees: 0.03 },
  },
  {
    id: 'renewables', name: 'Renewable Grid', minPop: 3000, weeks: 10, capital: 16,
    summary: 'Smart meters, rooftop solar and a grid that wastes less.',
    says: ['Power demand down 15%'],
    price: { perResident: 1.3 },
    apply: (e) => { e.power *= 0.85; },
    blocs: { greens: 0.12, students: 0.04 },
  },
  {
    id: 'waterReuse', name: 'Water Recycling Works', minPop: 2500, weeks: 6, capital: 10,
    summary: 'Grey water treated and piped back to parks, works and toilets.',
    says: ['Water demand down 15%'],
    price: { perResident: 1.0 },
    apply: (e) => { e.water *= 0.85; },
    blocs: { greens: 0.06, business: 0.03 },
  },
  {
    id: 'zeroWaste', name: 'Zero Waste City', minPop: 3000, weeks: 8, capital: 12,
    summary: 'Repair shops, deposit returns and a compost collection for every street.',
    says: ['Rubbish down 20%'],
    price: { perResident: 0.9 },
    apply: (e) => { e.garbage *= 0.8; },
    blocs: { greens: 0.1, families: 0.03 },
  },
  {
    id: 'civicPride', name: 'Civic Pride Campaign', minPop: 1200, weeks: 4, capital: 8,
    summary: 'Murals, festivals, restored squares and a city that likes itself.',
    says: ['Everybody a little happier, for good'],
    price: { perResident: 0.8 },
    mood: 3,
    blocs: { families: 0.04, retirees: 0.04, workers: 0.03, students: 0.04 },
  },
  {
    id: 'emergencyNet', name: 'Emergency Radio Network', minPop: 4000, weeks: 6, capital: 12,
    summary: 'One radio net for fire, police and ambulances, and a control room to run it.',
    says: ['Police and fire reach 12% further'],
    price: { perResident: 1.0 },
    apply: (e) => { e.safetyReach *= 1.12; },
    blocs: { retirees: 0.06, families: 0.06 },
  },
  {
    id: 'floodDefences', name: 'River Flood Defences', minPop: 2000, weeks: 8, capital: 12,
    summary: 'Embankments, flood walls and a pumping station along the river.',
    says: ['Flood damage down 75%'],
    price: { perResident: 1.1 },
    apply: (e) => { e.floodDamage *= 0.25; },
    blocs: { families: 0.05, business: 0.05, retirees: 0.04 },
  },
  {
    id: 'seismicCode', name: 'Seismic Building Code', minPop: 3000, weeks: 10, capital: 14,
    summary: 'Every building braced and bolted, and new ones built to stand a quake.',
    says: ['Earthquake damage down 55%'],
    price: { perResident: 1.2 },
    apply: (e) => { e.quakeDamage *= 0.45; },
    blocs: { families: 0.06, retirees: 0.05 },
  },
  {
    id: 'emergencyPlan', name: 'City Emergency Plan', minPop: 1500, weeks: 4, capital: 8,
    summary: 'Storm shelters, sandbag stores, drills, and a plan everybody has read.',
    says: ['Storm damage down 45%', 'Every disaster 15% gentler'],
    price: { perResident: 0.6 },
    apply: (e) => { e.stormDamage *= 0.55 * 0.85; e.floodDamage *= 0.85; e.quakeDamage *= 0.85; },
    blocs: { families: 0.05, retirees: 0.04, workers: 0.02 },
  },
  {
    id: 'games', name: 'Host the Regional Games', minPop: 15000, weeks: 12, capital: 30,
    summary: 'A fortnight of sport, a village for the athletes and the eyes of the region on the city.',
    says: ['Shops earn 8% more, for good', 'Land worth more everywhere', 'Everybody happier'],
    price: { flat: 22000 },
    mood: 3,
    apply: (e) => { e.commercialYield *= 1.08; e.landValue += 0.03; },
    blocs: { business: 0.12, students: 0.08, workers: 0.05, families: 0.05, retirees: -0.03 },
  },
];

export function projectById(id: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export interface Running { id: string; started: number; until: number }

export interface OpenPetition { id: string; day: number }

/** A temporary measure, from an answered petition or a strike. */
interface Temp {
  until: number;
  mood: number;
  apply?: ((e: Effects) => void) | undefined;
  price?: Price | undefined;
  /** For a save: where it came from, so it can be rebuilt. */
  src: string;
  option: number;
}

/** What the council reads from the city. */
export interface CouncilCity extends Issues {
  unemployment: number;
  /** Shares of the population. */
  seniors: number;
  students: number;
  /** Share of jobs that are in offices. */
  offices: number;
  /** The commercial and industrial rates, as fractions. */
  comTax: number;
  indTax: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** A small seeded generator, so the inbox is the same after a load. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Council {
  open = false;
  /** Bloc sizes, summing to one, and their approval of the administration. */
  readonly share = new Float64Array(BLOC_COUNT).fill(1 / BLOC_COUNT);
  readonly approval = new Float64Array(BLOC_COUNT).fill(0.55);
  /** What happened to each bloc lately, decaying: bills passed, petitions answered. */
  readonly memory = new Float64Array(BLOC_COUNT);
  /** Days each bloc has spent under the protest line. */
  readonly sore = new Float64Array(BLOC_COUNT);
  readonly protesting = new Uint8Array(BLOC_COUNT);
  /** Seats per party, indexed as COUNCIL_PARTIES. */
  seats: number[] = [0, 0, 0, 0, 0, 0];
  /** Last council election's vote shares, as COUNCIL_PARTIES. */
  votes: number[] = [0, 0, 0, 0, 0, 0];
  nextElection = 0;
  elections = 0;
  capital = 20;
  laws: Law[] = [];
  pending: Pending | null = null;
  record: Division[] = [];
  /** Days before a defeated bill may be tabled again. */
  readonly cooldown = new Map<string, number>();
  inbox: OpenPetition[] = [];
  nextPetition = 3;
  private temps: Temp[] = [];
  /** The project under way, if any, and those finished. */
  project: Running | null = null;
  finished: string[] = [];
  private scandals: { day: number; text: string }[] = [];
  /** Last whole day stepped; null before the first. */
  private stepped: number | null = null;
  private seed = 0xc0417;
  private rand = mulberry(this.seed);
  /** Mood points everything above adds up to, for the people pass. */
  mood = 0;
  /** Bumped on every visible change. */
  version = 0;

  /** The administration's overall standing: the blocs, weighted by size. */
  get overall(): number {
    let a = 0;
    for (let b = 0; b < BLOC_COUNT; b++) a += this.share[b] * this.approval[b];
    return a;
  }

  get seatCount(): number { return this.seats.reduce((a, b) => a + b, 0); }

  has(id: string): boolean { return this.laws.some((l) => l.id === id); }

  // ---- the day ---------------------------------------------------------------

  /**
   * Steps the council to `day`, a whole day at a time. Returns true if
   * anything visible changed.
   */
  update(day: number, city: CouncilCity, policies: Policies, budget: Budget, news: Newsroom): boolean {
    const whole = Math.floor(day);
    if (this.stepped === null) this.stepped = whole;
    let changed = false;
    // A long skip -- a load, a fast-forward -- is caught up, but not forever.
    let steps = Math.min(whole - this.stepped, 60);
    this.stepped = whole;
    while (steps-- > 0) changed = this.daily(whole - steps, city, policies, budget, news) || changed;
    if (changed) this.version++;
    return changed;
  }

  private daily(day: number, city: CouncilCity, policies: Policies, budget: Budget, news: Newsroom): boolean {
    let changed = false;
    if (!this.open) {
      if (city.population < COUNCIL_POPULATION) return false;
      this.open = true;
      this.measure(city);
      this.approval.fill(0.58);
      this.elect(day, city, news, true);
      news.print(day, 'politics', 'good', 'Town gets its first council',
        `With ${Math.round(city.population).toLocaleString()} residents the town now elects a council of `
        + `${this.seatCount}. Bills now go before the chamber.`);
      this.refreshExtras(policies);
      return true;
    }
    this.measure(city);

    // Opinion, a day's worth.
    for (let b = 0; b < BLOC_COUNT; b++) {
      const target = clamp(0.55 + this.issueTerm(b, city) + this.lawTerm(b) + this.memory[b], 0.02, 0.98);
      this.approval[b] += (target - this.approval[b]) * 0.12;
      this.memory[b] *= 0.97;
    }
    const overall = this.overall;
    this.capital = clamp(this.capital + 0.55 + 3 * (overall - 0.5), 0, CAPITAL_MAX);

    // Protests.
    for (let b = 0; b < BLOC_COUNT; b++) {
      const bloc = BLOCS[b];
      if (this.protesting[b] === 0) {
        this.sore[b] = this.approval[b] < PROTEST_BELOW ? this.sore[b] + 1 : 0;
        if (this.sore[b] >= 3 && this.share[b] > 0.05) {
          this.protesting[b] = 1;
          changed = true;
          const strike = bloc.id === 'workers';
          news.print(day, 'politics', 'bad', strike ? 'General strike called' : `${bloc.name} take to the streets`,
            strike ? 'The unions have walked out across the city. Works and shops are running short-handed until the administration wins them back.'
              : `Thousands marched on City Hall today. Their approval of the administration is down to ${Math.round(this.approval[b] * 100)}%. `
                + `They care about: ${bloc.cares.toLowerCase()}.`);
        }
      } else if (this.approval[b] > PROTEST_ENDS) {
        this.protesting[b] = 0;
        this.sore[b] = 0;
        changed = true;
        news.print(day, 'politics', 'good', `${bloc.name} call off their protest`,
          'The marchers have gone home, for now.');
      }
    }

    // The chamber.
    if (this.pending !== null && day - this.pending.tabled >= COMMITTEE_DAYS) {
      this.vote(day, city, budget, news);
      changed = true;
    }
    for (const [id, until] of this.cooldown) if (day >= until) this.cooldown.delete(id);
    const lapsed = this.laws.filter((l) => l.until !== undefined && day >= l.until);
    if (lapsed.length > 0) {
      this.laws = this.laws.filter((l) => !lapsed.includes(l));
      for (const l of lapsed) {
        news.print(day, 'politics', 'flat', `${billById(l.id)?.name ?? 'A measure'} runs its course`,
          'The measure has lapsed as planned.');
      }
      changed = true;
    }
    const before = this.temps.length;
    this.temps = this.temps.filter((t) => day < t.until);
    if (this.temps.length !== before) changed = true;

    if (day >= this.nextElection) { this.elect(day, city, news, false); changed = true; }

    // The inbox.
    for (const p of this.inbox.filter((q) => day - q.day >= PETITION_DAYS)) {
      const def = petitionById(p.id);
      if (def !== undefined) {
        this.memory[BI[def.from]] -= 0.05;
        news.print(day, 'politics', 'bad', `Petition ignored: ${def.title.toLowerCase()}`,
          `${BLOCS[BI[def.from]].name} say City Hall never answered them.`);
      }
      changed = true;
    }
    this.inbox = this.inbox.filter((q) => day - q.day < PETITION_DAYS);
    if (day >= this.nextPetition && this.inbox.length < PETITIONS_OPEN) {
      const def = this.pickPetition(city);
      if (def !== null) { this.inbox.push({ id: def.id, day }); changed = true; }
      this.nextPetition = day + 3 + Math.floor(this.rand() * 4);
    }

    // The project, if one is done.
    if (this.project !== null && day >= this.project.until) {
      const def = projectById(this.project.id);
      this.project = null;
      if (def !== undefined) {
        this.finished.push(def.id);
        for (let b = 0; b < BLOC_COUNT; b++) this.memory[b] += def.blocs[BLOCS[b].id] ?? 0;
        news.print(day, 'city', 'good', `${def.name} completed`, `${def.summary} ${def.says.join('. ')}.`);
      }
      changed = true;
    }

    // Scandals come out when they come out.
    for (const s of this.scandals.filter((x) => day >= x.day)) {
      for (let b = 0; b < BLOC_COUNT; b++) this.memory[b] -= 0.06;
      this.capital = Math.max(0, this.capital - 15);
      news.print(day, 'politics', 'bad', 'Planning scandal engulfs City Hall', s.text);
      changed = true;
    }
    this.scandals = this.scandals.filter((x) => day < x.day);

    if (changed) this.refreshExtras(policies);
    this.mood = this.moodNow();
    return changed;
  }

  /** Sizes the blocs from the city. */
  private measure(c: CouncilCity): void {
    const raw = [
      0.2 + (1 - c.unemployment) * 0.35 + c.industry * 0.3,
      0.3,
      0.07 + c.offices * 0.25 + c.trade * 0.2,
      0.03 + c.students * 1.2,
      0.03 + c.seniors * 1.2,
      0.09 + c.rubbish * 0.5,
    ];
    const sum = raw.reduce((a, b) => a + b, 0);
    for (let b = 0; b < BLOC_COUNT; b++) this.share[b] = raw[b] / sum;
  }

  /** What the city's own problems do to a bloc's opinion. */
  private issueTerm(b: number, c: CouncilCity): number {
    const res = c.resTax - 0.09, com = c.comTax - 0.09, ind = c.indTax - 0.09;
    const mood = c.happiness - 0.6;
    const jam = 1 - c.flowing;
    const broke = c.net < 0 ? -0.08 : 0.03;
    switch (b) {
      case 0: return -Math.max(0, c.unemployment - 0.04) * 2.4 - res * 3 + mood * 0.6 - jam * 0.2 - c.utilities * 1.5;
      case 1: return -c.schooling * 1.4 - c.crime * 2 - c.health * 1.4 + mood * 0.5 - res * 2 - c.utilities * 1.5;
      case 2: return -c.trade * 2 - com * 3 - ind * 2 - jam * 0.45 + broke;
      case 3: return -c.schooling * 2.2 - c.transport * 1.5 - res * 1 + mood * 0.4;
      case 4: return -c.health * 2.4 - c.crime * 2 - res * 2.5 + broke * 0.5;
      default: return -Math.max(0, c.industry - 0.2) * 0.5 - c.rubbish * 2 - jam * 0.2 + mood * 0.3;
    }
  }

  private lawTerm(b: number): number {
    let t = 0;
    const id = BLOCS[b].id;
    for (const l of this.laws) t += (billById(l.id)?.blocs[id] ?? 0) * 0.1;
    return t;
  }

  private moodNow(): number {
    let m = 0;
    for (const l of this.laws) m += billById(l.id)?.mood ?? 0;
    for (const t of this.temps) m += t.mood;
    for (const id of this.finished) m += projectById(id)?.mood ?? 0;
    for (let b = 0; b < BLOC_COUNT; b++) if (this.protesting[b] === 1) m -= 3 + this.share[b] * 12;
    return m;
  }

  /** Hands the laws, the temporary measures and any strike to the ordinances. */
  refreshExtras(policies: Policies): void {
    const extras: Extra[] = [];
    for (const l of this.laws) {
      const def = billById(l.id);
      if (def === undefined) continue;
      extras.push({ apply: def.apply, price: l.flat !== undefined ? { flat: l.flat } : def.price });
    }
    for (const t of this.temps) extras.push({ apply: t.apply, price: t.price });
    for (const id of this.finished) extras.push({ apply: projectById(id)?.apply });
    if (this.project !== null) extras.push({ price: projectById(this.project.id)?.price });
    if (this.protesting[BI.workers] === 1) {
      extras.push({ apply: (e) => { e.industrialYield *= 0.9; e.commercialYield *= 0.96; } });
    }
    policies.setExtras(extras);
  }

  // ---- elections -------------------------------------------------------------

  /** Seats for a chamber of this size. */
  static chamber(population: number): number {
    return population < 8000 ? 7 : population < 30000 ? 9 : 11;
  }

  /** Vote shares as COUNCIL_PARTIES, from the blocs as they stand. */
  forecast(): number[] {
    const v = [0, 0, 0, 0, 0, 0];
    for (let b = 0; b < BLOC_COUNT; b++) {
      const s = this.share[b], a = this.approval[b];
      v[0] += s * a;
      for (let p = 0; p < 5; p++) v[p + 1] += s * (1 - a) * LEANING[b][p];
    }
    const sum = v.reduce((x, y) => x + y, 0) || 1;
    return v.map((x) => x / sum);
  }

  private elect(day: number, city: CouncilCity, news: Newsroom, first: boolean): void {
    const n = Council.chamber(city.population);
    const votes = this.forecast();
    // D'Hondt: each seat to the party with the highest votes / (seats + 1).
    const seats = [0, 0, 0, 0, 0, 0];
    for (let s = 0; s < n; s++) {
      let best = 0, bestQ = -1;
      for (let p = 0; p < 6; p++) {
        const q = votes[p] / (seats[p] + 1);
        if (q > bestQ) { bestQ = q; best = p; }
      }
      seats[best]++;
    }
    const had = this.seats[0];
    this.seats = seats;
    this.votes = votes;
    this.elections++;
    this.nextElection = day + COUNCIL_TERM;
    if (first) return;
    const majority = seats[0] * 2 > n;
    const biggest = seats.slice(1).reduce((bi, s, i, a) => (s > a[bi] ? i : bi), 0);
    news.print(day, 'politics', majority ? 'good' : seats[0] >= had ? 'flat' : 'bad',
      majority ? `Administration holds the council, ${seats[0]} of ${n}`
        : `Hung council: administration ${seats[0]} of ${n}`,
      `The administration took ${Math.round(votes[0] * 100)}% of the vote. `
      + `${PARTIES[biggest].name} lead the opposition with ${seats[biggest + 1]} seat${seats[biggest + 1] === 1 ? '' : 's'}.`
      + (majority ? '' : ' Every bill will need opposition votes.'));
  }

  // ---- bills -----------------------------------------------------------------

  /** Why a bill cannot be tabled now, or null if it can. */
  blocked(id: string, repeal: boolean, population: number): string | null {
    const def = billById(id);
    if (def === undefined) return 'No such bill';
    if (!this.open) return 'The council has not sat yet';
    if (this.pending !== null) return 'The chamber is already debating a bill';
    if (repeal ? !this.has(id) : this.has(id)) return repeal ? 'Not in force' : 'Already law';
    if (!repeal && def.minPop !== undefined && population < def.minPop) {
      return `Needs ${def.minPop.toLocaleString()} residents`;
    }
    const cd = this.cooldown.get(id);
    if (cd !== undefined) return 'Defeated recently; the chamber will not hear it again yet';
    if (this.capital < this.costOf(id, repeal)) return 'Not enough political capital';
    return null;
  }

  costOf(id: string, repeal: boolean): number {
    const c = billById(id)?.capital ?? 0;
    return repeal ? Math.round(c * 0.6) : c;
  }

  table(id: string, repeal: boolean, day: number, population: number): boolean {
    if (this.blocked(id, repeal, population) !== null) return false;
    this.capital -= this.costOf(id, repeal);
    this.pending = { id, repeal, tabled: day, lobbied: 0 };
    this.version++;
    return true;
  }

  canLobby(): boolean {
    return this.pending !== null && this.pending.lobbied < LOBBY_MAX && this.capital >= LOBBY_COST;
  }

  lobby(): boolean {
    if (!this.canLobby() || this.pending === null) return false;
    this.capital -= LOBBY_COST;
    this.pending.lobbied++;
    this.version++;
    return true;
  }

  /** What the public makes of a bill, -1 to 1, weighted by the blocs' sizes. */
  publicView(id: string, repeal: boolean): number {
    const def = billById(id);
    if (def === undefined) return 0;
    let v = 0;
    for (let b = 0; b < BLOC_COUNT; b++) v += this.share[b] * (def.blocs[BLOCS[b].id] ?? 0);
    return repeal ? -v : v;
  }

  /**
   * How every seat would vote now, in chamber order: true is aye. The same
   * sum decides the real vote, so the whip count on the card is the truth.
   */
  whip(id: string, repeal: boolean, lobbied = 0): boolean[] {
    const def = billById(id);
    const out: boolean[] = [];
    if (def === undefined) return out;
    const sign = repeal ? -1 : 1;
    const pub = this.publicView(id, repeal);
    const standing = (this.overall - 0.5) * 0.6;
    for (let p = 0; p < 6; p++) {
      for (let s = 0; s < this.seats[p]; s++) {
        if (p === 0) { out.push(true); continue; }
        // Each councillor is a little different: the party line, the public,
        // how the administration stands, and their own conscience.
        const own = ((s * 37 + p * 11) % 7 - 3) * 0.06;
        // Opposition is opposition: a councillor needs a reason to vote with
        // the administration, not merely no reason against.
        const score = def.parties[p - 1] * sign + pub * 0.9 + standing + lobbied * LOBBY_PULL + own - OPPOSITION;
        out.push(score > 0.05);
      }
    }
    return out;
  }

  private vote(day: number, city: CouncilCity, budget: Budget, news: Newsroom): void {
    const p = this.pending;
    if (p === null) return;
    this.pending = null;
    const def = billById(p.id);
    if (def === undefined) return;
    const ballot = this.whip(p.id, p.repeal, p.lobbied);
    const ayes = ballot.filter((x) => x).length;
    const noes = ballot.length - ayes;
    const passed = ayes > noes;
    this.record.unshift({ id: p.id, repeal: p.repeal, day, ayes, noes, passed });
    if (this.record.length > 30) this.record.length = 30;
    const sign = p.repeal ? -1 : 1;
    if (!passed) {
      this.cooldown.set(p.id, day + 10);
      news.print(day, 'politics', 'bad',
        `Council ${p.repeal ? 'refuses to repeal' : 'throws out'} the ${def.name}`,
        `Defeated ${noes} to ${ayes}. ${def.summary}`);
      this.capital = Math.max(0, this.capital - 4);
      return;
    }
    if (p.repeal) {
      this.laws = this.laws.filter((l) => l.id !== p.id);
    } else {
      const upfront = (def.upfront ?? 0) * city.population * CURRENCY;
      if (upfront > 0) budget.charge(upfront);
      const law: Law = { id: p.id, since: day, ...(def.lasts !== undefined ? { until: day + def.lasts } : {}) };
      def.enact?.({ budget, population: city.population, day }, law);
      this.laws.push(law);
    }
    // The blocs remember what was done for them, and to them.
    for (let b = 0; b < BLOC_COUNT; b++) this.memory[b] += (def.blocs[BLOCS[b].id] ?? 0) * 0.05 * sign;
    news.print(day, 'politics', 'good',
      p.repeal ? `The ${def.name} is repealed` : `Council passes the ${def.name}`,
      `Carried ${ayes} to ${noes}. ${p.repeal ? 'It no longer applies.' : def.summary}`);
  }

  // ---- petitions -------------------------------------------------------------

  private pickPetition(city: CouncilCity): PetitionDef | null {
    const open = new Set(this.inbox.map((p) => p.id));
    const choices = PETITIONS.filter((p) => !open.has(p.id) && (p.when?.(city) ?? true));
    if (choices.length === 0) return null;
    // The unhappier a bloc, the more it writes in.
    const weight = choices.map((p) => 0.3 + (1 - this.approval[BI[p.from]]) * this.share[BI[p.from]] * 6);
    let r = this.rand() * weight.reduce((a, b) => a + b, 0);
    for (let i = 0; i < choices.length; i++) {
      r -= weight[i];
      if (r <= 0) return choices[i];
    }
    return choices[choices.length - 1];
  }

  /** What an option costs now, in the game's money. Negative is money in. */
  optionCost(o: PetitionOption, population: number): number {
    return (o.cost ?? 0) * population * CURRENCY;
  }

  /** Answers a petition. False if it is not open or the city cannot pay. */
  answer(id: string, option: number, day: number, population: number, budget: Budget,
    policies: Policies, news: Newsroom): boolean {
    const at = this.inbox.findIndex((p) => p.id === id);
    const def = petitionById(id);
    const o = def?.options[option];
    if (at < 0 || def === undefined || o === undefined) return false;
    const cost = this.optionCost(o, population);
    if (cost > 0 && !budget.spend(cost)) return false;
    if (cost < 0) budget.credit(-cost);
    this.inbox.splice(at, 1);
    this.applyOption(def, option, day);
    if (o.scandal !== undefined && this.rand() < o.scandal) {
      this.scandals.push({ day: day + 5 + Math.floor(this.rand() * 10),
        text: 'Papers seen by the Herald show the riverside planning deal was waved through in a week. The opposition wants an inquiry.' });
    }
    news.print(day, 'politics', option === 0 ? 'good' : 'flat',
      `${def.title}: City Hall says ${option === 0 ? 'yes' : 'no'}`,
      `${o.label}. ${o.says}.`);
    this.refreshExtras(policies);
    this.mood = this.moodNow();
    this.version++;
    return true;
  }

  private applyOption(def: PetitionDef, option: number, day: number): void {
    const o = def.options[option];
    for (let b = 0; b < BLOC_COUNT; b++) this.memory[b] += o.blocs[BLOCS[b].id] ?? 0;
    if (o.days !== undefined) {
      this.temps.push({ until: day + o.days, mood: o.mood ?? 0, apply: o.apply, price: o.price,
        src: def.id, option });
    }
  }

  // ---- projects --------------------------------------------------------------

  /** Why a project cannot start now, or null if it can. */
  projectBlocked(id: string, population: number): string | null {
    const def = projectById(id);
    if (def === undefined) return 'No such project';
    if (!this.open) return 'The council has not sat yet';
    if (this.finished.includes(id)) return 'Completed';
    if (this.project !== null) return 'Another project is under way';
    if (population < def.minPop) return `Needs ${def.minPop.toLocaleString()} residents`;
    if (this.capital < def.capital) return 'Not enough political capital';
    return null;
  }

  startProject(id: string, day: number, population: number, policies: Policies, news: Newsroom): boolean {
    const def = projectById(id);
    if (def === undefined || this.projectBlocked(id, population) !== null) return false;
    this.capital -= def.capital;
    this.project = { id, started: day, until: day + def.weeks * 7 };
    news.print(day, 'city', 'flat', `Work begins on the ${def.name}`,
      `${def.summary} Due in ${def.weeks} weeks.`);
    this.refreshExtras(policies);
    this.version++;
    return true;
  }

  /** Abandons the project under way. What was spent is gone. */
  cancelProject(day: number, policies: Policies, news: Newsroom): boolean {
    const p = this.project;
    if (p === null) return false;
    const def = projectById(p.id);
    this.project = null;
    for (let b = 0; b < BLOC_COUNT; b++) this.memory[b] -= 0.02;
    news.print(day, 'city', 'bad', `${def?.name ?? 'Project'} abandoned`,
      'The money already spent is gone, and the voters noticed.');
    this.refreshExtras(policies);
    this.version++;
    return true;
  }

  // ---- saving ----------------------------------------------------------------

  saved(): unknown {
    return {
      open: this.open, share: [...this.share], approval: [...this.approval], memory: [...this.memory],
      sore: [...this.sore], protesting: [...this.protesting], seats: this.seats, votes: this.votes,
      nextElection: this.nextElection, elections: this.elections, capital: this.capital,
      laws: this.laws, pending: this.pending, record: this.record, cooldown: [...this.cooldown],
      inbox: this.inbox, nextPetition: this.nextPetition, stepped: this.stepped,
      temps: this.temps.map((t) => ({ until: t.until, src: t.src, option: t.option })),
      scandals: this.scandals, seed: this.seed,
      project: this.project, finished: this.finished,
    };
  }

  restore(raw: unknown, policies: Policies): void {
    const r = (raw ?? {}) as Record<string, unknown>;
    const nums = (v: unknown, into: Float64Array | Uint8Array): void => {
      if (!Array.isArray(v)) return;
      for (let i = 0; i < into.length && i < v.length; i++) if (typeof v[i] === 'number') into[i] = v[i];
    };
    const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    this.open = r.open === true;
    nums(r.share, this.share); nums(r.approval, this.approval); nums(r.memory, this.memory);
    nums(r.sore, this.sore); nums(r.protesting, this.protesting);
    const six = (v: unknown): number[] | null => (Array.isArray(v) && v.length === 6
      && v.every((x) => typeof x === 'number') ? v as number[] : null);
    this.seats = six(r.seats) ?? [0, 0, 0, 0, 0, 0];
    this.votes = six(r.votes) ?? [0, 0, 0, 0, 0, 0];
    this.nextElection = num(r.nextElection, 0);
    this.elections = num(r.elections, 0);
    this.capital = clamp(num(r.capital, 20), 0, CAPITAL_MAX);
    this.laws = Array.isArray(r.laws)
      ? (r.laws as Law[]).filter((l) => typeof l?.id === 'string' && billById(l.id) !== undefined) : [];
    const pe = r.pending as Pending | null | undefined;
    this.pending = pe && typeof pe.id === 'string' && billById(pe.id) !== undefined ? pe : null;
    this.record = Array.isArray(r.record) ? (r.record as Division[]).slice(0, 30) : [];
    this.cooldown.clear();
    if (Array.isArray(r.cooldown)) {
      for (const e of r.cooldown as unknown[]) {
        if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number') this.cooldown.set(e[0], e[1]);
      }
    }
    this.inbox = Array.isArray(r.inbox)
      ? (r.inbox as OpenPetition[]).filter((p) => typeof p?.id === 'string' && petitionById(p.id) !== undefined) : [];
    this.nextPetition = num(r.nextPetition, 3);
    this.stepped = typeof r.stepped === 'number' && Number.isFinite(r.stepped) ? r.stepped : null;
    this.temps = [];
    if (Array.isArray(r.temps)) {
      for (const t of r.temps as { until: number; src: string; option: number }[]) {
        const o = petitionById(t?.src)?.options[t?.option];
        if (o === undefined || typeof t.until !== 'number') continue;
        this.temps.push({ until: t.until, mood: o.mood ?? 0, apply: o.apply, price: o.price, src: t.src, option: t.option });
      }
    }
    this.scandals = Array.isArray(r.scandals) ? (r.scandals as { day: number; text: string }[]) : [];
    this.seed = num(r.seed, 0xc0417);
    const pr = r.project as Running | null | undefined;
    this.project = pr && typeof pr.id === 'string' && projectById(pr.id) !== undefined
      && typeof pr.until === 'number' ? pr : null;
    this.finished = Array.isArray(r.finished)
      ? (r.finished as unknown[]).filter((x): x is string => typeof x === 'string' && projectById(x) !== undefined) : [];
    // Re-seeded from where the save stood, so the inbox after a load goes on as it would have.
    this.rand = mulberry(this.seed + Math.max(0, this.stepped ?? 0) * 7919);
    this.refreshExtras(policies);
    this.mood = this.moodNow();
    this.version++;
  }
}
