// Lightweight wrapper around Chrome's on-device Translator API.
// Supports both window.ai.translator (new) and globalThis.Translator (old).
// Normalizes availability and exposes a simple translate(text, target) API.

export type TAvailability = "available" | "downloadable" | "unavailable";

function mapNewAvailability(a: any): TAvailability {
  if (a === "readily") return "available";
  if (a === "after-download") return "downloadable";
  return "unavailable";
}
function mapOldAvailability(a: any): TAvailability {
  if (a === "available") return "available";
  if (a === "downloadable") return "downloadable";
  return "unavailable";
}

export async function getTranslatorAvailability(
  targetLanguage?: string,
  sourceLanguage?: string
): Promise<TAvailability> {
  if (typeof window === "undefined") return "unavailable";
  const w = window as any;
  try {
    if (w.ai?.translator && typeof w.ai.translator.availability === "function") {
      const a = await w.ai.translator.availability();
      return mapNewAvailability(a);
    }
  } catch {}
  try {
    const T = (globalThis as any).Translator;
    if (T && typeof T.availability === "function") {
      // Old API may require explicit languages. Prefer provided pair; otherwise probe.
      if (targetLanguage || sourceLanguage) {
        const a = await T.availability({ sourceLanguage, targetLanguage });
        return mapOldAvailability(a);
      }
      try {
        const a = await T.availability();
        return mapOldAvailability(a);
      } catch {
        try {
          const a = await T.availability({ targetLanguage: "en" });
          return mapOldAvailability(a);
        } catch {
          return "unavailable";
        }
      }
    }
  } catch {}
  return "unavailable";
}

export async function translate(
  text: string,
  targetLanguage: string,
  sourceLanguageOrOnProgress?: string | ((loaded: number, total: number) => void),
  maybeOnProgress?: (loaded: number, total: number) => void
): Promise<string> {
  if (typeof window === "undefined") throw new Error("Translator can only run in the browser");
  const w = window as any;

  // Back-compat: allow translate(text, target, onProgress)
  let sourceLanguage: string | undefined;
  let onProgress: ((loaded: number, total: number) => void) | undefined;
  if (typeof sourceLanguageOrOnProgress === "function") {
    onProgress = sourceLanguageOrOnProgress as any;
    sourceLanguage = undefined; // default later
  } else {
    sourceLanguage = sourceLanguageOrOnProgress as string | undefined;
    onProgress = maybeOnProgress;
  }
  if (!sourceLanguage) sourceLanguage = "auto";

  // New API
  if (w.ai?.translator) {
    const avail = await getTranslatorAvailability(targetLanguage, sourceLanguage);
    if (avail === "unavailable") throw new Error("Translator unavailable. Enable on-device AI or update Chrome.");
    const t = await w.ai.translator.create({
      sourceLanguage,
      targetLanguage,
      format: "markdown"
    } as any);
    const result = await t.translate(text);
    return typeof result === "string" ? result : String(result ?? "");
  }

  // Old API
  const T = (globalThis as any).Translator;
  if (T) {
    const avail = await getTranslatorAvailability(targetLanguage, sourceLanguage);
    if (avail === "unavailable") throw new Error("Translator unavailable. Enable on-device AI or update Chrome.");

    let handler: any = null;
    if (onProgress && typeof T.addEventListener === "function") {
      handler = (e: any) => {
        const loaded = Number((e && (e.loaded ?? e.detail?.loaded)) || 0);
        const total = Number((e && (e.total ?? e.detail?.total)) || 0);
        onProgress(loaded, total);
      };
      try { T.addEventListener("downloadprogress", handler); } catch {}
    }

    try {
      const t = await T.create({
        sourceLanguage,
        targetLanguage,
        format: "markdown"
      });
      const result = await t.translate(text);
      return typeof result === "string" ? result : String(result ?? "");
    } finally {
      if (handler && typeof T.removeEventListener === "function") {
        try { T.removeEventListener("downloadprogress", handler); } catch {}
      }
    }
  }

  throw new Error("Chrome on-device Translator API is not supported in this browser.");
}
