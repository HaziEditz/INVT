#!/usr/bin/env node
/**
 * Spawn isolated test server and run mid-offer ZONE/Firebase race reproduction.
 */
import './lib/loadEnv.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DATA_DIR, REPO_ROOT } from './lib/config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.REGRESSION_PORT || '5099';
const BASE = `http://127.0.0.1:${PORT}`;

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
  throw new Error(`Server did not become ready at ${BASE} within ${maxMs}ms`);
}

function prepareDataDir() {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  for (const name of fs.readdirSync(TEST_DATA_DIR)) {
    if (name.endsWith('.json')) {
      try {
        fs.unlinkSync(path.join(TEST_DATA_DIR, name));
      } catch {
        /* ignore */
      }
    }
  }
}

async function main() {
  if (!process.env.BW_FIREBASE_SECRET) {
    console.error('BW_FIREBASE_SECRET required');
    process.exit(1);
  }
  prepareDataDir();
  const serverEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT,
    BW_DATA_DIR: TEST_DATA_DIR,
    BW_ADMIN_KEY: process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026',
    // Demonstrate ZONE/Firebase split: skip sync + live Firebase recheck.
    BW_SKIP_ZONE_SYNC_BEFORE_HEAL: '1',
  };
  const server = spawn(process.execPath, ['server.js'], {
    cwd: REPO_ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => {
    const s = d.toString();
    serverLog += s;
    process.stdout.write(s);
  });
  server.stderr.on('data', (d) => {
    const s = d.toString();
    serverLog += s;
    process.stderr.write(s);
  });

  try {
    await waitForServer();
    console.log('\n=== Running mid-offer ZONE/Firebase reproduction ===\n');
    const test = spawn(
      process.execPath,
      ['--test', 'tests/reproduce-mid-offer-zone-stale.mjs'],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, REGRESSION_BASE_URL: BASE, NODE_ENV: 'test' },
        stdio: 'inherit',
      },
    );
    const code = await new Promise((resolve) => test.on('close', resolve));
    // Dump relevant server lines
    const lines = serverLog.split('\n').filter((l) => /mid-offer|MID-OFFER|network-stale/i.test(l));
    console.log('\n=== Server mid-offer log lines ===');
    for (const l of lines.slice(-80)) console.log(l);
    process.exit(code || 0);
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
