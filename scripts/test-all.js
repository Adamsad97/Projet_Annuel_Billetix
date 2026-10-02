#!/usr/bin/env node
/** Lance npm test dans chaque microservice via docker compose exec et liste les services en échec. */
const { spawnSync } = require('child_process');

const services = [
  'auth-service',
  'user-service',
  'event-service',
  'order-service',
  'ticket-service',
  'payment-service',
  'notification-service',
  'realtime-service',
  'pdf-service',
  'admin-service',
  'api-gateway',
];

let failed = [];

for (const service of services) {
  console.log(`\n=== ${service} ===`);
  const result = spawnSync('docker-compose', ['exec', service, 'npm', 'test'], { stdio: 'inherit', shell: true });
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
