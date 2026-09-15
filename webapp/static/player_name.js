export function normalizePlayerName(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFC').trim().replace(/ +/g, ' ');
  if (!name || [...name].length > 16 || !/^[\p{L}\p{N} _.-]+$/u.test(name)) return null;
  return name;
}
