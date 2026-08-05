/** Parse Vite hashed asset URLs from index.html (or /api/spa-version HTML scrape). */
export function parseSpaAssetUrlsFromHtml(html: string): { assetJs: string; assetCss: string } {
  const js = html.match(/\/assets\/index-[^"'>\s]+\.js/)?.[0] ?? '';
  const css = html.match(/\/assets\/index-[^"'>\s]+\.css/)?.[0] ?? '';
  return { assetJs: js, assetCss: css };
}

/** Normalize script src (absolute or path) to pathname for comparison. */
export function normalizeSpaAssetPath(src: string): string {
  const raw = String(src || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, 'https://spa.local').pathname;
  } catch {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

export function spaAssetMismatch(loadedJs: string, serverJs: string): boolean {
  const a = normalizeSpaAssetPath(loadedJs);
  const b = normalizeSpaAssetPath(serverJs);
  return !!a && !!b && a !== b;
}

export function readLoadedSpaModuleSrc(
  doc: Pick<Document, 'querySelector'> = document,
): string {
  const el = doc.querySelector('script[type="module"][src*="/assets/"]');
  return el?.getAttribute('src') || '';
}

export type SpaVersionResponse = {
  ok?: boolean;
  assetJs?: string;
  assetCss?: string;
  buildId?: string;
};

export async function fetchSpaVersion(
  fetchImpl: typeof fetch = fetch,
): Promise<SpaVersionResponse | null> {
  try {
    const res = await fetchImpl('/api/spa-version', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    return (await res.json()) as SpaVersionResponse;
  } catch {
    return null;
  }
}
