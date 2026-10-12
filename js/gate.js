// INTERIM deterrent only — NOT real access control.
// Anyone can bypass this by disabling JS, opening DevTools, or fetching
// the site's files directly. The next phase replaces it with the
// Cloudflare Pages edge gate (functions/_middleware.js), which denies
// requests before any file is served.
//
// Privacy: allowed IPs are stored here ONLY as salted SHA-256 hashes, so
// the literal address never appears in this public repo. (A determined
// attacker could still brute-force the IPv4 space or bypass this check
// entirely — hence "deterrent".)
const GATE_SALT = 'mystocks-gate-v1';
const ALLOWED_HASHES = new Set([
  // test workstation (hash added 2026-10-12; plaintext never committed)
  'db759f31bc1e3836b217910edf509427e193e3d67afb747f7077681a751404ec',
]);

async function sha256Hex(text) {
  if (!window.crypto || !crypto.subtle) return null; // non-secure context
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveClientIp() {
  const endpoints = ['https://api.ipify.org?format=json', 'https://ifconfig.me/ip'];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const text = (await res.text()).trim();
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.ip) return String(parsed.ip).trim();
      } catch (e) {
        const firstLine = text.split('\n')[0].trim();
        if (firstLine) return firstLine;
      }
    } catch (e) { /* try next endpoint */ }
  }
  return '';
}

function denyAccess() {
  document.body.innerHTML =
    '<div style="font-family:sans-serif;background:#131722;color:#d1d4dc;' +
    'display:flex;height:100vh;align-items:center;justify-content:center;text-align:center">' +
    '<div><h1>403 — Restricted</h1>' +
    '<p>This dashboard is limited to authorized networks.</p></div></div>';
}

// Resolves true when the visitor may use the app, false when blocked.
// Fail-open on IP-resolution failure (interim gate only): the dashboard
// stays usable if the IP lookup services are down.
window.__accessGate = (async () => {
  try {
    const ip = await resolveClientIp();
    if (!ip) {
      console.warn('[Gate] Could not determine client IP — allowing (fail-open interim gate).');
      return true;
    }
    const hash = await sha256Hex(`${GATE_SALT}:${ip}`);
    if (hash && ALLOWED_HASHES.has(hash)) return true;
    denyAccess();
    return false;
  } catch (err) {
    console.warn('[Gate] Check failed — allowing (fail-open interim gate):', err);
    return true;
  }
})();
