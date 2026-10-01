#!/usr/bin/env node
/** Exécute migration:run dans chaque service qui a sa base (les 7 bases doivent tourner). */
const { spawnSync } = require('child_process');
const path = require('path');

const servicesWithDb = [
  'auth-service',
  'user-service',
  'event-service',
  'order-service',
  'ticket-service',
  'payment-service',
  'admin-service',
];

let failed = [];

for (const service of servicesWithDb) {
  const cwd = path.join(__dirname, '..', 'backend', service);
  console.log(`\n=== ${service} ===`);
  const result = spawnSync('npm', ['run', 'migration:run'], { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    failed.push(service);
  }
}

console.log('\n──────────────────────────────');
if (failed.length === 0) {
  console.log('Migrations appliquées avec succès sur tous les services.');
  process.exit(0);
} else {
  console.log(`Échec de migration pour : ${failed.join(', ')}`);
  process.exit(1);
}
