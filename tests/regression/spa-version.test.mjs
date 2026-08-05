/**
 * SPA version mismatch detector — keeps long-lived dispatch tabs from running stale parsers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function parseSpaAssetUrlsFromHtml(html) {
  const js = html.match(/\/assets\/index-[^"'>\s]+\.js/)?.[0] ?? '';
  const css = html.match(/\/assets\/index-[^"'>\s]+\.css/)?.[0] ?? '';
  return { assetJs: js, assetCss: css };
}

function normalizeSpaAssetPath(src) {
  const raw = String(src || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, 'https://spa.local').pathname;
  } catch {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

function spaAssetMismatch(loadedJs, serverJs) {
  const a = normalizeSpaAssetPath(loadedJs);
  const b = normalizeSpaAssetPath(serverJs);
  return !!a && !!b && a !== b;
}

test('parseSpaAssetUrlsFromHtml extracts Vite hashed assets', () => {
  const html =
    '<script type="module" crossorigin src="/assets/index-Abc123.js"></script>' +
    '<link rel="stylesheet" href="/assets/index-XyZ.css">';
  const parsed = parseSpaAssetUrlsFromHtml(html);
  assert.equal(parsed.assetJs, '/assets/index-Abc123.js');
  assert.equal(parsed.assetCss, '/assets/index-XyZ.css');
});

test('spaAssetMismatch detects different hashes', () => {
  assert.equal(
    spaAssetMismatch('/assets/index-Old.js', '/assets/index-New.js'),
    true,
  );
  assert.equal(
    spaAssetMismatch(
      'https://invt.example/assets/index-Same.js',
      '/assets/index-Same.js',
    ),
    false,
  );
  assert.equal(spaAssetMismatch('', '/assets/index-New.js'), false);
});

test('server.js exposes /api/spa-version and readSpaAssetManifest', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /urlPath === '\/api\/spa-version'/);
  assert.match(src, /function readSpaAssetManifest/);
  assert.match(src, /Surrogate-Control': 'no-store'/);
});

test('SpaUpdateBanner is wired into App', () => {
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /SpaUpdateBanner/);
  assert.ok(existsSync(join(root, 'src/components/shared/SpaUpdateBanner.tsx')));
  assert.ok(existsSync(join(root, 'src/lib/spaVersion.ts')));
});
