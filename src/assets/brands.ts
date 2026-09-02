/**
 * Fictional businesses.
 *
 * Invented rather than borrowed: real chains' names and marks are trademarks,
 * and what a city builder actually needs is a recognisable *kind* of place --
 * a burger bar, a pharmacy, a hardware store -- not a specific one. A brand is
 * a colour pair and a sign style, which is enough for one shopfront generator
 * to produce visibly different businesses.
 *
 * Colours are linear-ish and deliberately a little desaturated: signage that is
 * fully saturated reads as plastic under this lighting, and a street of them
 * reads as a toy.
 */

import type { Brand } from './types';

export const BRANDS: Record<string, Brand> = {
  burger: { name: 'Ridgeway Burger', colour: [0.62, 0.13, 0.11], accent: [0.72, 0.55, 0.14], sign: 'pylon' },
  coffee: { name: 'Meridian Coffee', colour: [0.12, 0.28, 0.20], accent: [0.66, 0.58, 0.42], sign: 'blade' },
  noodle: { name: 'Golden Crane', colour: [0.58, 0.16, 0.20], accent: [0.72, 0.60, 0.22], sign: 'fascia' },
  grocer: { name: 'Vale Market', colour: [0.16, 0.34, 0.22], accent: [0.68, 0.62, 0.38], sign: 'fascia' },
  pharmacy: { name: 'Alder Pharmacy', colour: [0.14, 0.30, 0.48], accent: [0.70, 0.72, 0.74], sign: 'box' },
  hardware: { name: 'Keel & Sons', colour: [0.52, 0.31, 0.10], accent: [0.30, 0.30, 0.31], sign: 'fascia' },
  diner: { name: 'Route 9 Diner', colour: [0.66, 0.20, 0.16], accent: [0.72, 0.72, 0.70], sign: 'blade' },
  bank: { name: 'Harrow Trust', colour: [0.16, 0.22, 0.36], accent: [0.60, 0.52, 0.24], sign: 'box' },
  bookshop: { name: 'Pemberly Books', colour: [0.30, 0.16, 0.28], accent: [0.62, 0.56, 0.40], sign: 'blade' },
  electronics: { name: 'Cobalt Electric', colour: [0.13, 0.34, 0.46], accent: [0.66, 0.68, 0.70], sign: 'fascia' },
  bakery: { name: 'Fenn Bakehouse', colour: [0.50, 0.34, 0.16], accent: [0.68, 0.62, 0.48], sign: 'fascia' },
  butcher: { name: 'Halloran Meats', colour: [0.48, 0.14, 0.16], accent: [0.72, 0.68, 0.56], sign: 'fascia' },
  florist: { name: 'Wren & Fern', colour: [0.20, 0.38, 0.26], accent: [0.74, 0.60, 0.62], sign: 'blade' },
  barber: { name: 'Castle Row Barbers', colour: [0.14, 0.20, 0.30], accent: [0.72, 0.30, 0.26], sign: 'blade' },
  launderette: { name: 'Tidewash', colour: [0.16, 0.40, 0.44], accent: [0.74, 0.74, 0.70], sign: 'fascia' },
  optician: { name: 'Larkin Optical', colour: [0.24, 0.20, 0.42], accent: [0.70, 0.66, 0.50], sign: 'box' },
  toyshop: { name: 'Bramble Toys', colour: [0.62, 0.34, 0.10], accent: [0.30, 0.52, 0.60], sign: 'fascia' },
  furniture: { name: 'Oakhaven Interiors', colour: [0.34, 0.28, 0.22], accent: [0.66, 0.58, 0.42], sign: 'fascia' },
  clothes: { name: 'Marlowe & Vance', colour: [0.26, 0.16, 0.22], accent: [0.70, 0.64, 0.46], sign: 'blade' },
  sports: { name: 'Northgate Sports', colour: [0.14, 0.26, 0.46], accent: [0.72, 0.56, 0.16], sign: 'fascia' },
  cinema: { name: 'The Rialto', colour: [0.36, 0.12, 0.24], accent: [0.74, 0.62, 0.24], sign: 'pylon' },
  brewery: { name: 'Copperline Ales', colour: [0.42, 0.26, 0.12], accent: [0.68, 0.60, 0.30], sign: 'blade' },
  garden: { name: 'Thornhill Garden', colour: [0.18, 0.36, 0.20], accent: [0.62, 0.50, 0.34], sign: 'fascia' },
  motors: { name: 'Redgate Motors', colour: [0.20, 0.22, 0.26], accent: [0.70, 0.44, 0.12], sign: 'pylon' },
  supermarket: { name: 'Fairholm', colour: [0.14, 0.32, 0.50], accent: [0.72, 0.66, 0.24], sign: 'box' },
  deli: { name: 'Salter & Rye', colour: [0.44, 0.32, 0.14], accent: [0.66, 0.62, 0.50], sign: 'fascia' },
  petshop: { name: 'Brindle Pets', colour: [0.30, 0.34, 0.16], accent: [0.70, 0.58, 0.36], sign: 'fascia' },
  music: { name: 'Vessel Records', colour: [0.22, 0.16, 0.30], accent: [0.66, 0.60, 0.42], sign: 'blade' },
  travel: { name: 'Aldermarsh Travel', colour: [0.12, 0.32, 0.42], accent: [0.72, 0.62, 0.28], sign: 'box' },
  // Offices are firms, not shops: no awning, no shopfront, a name on the wall.
  legal: { name: 'Harrow & Voss', colour: [0.18, 0.20, 0.28], accent: [0.62, 0.56, 0.32], sign: 'box' },
  insurer: { name: 'Sable Mutual', colour: [0.14, 0.26, 0.34], accent: [0.66, 0.60, 0.40], sign: 'box' },
  media: { name: 'Kestrel Media', colour: [0.34, 0.14, 0.26], accent: [0.70, 0.64, 0.38], sign: 'blade' },
  engineering: { name: 'Thackeray Engineering', colour: [0.22, 0.28, 0.32], accent: [0.68, 0.58, 0.20], sign: 'fascia' },
  software: { name: 'Northlight Systems', colour: [0.16, 0.30, 0.42], accent: [0.60, 0.68, 0.72], sign: 'box' },
  pharma: { name: 'Verrell Biosciences', colour: [0.16, 0.34, 0.34], accent: [0.68, 0.70, 0.62], sign: 'box' },
  architects: { name: 'Pell & Ridgeway', colour: [0.24, 0.24, 0.26], accent: [0.66, 0.62, 0.50], sign: 'blade' },
  consultancy: { name: 'Ashgrove Partners', colour: [0.20, 0.22, 0.32], accent: [0.64, 0.58, 0.36], sign: 'box' },
  hosting: { name: 'Merrow Data', colour: [0.14, 0.22, 0.30], accent: [0.44, 0.66, 0.72], sign: 'box' },
  studioco: { name: 'Fold & Coil', colour: [0.30, 0.22, 0.16], accent: [0.70, 0.56, 0.30], sign: 'blade' },
  gym: { name: 'Ironworks Gym', colour: [0.20, 0.21, 0.23], accent: [0.64, 0.38, 0.12], sign: 'box' },
  // Industry signs itself too: a name board on the office end is the one thing
  // that tells you a shed belongs to somebody.
  logistics: { name: 'Vance Logistics', colour: [0.16, 0.30, 0.44], accent: [0.72, 0.60, 0.20], sign: 'fascia' },
  works: { name: 'Marlow Works', colour: [0.42, 0.24, 0.12], accent: [0.68, 0.66, 0.62], sign: 'fascia' },
  aggregate: { name: 'Stonefield', colour: [0.36, 0.34, 0.30], accent: [0.72, 0.56, 0.14], sign: 'box' },
  recycle: { name: 'Greenline', colour: [0.16, 0.36, 0.22], accent: [0.70, 0.68, 0.44], sign: 'fascia' },
  timber: { name: 'Ashcroft Timber', colour: [0.34, 0.22, 0.12], accent: [0.64, 0.56, 0.36], sign: 'fascia' },
  // Residential landlords and letting agents put their name on a block too.
  estate: { name: 'Kingsmere', colour: [0.22, 0.26, 0.34], accent: [0.66, 0.58, 0.34], sign: 'box' },
  hotel: { name: 'The Aldermoor', colour: [0.20, 0.16, 0.24], accent: [0.68, 0.58, 0.30], sign: 'box' },
};

export const brandList = Object.values(BRANDS);
