// =====================================================================
//  DAR ESSALAM — build order
// =====================================================================
function placeWorldTargets() { }
function cityPlan() {
  return [
    ['Drawing the streets of Dar Essalam', buildTownPlan],
    ['Raising the walls, the skala and the gates', () => { townWalls(); skala(); seaGate(); }],
    ['The Great Mosque and its minaret', greatMosque],
    ['The tannery', tanneryYard],
    ['The kasbah', buildKasbah],
    ['Authored houses and interiors', buildInteriors],
    ['Houses, shops and stalls, street by street', buildTownFronts],
    ['Rooftops', buildTownBlocks],
    ['Squares, souks and the harbour', () => { buildTownPlaces(); SEA.add(); }],
  ];
}
