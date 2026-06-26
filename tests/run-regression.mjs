#!/usr/bin/env node
/**
 * Regression test runner — spawns an isolated server, runs Phase 0+1 suites, reports pass/fail counts.
 *
 * Usage: npm run test:regression
 * Requires: BW_FIREBASE_SECRET (in env or .env), Node 20+
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

function parseTapSummary(output) {
  const tests = output.match(/^# tests (\d+)/m);
  const pass = output.match(/^# pass (\d+)/m);
  const fail = output.match(/^# fail (\d+)/m);
  return {
    total: tests ? Number(tests[1]) : null,
    passed: pass ? Number(pass[1]) : null,
    failed: fail ? Number(fail[1]) : null,
  };
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
    console.error('\n✗ BW_FIREBASE_SECRET is required for regression tests (Firebase sync assertions).');
    console.error('  Set it in the environment or in a .env file at the repo root.\n');
    process.exit(1);
  }

  prepareDataDir();

  const serverEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT,
    BW_DATA_DIR: TEST_DATA_DIR,
    BW_ADMIN_KEY: process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026',
  };

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  INVT Regression Suite — Phase 0 through Phase 3');
  console.log(`  Server: ${BASE}  DATA_DIR: ${TEST_DATA_DIR}`);
  console.log('══════════════════════════════════════════════════════════\n');

  const server = spawn(process.execPath, ['server.js'], {
    cwd: REPO_ROOT,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d.toString()));
  server.stderr.on('data', (d) => (serverLog += d.toString()));

  const killServer = () => {
    if (!server.killed) {
      try {
        server.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  };
  process.on('exit', killServer);
  process.on('SIGINT', () => {
    killServer();
    process.exit(130);
  });

  try {
    await waitForServer();
    console.log('✓ Test server ready\n');

    const testEnv = {
      ...serverEnv,
      REGRESSION_BASE_URL: BASE,
      NODE_TEST_TIMEOUT: '180000',
    };

    const regressionDir = path.join(__dirname, 'regression');
    const testFiles = fs
      .readdirSync(regressionDir)
      .filter((name) => name.endsWith('.test.mjs'))
      .sort()
      .map((name) => path.join(regressionDir, name));

    let tapOutput = '';
    const testProc = spawn(
      process.execPath,
      ['--test', '--test-concurrency=1', '--test-reporter=tap', ...testFiles],
      {
        cwd: REPO_ROOT,
        env: testEnv,
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );

    testProc.stdout.on('data', (d) => {
      const chunk = d.toString();
      tapOutput += chunk;
      process.stdout.write(chunk);
    });

    const exitCode = await new Promise((resolve) => {
      testProc.on('close', (code) => resolve(code ?? 1));
    });

    const summary = parseTapSummary(tapOutput);
    const total = summary.total ?? '?';
    const passed = summary.passed ?? '?';
    const failed = summary.failed ?? '?';

    console.log('\n══════════════════════════════════════════════════════════');
    if (exitCode === 0 && summary.total != null) {
      console.log(`  Regression: ${passed}/${total} passed (Phase 0–3)`);
      console.log('  Firebase sync assertions: included');
    } else if (summary.total != null) {
      console.log(`  Regression: ${passed}/${total} passed, ${failed} failed`);
    } else {
      console.log(`  Regression: FAILED (exit ${exitCode})`);
    }
    if (exitCode !== 0 && serverLog) {
      console.log('\n--- server log (tail) ---');
      console.log(serverLog.slice(-4000));
    }
    console.log('══════════════════════════════════════════════════════════\n');

    process.exitCode = exitCode;
  } catch (e) {
    console.error('Regression runner error:', e.message);
    console.error(serverLog.slice(-4000));
    process.exitCode = 1;
  } finally {
    killServer();
  }
}

main();
