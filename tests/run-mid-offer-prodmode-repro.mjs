/**
 * Production-mode mid-offer reproduction (NODE_ENV !== 'test' so Firebase sync RUNS).
 *
 * Simulates:
 * A) Phone stamps Firebase every 5s + heal-after-sync every 2s  → should NOT bounce
 * B) No phone stamps + heal-after-sync every 2s                 → SHOULD bounce (ZONE ages)
 * C) Phone stamps + heal-NO-sync every 2s                       → SHOULD bounce (old race)
 *
 * Usage (from INVT, needs BW_FIREBASE_SECRET):
 *   node tests/run-mid-offer-prodmode-repro.mjs
 */
import './lib/loadEnv.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DATA_DIR, REPO_ROOT } from './lib/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.REGRESSION_PORT || '5101';
const BASE = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxMs = 60000) {
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

function prepareDataDir() {
  const dir = path.join(REPO_ROOT, '.data-prodmode-repro');
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.json')) {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
  return dir;
}

async function main() {
  if (!process.env.BW_FIREBASE_SECRET) {
    console.error('BW_FIREBASE_SECRET required');
    process.exit(1);
  }
  const dataDir = prepareDataDir();
  // NOT test — so _healStuckOfferedJobsAfterFirebaseSync actually syncs.
  const serverEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PORT,
    BW_DATA_DIR: dataDir,
    BW_ADMIN_KEY: process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026',
    // Isolate from production Firebase hydrate + 6s auto-dispatch heal storms.
    BW_DISABLE_SERVER_AUTO_DISPATCH: '1',
    BW_DISABLE_JOBSTORE_HYDRATE: '1',
  };

  const server = spawn(process.execPath, ['server.js'], {
    cwd: REPO_ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  const onData = (d) => {
    const s = d.toString();
    serverLog += s;
    process.stdout.write(s);
  };
  server.stdout.on('data', onData);
  server.stderr.on('data', onData);

  try {
    await waitForServer();
    console.log('\n=== PROD-MODE mid-offer repro (NODE_ENV=development, sync ENABLED) ===\n');
    const test = spawn(
      process.execPath,
      ['--test', 'tests/reproduce-mid-offer-prodmode.mjs'],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          REGRESSION_BASE_URL: BASE,
          NODE_ENV: 'development',
        },
        stdio: 'inherit',
      },
    );
    const code = await new Promise((resolve) => test.on('close', resolve));
    const lines = serverLog.split('\n').filter((l) =>
      /mid-offer|MID-OFFER|AfterFirebaseSync|zone sync before heal|heal-no-sync|sync-then-heal|PRODMODE/i.test(
        l,
      ),
    );
    console.log('\n=== Filtered server log ===');
    for (const l of lines.slice(-120)) console.log(l);
    process.exit(code || 0);
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
