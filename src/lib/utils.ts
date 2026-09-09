export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

export function timeAgo(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
}

export function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function shortHash(h: string, head = 10, tail = 8): string {
  if (!h) return '—';
  if (h.length <= head + tail + 3) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export async function sha256Hex(input: ArrayBuffer | string): Promise<string> {
  const buf: BufferSource = typeof input === 'string' ? new TextEncoder().encode(input) : (input as ArrayBuffer);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256Hex(buf);
}

export function deterministicHash(seed: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0xdeadbeef, h4 = 0x41c6ce57;
  const s = String(seed);
  let out = '';
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i) + round * 31 + i;
      h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ (c * 31), 16777619);
      h3 ^= Math.imul(c ^ h1, 2654435761); h4 ^= Math.imul(c ^ h2, 2246822519);
    }
    h1 = (h1 << 13) | (h1 >>> 19); h2 = (h2 << 7) | (h2 >>> 25);
    out += ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
    const t = h1; h1 = h3; h3 = h4; h4 = t;
  }
  return out.slice(0, 64);
}

export function makeTxId(seed: string): string {
  return 'TX-' + deterministicHash('tx' + seed).toUpperCase().slice(0, 8);
}

export async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); return true;
    } catch { return false; }
  }
}

export function initials(name: string): string {
  return String(name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
