#!/usr/bin/env node
/**
 * Lance `npm test` dans chaque microservice backend, côté hôte (hors
 * conteneur), dans l'ordre, et rapporte en fin d'exécution la liste des
 * services en échec. Nécessite un `npm install --legacy-peer-deps` déjà fait
 * dans chaque service (cf. README B.3).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const services = [
  'auth-service',
  'user-service',
  'event-service',
  'order-service',
  'ticket-service',
  'payment-service',
  'notification-service',
  'pdf-service',
  'admin-service',
  'api-gateway',
];

let failed = [];

for (const service of services) {
  const cwd = path.join(__dirname, '..', 'backend', service);
  console.log(`\n=== ${service} ===`);
  const result = spawnSync('npm', ['test'], { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    failed.push(service);
  }
}

console.log('\n──────────────────────────────');
if (failed.length === 0) {
  console.log('Tous les services : tests OK.');
  process.exit(0);
} else {
  console.log(`Échec des tests pour : ${failed.join(', ')}`);
  process.exit(1);
}
