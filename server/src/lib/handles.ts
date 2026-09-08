export function normalizeInstagramHandle(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let value = input.trim();
  if (!value) return null;

  value = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  value = value.replace(/^instagram\.com\//i, '');
  value = value.replace(/^@/, '');
  value = value.split(/[/?#]/)[0].trim().toLowerCase();

  // Instagram usernames: letters, numbers, periods, underscores. Keep exact punctuation.
  if (!/^[a-z0-9._]{1,30}$/.test(value)) return null;
  return value;
}

export function instagramUrl(handle: string) {
  return `https://www.instagram.com/${handle}/`;
}
