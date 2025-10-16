// Lightweight wrapper around Chrome's on-device Summarizer API.
// Client-only. Handles feature detection and a first-time download notice.

export type SummarizeResult = { summary: string; firstTimeDownload: boolean };

export type Availability = "available" | "downloadable" | "unavailable";

function mapNewAvailability(a: any): Availability {
  if (a === "readily") return "available";
  if (a === "after-download") return "downloadable";
  return "unavailable";
}

function mapOldAvailability(a: any): Availability {
  if (a === "available") return "available";
  if (a === "downloadable") return "downloadable";
  return "unavailable";
}

export async function getSummarizerAvailability(): Promise<Availability> {
  if (typeof window === "undefined") return "unavailable";
  const w = window as any;
  try {
    if (w.ai?.summarizer && typeof w.ai.summarizer.availability === "function") {
      const a = await w.ai.summarizer.availability();
      return mapNewAvailability(a);
    }
  } catch {}

  try {
    const S = (globalThis as any).Summarizer;
    if (S && typeof S.availability === "function") {
      const a = await S.availability();
      return mapOldAvailability(a);
    }
  } catch {}

  return "unavailable";
}

export async function summarize(
  text: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<SummarizeResult> {
  if (typeof window === "undefined") {
    throw new Error("Summarizer can only run in the browser");
  }
  const w = window as any;

  if (w.ai?.summarizer) {
    const avail = await getSummarizerAvailability();
    if (avail === "unavailable") {
      throw new Error("Summarizer unavailable. Enable on-device AI or update Chrome.");
    }
    const s = await w.ai.summarizer.create({
      type: "tl;dr",
      format: "markdown",
      length: "medium",
      // Provide explicit output language for compliant builds
      language: "en",
      outputLanguage: "en",
    } as any);
    const result = await s.summarize(text);
    const summary = typeof result === "string" ? result : String(result ?? "");
    return { summary, firstTimeDownload: avail === "downloadable" };
  }

  const S = (globalThis as any).Summarizer;
  if (S) {
    const avail = await getSummarizerAvailability();
    if (avail === "unavailable") {
      throw new Error("Summarizer unavailable. Enable on-device AI or update Chrome.");
    }

    let handler: any = null;
    if (onProgress && typeof S.addEventListener === "function") {
      handler = (e: any) => {
        const loaded = Number((e && (e.loaded ?? e.detail?.loaded)) || 0);
        const total = Number((e && (e.total ?? e.detail?.total)) || 0);
        onProgress(loaded, total);
      };
      try {
        S.addEventListener("downloadprogress", handler);
      } catch {}
    }

    try {
      const s = await S.create({
        type: "key-points",
        format: "markdown",
        length: "medium",
        language: "en",
        outputLanguage: "en",
      });
      const result = await s.summarize(text);
      const summary = typeof result === "string" ? result : String(result ?? "");
      return { summary, firstTimeDownload: avail === "downloadable" };
    } finally {
      if (handler && typeof S.removeEventListener === "function") {
        try {
          S.removeEventListener("downloadprogress", handler);
        } catch {}
      }
    }
  }

  throw new Error("Chrome on-device Summarizer API is not supported in this browser.");
}

export class LocalSummarizer {
  private initialized = false;
  private firstTime = false;
  async ensureReady(): Promise<{ firstTime: boolean }> {
    const a = await getSummarizerAvailability();
    if (a === "unavailable") throw new Error("Chrome Summarizer API not available.");
    this.firstTime = a === "downloadable";
    this.initialized = true;
    return { firstTime: this.firstTime };
  }
  async summarize(text: string): Promise<SummarizeResult> {
    if (!this.initialized) await this.ensureReady();
    const res = await summarize(text);
    return { summary: res.summary, firstTimeDownload: this.firstTime };
  }
}
