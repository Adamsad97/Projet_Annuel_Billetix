// Traces techniques lisibles : navigateur et système plutôt que la chaîne brute, IP sans préfixe IPv6.

const BROWSERS: Array<{ name: string; pattern: RegExp }> = [
  // Ordre important : Edge et Opera s'annoncent aussi comme Chrome.
  { name: "Edge", pattern: /Edg(?:e|A|iOS)?\/(\d+)/ },
  { name: "Opera", pattern: /(?:OPR|Opera)\/(\d+)/ },
  { name: "Samsung Internet", pattern: /SamsungBrowser\/(\d+)/ },
  { name: "Firefox", pattern: /(?:Firefox|FxiOS)\/(\d+)/ },
  { name: "Chrome", pattern: /(?:Chrome|CriOS)\/(\d+)/ },
  { name: "Safari", pattern: /Version\/(\d+)[\d.]* .*Safari/ },
];

const SYSTEMS: Array<{ name: string; pattern: RegExp }> = [
  { name: "iPhone", pattern: /iPhone/ },
  { name: "iPad", pattern: /iPad/ },
  { name: "Android", pattern: /Android/ },
  { name: "Windows", pattern: /Windows/ },
  { name: "macOS", pattern: /Mac OS X|Macintosh/ },
  { name: "Linux", pattern: /Linux/ },
];

/** « Chrome 153 sur Windows », ou la désignation courte d'un outil non navigateur. */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Non renseigné";
  const browser = BROWSERS.map(({ name, pattern }) => {
    const match = pattern.exec(userAgent);
    return match ? `${name} ${match[1]}` : null;
  }).find(Boolean);
  const system = SYSTEMS.find(({ pattern }) => pattern.test(userAgent))?.name;
  if (browser) return system ? `${browser} sur ${system}` : browser;
  // Outil ou script (ex. « curl/8.4 ») : son nom, sans la version complète.
  return `Autre application (${userAgent.split(/[\s(]/)[0].slice(0, 40)})`;
}

/** Adresse IP lisible : sans le préfixe « ::ffff: » des adresses IPv4 vues en IPv6. */
export function formatIp(ip: string | null | undefined): string {
  if (!ip) return "Non renseignée";
  return ip.replace(/^::ffff:/i, "");
}
