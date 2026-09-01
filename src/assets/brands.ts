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
  gym: { name: 'Ironworks Gym', colour: [0.20, 0.21, 0.23], accent: [0.64, 0.38, 0.12], sign: 'box' },
};

export const brandList = Object.values(BRANDS);
