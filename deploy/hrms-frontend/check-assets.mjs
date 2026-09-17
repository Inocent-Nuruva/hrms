// Run against the Next.js origin, then the public origin to check proxy routing.
async function checkResponse(url, contentType) {
  const response = await fetch(url, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !contentType.test(type)) {
    await response.body?.cancel();
    throw new Error(`${url}: HTTP ${response.status}, Content-Type: ${type || "missing"}`);
  }
  const body = await response.text();
  if (!body.length) throw new Error(`${url}: empty response`);
  return body;
}

try {
  if (!process.argv[2]) throw new Error("Usage: node check-assets.mjs <origin>");
  const base = new URL(process.argv[2]);
  const assets = new Map();
  // Exercise both Pages Router and App Router build outputs.
  for (const path of ["/login", "/offline"]) {
    const pageUrl = new URL(path, base);
    const html = await checkResponse(pageUrl, /^text\/html\b/i);
    const pageAssets = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1].replaceAll("&amp;", "&"), pageUrl))
      .filter((url) => url.pathname.startsWith("/_next/static/") && /\.(js|css)$/.test(url.pathname));
    if (!pageAssets.some((url) => url.pathname.endsWith(".js")) ||
        !pageAssets.some((url) => url.pathname.endsWith(".css"))) {
      throw new Error(`${pageUrl}: expected Next.js JavaScript and CSS references`);
    }
    for (const url of pageAssets) {
      assets.set(url.href, url.pathname.endsWith(".css")
        ? /^text\/css\b/i
        : /^(?:application|text)\/(?:javascript|x-javascript|ecmascript)\b/i);
    }
  }
  assets.set(new URL("/icon.png", base).href, /^image\/png\b/i);
  assets.set(new URL("/assets/alliance-logo.png", base).href, /^image\/png\b/i);
  assets.set(new URL("/favicon.ico", base).href, /^image\/(?:x-icon|vnd\.microsoft\.icon)\b/i);
  for (const [url, type] of assets) await checkResponse(url, type);
  console.log(`Asset check passed: both pages and ${assets.size} assets at ${base.origin}`);
} catch (error) {
  console.error(`Asset check failed: ${error.message}`);
  process.exitCode = 1;
}
