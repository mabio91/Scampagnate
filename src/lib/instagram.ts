export const normalizeInstagramHandle = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  const withoutDomain = withoutProtocol.replace(/^instagram\.com\//i, "");
  const firstPathPart = withoutDomain.split(/[/?#]/)[0] || "";
  const withoutAt = firstPathPart.replace(/^@+/, "").trim().toLowerCase();

  return withoutAt || null;
};

export const isValidInstagramHandle = (handle: string | null) => (
  handle === null || /^[a-z0-9._]{1,30}$/.test(handle)
);

export const instagramProfileUrl = (handle: string) => (
  `https://www.instagram.com/${handle}`
);
