/**
 * Focused runner: driver-payment-company-scope only.
 */
import './lib/loadEnv.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DATA_DIR, REPO_ROOT } from './lib/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.REGRESSION_PORT || '5199';
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(REPO_ROOT, '.data-regtest-pay-scope');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxMs = 45000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/dev/loadtest/status`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  throw new Error(`Server not ready at ${BASE}`);
}

fs.mkdirSync(DATA, { recursive: true });
for (const name of fs.readdirSync(DATA)) {
  if (name.endsWith('.json')) {
    try {
      fs.unlinkSync(path.join(DATA, name));
    } catch {
      /* ignore */
    }
  }
}

if (!process.env.BW_FIREBASE_SECRET) {
  console.error('BW_FIREBASE_SECRET required');
  process.exit(1);
}

const serverEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT,
  BW_DATA_DIR: DATA,
  BW_ADMIN_KEY: process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026',
  BW_SKIP_ZONE_SYNC_BEFORE_HEAL: '1',
};

const server = spawn(process.execPath, ['server.js'], {
  cwd: REPO_ROOT,
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d.toString()));
server.stderr.on('data', (d) => (serverLog += d.toString()));

const kill = () => {
  try {
    server.kill('SIGTERM');
  } catch {
    /* ignore */
  }
};
process.on('exit', kill);

try {
  await waitForServer();
  console.log('server ready');
  const testFile = path.join(__dirname, 'regression/driver-payment-company-scope.test.mjs');
  const testProc = spawn(
    process.execPath,
    ['--test', '--test-concurrency=1', '--test-timeout=120000', '--test-reporter=tap', testFile],
    {
      cwd: REPO_ROOT,
      env: { ...serverEnv, REGRESSION_BASE_URL: BASE, NODE_TEST_TIMEOUT: '120000' },
      stdio: 'inherit',
    },
  );
  const code = await new Promise((resolve) => testProc.on('close', (c) => resolve(c ?? 1)));
  kill();
  process.exit(code);
} catch (e) {
  console.error(e);
  console.error(serverLog.slice(-3000));
  kill();
  process.exit(1);
}
