const CHUNK_RELOAD_STORAGE_KEY = "scampagnate:chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
];

export const isChunkLoadError = (error: unknown) => {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const details = `${name} ${message}`;

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(details));
};

export const reloadOnceForChunkError = (error: unknown) => {
  if (!isChunkLoadError(error) || typeof window === "undefined") return false;

  try {
    const now = Date.now();
    const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    if (Number.isFinite(lastReload) && now - lastReload < CHUNK_RELOAD_WINDOW_MS) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // Storage can be unavailable in some privacy modes; a single reload is still safer than a blank screen.
  }

  window.location.reload();
  return true;
};
