// Icône du marqueur pointée vers le CDN : les chemins relatifs de Leaflet ne survivent pas au bundling.
import L from "leaflet";

const LEAFLET_VERSION = "1.9.4";
const CDN_BASE = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images`;

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${CDN_BASE}/marker-icon-2x.png`,
  iconUrl: `${CDN_BASE}/marker-icon.png`,
  shadowUrl: `${CDN_BASE}/marker-shadow.png`,
});
