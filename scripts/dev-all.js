#!/usr/bin/env node
/**
 * Lance les 10 microservices backend en local (npm run start:dev), hors
 * Docker, en une seule commande. Chaque ligne de log est préfixée par le nom
 * du service. Ctrl+C arrête tous les processus enfants.
 *
 * Prérequis par service (cf. README B.2/B.3) : .env local configuré et
 * dépendances installées (`npm install --legacy-peer-deps`).
 */
const { spawn } = require('child_process');
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

const children = [];

function prefixLines(serviceName, chunk, stream) {
  const lines = chunk.toString().split('\n').filter((line) => line.length > 0);
  for (const line of lines) {
    stream.write(`[${serviceName}] ${line}\n`);
  }
}

for (const service of services) {
  const cwd = path.join(__dirname, '..', 'backend', service);
  const child = spawn('npm', ['run', 'start:dev'], { cwd, shell: true });

  child.stdout.on('data', (chunk) => prefixLines(service, chunk, process.stdout));
  child.stderr.on('data', (chunk) => prefixLines(service, chunk, process.stderr));
  child.on('exit', (code) => {
    process.stdout.write(`[${service}] processus terminé (code ${code})\n`);
  });

  children.push(child);
}

function stopAll() {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
