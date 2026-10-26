/**
 * Ionic Appflow prefers `npm run appflow:build` over `npm run build`.
 *
 * This Capacitor shell loads the live site via capacitor.config `server.url`
 * (webDir is only a fallback / offline page). Running `next build` on Appflow
 * fails without server secrets like JWT_SECRET — and is unnecessary for the
 * native packaging step.
 */
const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..', 'public');
const offline = path.join(webDir, 'offline.html');

if (!fs.existsSync(webDir) || !fs.existsSync(offline)) {
  console.error('[appflow:build] Missing public/ (or public/offline.html). Cap webDir must exist.');
  process.exit(1);
}

console.log('[appflow:build] Skip Next.js build — Capacitor uses remote server.url');
console.log('[appflow:build] webDir ready:', webDir);
process.exit(0);
