// Constantes géographiques partagées entre le centrage par défaut de la
// carte (location-picker-inner.tsx) et le biais de recherche d'adresse
// (photon.ts) — la plateforme est actuellement 100% française (le champ
// "Pays" du formulaire événement défaut déjà à "France", CDC ciblant le
// marché français). Une seule source pour ces coordonnées, plutôt que de
// dupliquer les mêmes chiffres dans deux fichiers.
export const FRANCE_CENTER: [number, number] = [46.6034, 1.8883];

// [minLon, minLat, maxLon, maxLat] — France métropolitaine + Corse. Une
// bbox reste un rectangle, jamais un contour de frontière réel : un point
// proche de la frontière belge/suisse/italienne peut donc encore y entrer,
// c'est attendu (et pas forcément indésirable pour un lieu limitrophe).
export const FRANCE_BBOX = "-5.5,41.2,9.8,51.3";
