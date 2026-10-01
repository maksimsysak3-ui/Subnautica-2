/**
 * Family names for the households a building card lists.
 *
 * Not stored: a household's name is drawn from its id and the day it arrived,
 * so it is the same every time the card opens and costs nothing to save. A
 * city of newcomers from everywhere, so the list is drawn from everywhere.
 */

const SURNAMES = [
  'Abbott', 'Adeyemi', 'Ahmed', 'Alvarez', 'Andersen', 'Arslan', 'Baker', 'Banerjee', 'Barros',
  'Becker', 'Bennett', 'Bianchi', 'Brennan', 'Brooks', 'Byrne', 'Campbell', 'Carter', 'Castillo',
  'Chen', 'Clarke', 'Costa', 'Cruz', 'Dang', 'Davies', 'Dimitrov', 'Doyle', 'Dubois', 'Duncan',
  'Edwards', 'Ellis', 'Eriksson', 'Evans', 'Farah', 'Ferreira', 'Fischer', 'Fitzgerald', 'Fleming',
  'Fontaine', 'Foster', 'Garcia', 'Gill', 'Gomez', 'Grant', 'Gray', 'Gupta', 'Haddad', 'Hall',
  'Hansen', 'Harper', 'Hayes', 'Hughes', 'Ibrahim', 'Ivanova', 'Jackson', 'Jansen', 'Jensen',
  'Johnson', 'Kaur', 'Kelly', 'Khan', 'Kim', 'Kowalski', 'Kumar', 'Larsen', 'Laurent', 'Lee',
  'Lewis', 'Lindqvist', 'Lopez', 'Lynch', 'Mahmoud', 'Marsh', 'Martin', 'Mendes', 'Meyer',
  'Mitchell', 'Moreau', 'Morgan', 'Murphy', 'Nakamura', 'Nguyen', 'Nielsen', 'Novak', 'Nowak',
  "O'Brien", 'Okafor', 'Oliveira', 'Olsen', 'Ortiz', 'Owens', 'Park', 'Patel', 'Pereira',
  'Petrov', 'Phillips', 'Popescu', 'Price', 'Quinn', 'Ramirez', 'Reid', 'Reyes', 'Richter',
  'Rossi', 'Russo', 'Ryan', 'Sanchez', 'Santos', 'Sato', 'Schmidt', 'Shah', 'Silva', 'Singh',
  'Sokolov', 'Stewart', 'Suzuki', 'Tanaka', 'Taylor', 'Thompson', 'Torres', 'Tran', 'Turner',
  'Vargas', 'Vasquez', 'Volkov', 'Wagner', 'Walsh', 'Ward', 'Watanabe', 'Weber', 'Wilson',
  'Wong', 'Wright', 'Yamamoto', 'Yilmaz', 'Young', 'Zhang', 'Zielinski',
];

/** The family name of a household. */
export function familyName(household: number, arrived: number): string {
  let h = (household * 2654435761 + arrived * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return SURNAMES[(h >>> 0) % SURNAMES.length];
}
