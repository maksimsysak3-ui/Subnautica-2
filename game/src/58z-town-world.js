// =====================================================================
//  DAR ESSALAM — build order
// =====================================================================
function placeWorldTargets() { }
function cityPlan() {
  if (MAP.id === 'seoul') return seoulPlan();
  return [
    ['Drawing the streets of Dar Essalam', buildTownPlan],
    ['Raising the walls, the skala and the gates', () => { townWalls(); skala(); seaGate(); }],
    ['The Great Mosque and its minaret', greatMosque],
    ['The tannery', tanneryYard],
    ['The kasbah', buildKasbah],
    ['Dar el Makhzen, the palace', buildPalace],
    ['Authored houses and interiors', buildInteriors],
    ['Houses, shops and stalls, street by street', buildTownFronts],
    ['Rooftops', buildTownBlocks],
    ['Squares, souks and the harbour', () => { buildTownPlaces(); SEA.add(); }],
  ];
}
