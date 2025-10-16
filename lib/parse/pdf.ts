// Use a dynamic import so this only runs in the browser and avoids SSR issues.
export async function extractPdfText(file: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing can only run in the browser");
  }
  const pdfjs = await import("pdfjs-dist");
  // Configure the worker to load from the locally bundled file under /public
  // We copied pdf.worker.min.mjs to /public/pdf.worker.min.mjs
  // This keeps everything client-only and avoids a CDN.
  (pdfjs as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map((item: any) => item.str).filter(Boolean);
    pageTexts.push(strings.join(" "));
  }

  // Join pages with double newlines to hint paragraph breaks
  return pageTexts.join("\n\n");
}
