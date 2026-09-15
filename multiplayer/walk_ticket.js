import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizePlayerName } from '../webapp/static/player_name.js';

// Walk tickets are issued by the web server for the logged-in account (webapp/walk_ticket.py):
// base64url(JSON {name, exp}) + "." + hex HMAC-SHA256 of the base64 text with the shared secret.
export function makeTicket(name, secret, now = Date.now() / 1000, ttl = 60) {
  const payload = Buffer.from(JSON.stringify({ name, exp: Math.floor(now + ttl) })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyTicket(ticket, secret, now = Date.now() / 1000) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 600) return null;
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra !== undefined || !/^[0-9a-f]{64}$/.test(signature)) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
  try {
    const { name, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(exp) || exp < now) return null;
    return normalizePlayerName(name);
  } catch { return null; }
}
