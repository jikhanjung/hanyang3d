// Names are compatibility-normalized (full-width letters become ASCII) and limited to Hangul, Han, Latin letters,
// digits and ` _ . -`, so Cyrillic or Greek look-alikes cannot imitate another player's name.
export function normalizePlayerName(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').trim().replace(/ +/g, ' ');
  if (!name || [...name].length > 16 || !/^[\p{Script=Hangul}\p{Script=Han}A-Za-z0-9 _.-]+$/u.test(name)) return null;
  return name;
}
