"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { extractPdfText } from "@/lib/parse/pdf";
import { extractDocxText } from "@/lib/parse/docx";
import { LocalSummarizer, getSummarizerAvailability, summarize as runSummarize, type Availability } from "@/lib/ai/summarizer";
import { getTranslatorAvailability, translate as runTranslate, type TAvailability } from "@/lib/ai/translator";

const TEN_MB = 10 * 1024 * 1024;

function humanSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

export default function NewFilePage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingSummarize, setLoadingSummarize] = useState(false);
  const [firstTimeBanner, setFirstTimeBanner] = useState<string>("");
  const [availability, setAvailability] = useState<Availability>("unavailable");
  const [dlLoaded, setDlLoaded] = useState(0);
  const [dlTotal, setDlTotal] = useState(0);
  // Translator state
  const [tAvailability, setTAvailability] = useState<TAvailability>("unavailable");
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [translateTarget, setTranslateTarget] = useState<string>("es"); // default to Spanish
  const [translateSource, setTranslateSource] = useState<"summary" | "extracted">("summary");
  const [translation, setTranslation] = useState<string>("");
  const [tLoaded, setTLoaded] = useState(0);
  const [tTotal, setTTotal] = useState(0);

  const summarizerRef = useRef<LocalSummarizer | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isPdf = useMemo(() => file?.type === "application/pdf" || /\.pdf$/i.test(file?.name ?? ""), [file]);
  const isDocx = useMemo(
    () => file?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file?.name ?? ""),
    [file]
  );

  const LANGS: Array<{ code: string; label: string }> = [
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "fr", label: "French" },
    { code: "de", label: "German" },
    { code: "it", label: "Italian" },
    { code: "pt", label: "Portuguese" },
    { code: "nl", label: "Dutch" },
    { code: "sv", label: "Swedish" },
    { code: "da", label: "Danish" },
    { code: "no", label: "Norwegian" },
    { code: "fi", label: "Finnish" },
    { code: "pl", label: "Polish" },
    { code: "cs", label: "Czech" },
    { code: "sk", label: "Slovak" },
    { code: "sl", label: "Slovenian" },
    { code: "hr", label: "Croatian" },
    { code: "ro", label: "Romanian" },
    { code: "bg", label: "Bulgarian" },
    { code: "hu", label: "Hungarian" },
    { code: "el", label: "Greek" },
    { code: "tr", label: "Turkish" },
    { code: "ru", label: "Russian" },
    { code: "uk", label: "Ukrainian" },
    { code: "ar", label: "Arabic" },
    { code: "he", label: "Hebrew" },
    { code: "fa", label: "Persian" },
    { code: "hi", label: "Hindi" },
    { code: "bn", label: "Bengali" },
    { code: "ur", label: "Urdu" },
    { code: "ta", label: "Tamil" },
    { code: "te", label: "Telugu" },
    { code: "mr", label: "Marathi" },
    { code: "gu", label: "Gujarati" },
    { code: "pa", label: "Punjabi" },
    { code: "zh", label: "Chinese" },
    { code: "ja", label: "Japanese" },
    { code: "ko", label: "Korean" },
    { code: "id", label: "Indonesian" },
    { code: "ms", label: "Malay" },
    { code: "vi", label: "Vietnamese" },
    { code: "th", label: "Thai" },
  ];

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setText("");
    setSummary("");
    setFirstTimeBanner("");

    const f = e.target.files?.[0] || null;
    setFile(f);

    if (!f) return;
    if (f.size > TEN_MB) {
      setError(`File exceeds 10 MB limit (got ${humanSize(f.size)}).`);
      return;
    }

    setLoadingParse(true);
    try {
      let extracted = "";
      if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        extracted = await extractPdfText(f);
      } else if (/\.docx$/i.test(f.name) || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        extracted = await extractDocxText(f);
      } else {
        setError("Unsupported file type. Please upload a .pdf or .docx file.");
        return;
      }
      setText(extracted?.trim() ?? "");
      if (!extracted?.trim()) {
        setError("No text could be extracted from the document.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to parse document.");
    } finally {
      setLoadingParse(false);
    }
  }, []);

  // Check summarizer availability on mount
  useEffect(() => {
    (async () => {
      const a = await getSummarizerAvailability();
      setAvailability(a);
      const ta = await getTranslatorAvailability(translateTarget, "en");
      setTAvailability(ta);
    })();
  }, []);

  const onSummarize = useCallback(async () => {
    setError("");
    setSummary("");
    setDlLoaded(0);
    setDlTotal(0);

    if (!text) {
      setError("Nothing to summarize. Please upload and parse a document first.");
      return;
    }

    if (!summarizerRef.current) {
      summarizerRef.current = new LocalSummarizer();
    }

    setLoadingSummarize(true);
    try {
      // Refresh availability and show first-time banner if a download is expected
      const a = await getSummarizerAvailability();
      setAvailability(a);
      if (a === "downloadable") {
        setFirstTimeBanner("First-time: the on-device model may need to download. This can take a moment.");
      } else {
        setFirstTimeBanner("");
      }
      const { summary: s, firstTimeDownload } = await runSummarize(text, (loaded, total) => {
        setDlLoaded(loaded || 0);
        setDlTotal(total || 0);
      });
      setSummary(s);
      if (!firstTimeDownload) {
        // Clear banner if not first-time
        setFirstTimeBanner("");
      } else {
        // Keep the banner briefly; it will be replaced by success
        setTimeout(() => setFirstTimeBanner(""), 3000);
      }
      // If we just completed a first-time download, availability should now be available
      if (firstTimeDownload || (dlTotal > 0 && dlLoaded >= dlTotal)) {
        setAvailability("available");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to run summarizer.");
    } finally {
      setLoadingSummarize(false);
      // After completion, refresh availability; installed model should report 'available'
      try {
        const again = await getSummarizerAvailability();
        setAvailability(again);
      } catch {}
      // Reset download counters
      setDlLoaded(0);
      setDlTotal(0);
    }
  }, [text]);

  const pickSourceText = useCallback(() => {
    if (translateSource === "summary" && summary) return summary;
    return text;
  }, [translateSource, summary, text]);

  const onTranslate = useCallback(async () => {
    setError("");
    setTranslation("");
    setTLoaded(0);
    setTTotal(0);

    const src = pickSourceText();
    if (!src) {
      setError("Nothing to translate. Create a summary or upload and parse a document first.");
      return;
    }

    setLoadingTranslate(true);
    try {
      const ta = await getTranslatorAvailability(translateTarget, "en");
      setTAvailability(ta);
      const out = await runTranslate(src, translateTarget, "en", (loaded, total) => {
        setTLoaded(loaded || 0);
        setTTotal(total || 0);
      });
      setTranslation(out);
    } catch (err: any) {
      setError(err?.message || "Failed to translate.");
    } finally {
      setLoadingTranslate(false);
      try {
        const again = await getTranslatorAvailability(translateTarget, "en");
        setTAvailability(again);
      } catch {}
    }
  }, [pickSourceText, translateTarget]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Prepare your <span className="text-blue-600">notes</span> for studying
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Quickly turn your materials into organized summaries. Everything runs locally in your browser.
          </p>
        </div>

        {/* Upload Card */}
        <div className="mt-8 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="text-blue-700 font-medium">Upload a PDF or DOCX</div>
            <input
              ref={fileInputRef}
              id="file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Choose File
            </button>
            <div className="mt-2 text-xs text-blue-700/80">supported formats: .pdf, .docx</div>

            {file && (
              <div className="mt-3 text-sm text-gray-700">
                <div><span className="font-medium">Name:</span> {file.name}</div>
                <div><span className="font-medium">Type:</span> {isPdf ? "PDF" : isDocx ? "DOCX" : file.type || "Unknown"}</div>
                <div><span className="font-medium">Size:</span> {humanSize(file.size)}</div>
              </div>
            )}

            {loadingParse && (
              <div className="mt-3 text-sm text-blue-700">Parsing document…</div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-auto mt-4 max-w-4xl rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Category Tile */}
        <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <div className="text-sm font-semibold text-blue-700">PDF/Doc</div>
            <div className="mt-1 text-xs text-gray-600">Notes, papers</div>
          </div>
        </div>

        {/* Summarize controls */}
        <div className="mx-auto mt-6 flex max-w-4xl items-center gap-4">
          <button
            onClick={onSummarize}
            disabled={!text || loadingSummarize}
            className="inline-flex items-center rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSummarize ? "Summarizing…" : "Summarize"}
          </button>
          {/* Availability indicator */}
          <div className="text-sm">
            {availability === "available" && <span className="text-green-700">Available</span>}
            {(availability === "downloadable" && loadingSummarize && !summary) && (
              <span className="text-blue-700">Needs download</span>
            )}
            {availability === "unavailable" && <span className="text-red-700">Not available</span>}
          </div>
          {firstTimeBanner && (
            <div className="text-sm text-blue-700">{firstTimeBanner}</div>
          )}
        </div>

        {/* Translate controls */}
        <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-3">
          <button
            onClick={onTranslate}
            disabled={loadingTranslate || (!summary && !text)}
            className="inline-flex items-center rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingTranslate ? "Translating…" : "Translate"}
          </button>
          <div className="text-sm text-gray-700">From</div>
          <select
            value={translateSource}
            onChange={(e) => setTranslateSource(e.target.value as any)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            <option value="summary">Summary</option>
            <option value="extracted">Extracted text</option>
          </select>
          <div className="text-sm text-gray-700">to</div>
          <select
            value={translateTarget}
            onChange={(e) => setTranslateTarget(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {/* Translator availability */}
          <div className="text-sm">
            {tAvailability === "available" && <span className="text-green-700">Available</span>}
            {(tAvailability === "downloadable" && loadingTranslate) && (
              <span className="text-blue-700">Needs download</span>
            )}
            {tAvailability === "unavailable" && <span className="text-red-700">Not available</span>}
          </div>
        </div>

        {/* Translator download progress (text only) */}
        {(loadingTranslate && tAvailability === "downloadable") && (
          <div className="mx-auto mt-2 max-w-4xl text-center text-sm text-blue-700">
            <span className="font-medium">First-time use required — Download</span>
            {" "}
            {tTotal > 0 ? `${Math.min(100, Math.round((tLoaded / tTotal) * 100))}%` : "…"}
          </div>
        )}

        {/* Download progress */}
        {(dlTotal > 0 && dlLoaded < dlTotal) && (
          <div className="mx-auto mt-3 max-w-4xl">
            <div className="h-2 w-full overflow-hidden rounded bg-blue-100">
              <div
                className="h-2 bg-blue-600 transition-all"
                style={{ width: `${Math.min(100, Math.round((dlLoaded / dlTotal) * 100))}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-blue-700">
              {Math.min(100, Math.round((dlLoaded / dlTotal) * 100))}%
            </div>
          </div>
        )}

        {/* Extracted Text Preview (hidden as requested) */}

        {/* Summary */}
        {summary && !error && (
          <div className="mx-auto mt-6 max-w-4xl opacity-100">
            <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
            <div className="mt-2 max-w-none rounded border border-gray-200 p-3 text-sm bg-white text-gray-800">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Translation */}
        {translation && !error && (
          <div className="mx-auto mt-6 max-w-4xl">
            <h2 className="text-lg font-semibold text-gray-900">Translation ({translateTarget})</h2>
            <div className="mt-2 max-w-none rounded border border-gray-200 p-3 text-sm bg-white text-gray-800">
              <ReactMarkdown>{translation}</ReactMarkdown>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
