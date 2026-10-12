// Cloudflare Pages Function middleware — IP allowlist gate.
// Runs at the edge BEFORE static assets are served, so it is real
// enforcement (unlike a JS password screen, which ships the files first).
//
// How the allowlist is configured:
//   Cloudflare Pages env var ALLOWED_IPS="1.2.3.4,5.6.0.0/16".
//   No IPs are stored in this repo (it is public). The value is synced
//   from the encrypted GitHub secret ALLOWED_IPS by the
//   "Sync IP allowlist to Cloudflare Pages" workflow
//   (.github/workflows/sync-allowlist.yml). If the env var is
//   missing or empty, ALL requests are denied (fail closed).
//
// IPv4 exact + CIDR ranges are supported. IPv6 is exact-match only
// (residential IPv6 rotates often — prefer IPv4 or a stable office range).

const FALLBACK_IPS = [];

function parseIpv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function cidrContains(cidr, ip) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const baseN = parseIpv4(base);
  const ipN = parseIpv4(ip);
  if (baseN === null || ipN === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (baseN & mask) === (ipN & mask);
}

function entryMatches(entry, ip) {
  entry = entry.trim();
  if (!entry) return false;
  if (entry.includes('/')) return cidrContains(entry, ip);
  return entry === ip;
}

export async function onRequest(context) {
  const { request, env } = context;

  const rawList =
    (env && env.ALLOWED_IPS ? String(env.ALLOWED_IPS) : '').trim() ||
    FALLBACK_IPS.join(',');

  const allowlist = rawList.split(',').map((s) => s.trim()).filter(Boolean);

  // Cloudflare provides the real client IP; fall back for local `wrangler pages dev`.
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';

  const allowed =
    clientIp !== '' && allowlist.some((entry) => entryMatches(entry, clientIp));

  if (allowed) {
    return await context.next();
  }

  return new Response(
    `<!DOCTYPE html><html><head><title>403 Forbidden</title></head>` +
      `<body style="font-family:sans-serif;background:#131722;color:#d1d4dc;` +
      `display:flex;height:100vh;align-items:center;justify-content:center">` +
      `<div><h1>403 — Forbidden</h1>` +
      `<p>Access to this dashboard is restricted by IP allowlist.</p></div>` +
      `</body></html>`,
    {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
