import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/loadEnv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// run from INVT
const INVT = "C:/Users/64275/Projects/INVT";
const PORT = "5098";
const DATA = path.join(INVT, ".data-regtest-starve3");
fs.mkdirSync(DATA, { recursive: true });
for (const f of fs.readdirSync(DATA)) {
  if (f.endsWith(".json") || f.endsWith(".log")) {
    try { fs.unlinkSync(path.join(DATA, f)); } catch {}
  }
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: INVT,
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT,
    BW_DATA_DIR: DATA,
    BW_ADMIN_KEY: process.env.BW_ADMIN_KEY || "bookawaka-admin-2026",
    BW_SKIP_ZONE_SYNC_BEFORE_HEAL: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d.toString()));
server.stderr.on("data", (d) => (log += d.toString()));

async function waitReady() {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/dev/loadtest/status`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("server not ready\n" + log.slice(-2000));
}

try {
  await waitReady();
  console.log("server ready");
  const test = spawn(
    process.execPath,
    ["--test", "--test-concurrency=1", "--test-timeout=180000", "tests/regression/auto-dispatch-skip-unofferable.test.mjs"],
    {
      cwd: INVT,
      env: {
        ...process.env,
        NODE_ENV: "test",
        REGRESSION_BASE_URL: `http://127.0.0.1:${PORT}`,
        BW_DATA_DIR: DATA,
        BW_ADMIN_KEY: process.env.BW_ADMIN_KEY || "bookawaka-admin-2026",
        BW_SKIP_ZONE_SYNC_BEFORE_HEAL: "1",
        NODE_TEST_TIMEOUT: "180000",
      },
      stdio: "inherit",
    },
  );
  const code = await new Promise((resolve) => test.on("close", resolve));
  process.exitCode = code ?? 1;
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  try { server.kill("SIGTERM"); } catch {}
}
