// Bug connu de Leaflet avec les bundlers (webpack/Turbopack) : l'icône par
// défaut du marqueur référence ses images via des chemins relatifs calculés
// à l'exécution (`_getIconUrl`), qui ne survivent jamais au bundling — le
// marqueur s'affiche comme un rectangle cassé sans ce correctif. Pointer
// directement vers le CDN évite toute dépendance au chargement d'assets
// statiques du bundler pour un fichier qui vit dans node_modules.
import L from "leaflet";

const LEAFLET_VERSION = "1.9.4";
const CDN_BASE = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images`;

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${CDN_BASE}/marker-icon-2x.png`,
  iconUrl: `${CDN_BASE}/marker-icon.png`,
  shadowUrl: `${CDN_BASE}/marker-shadow.png`,
});
