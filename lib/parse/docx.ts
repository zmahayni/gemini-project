// Dynamic import of mammoth's browser build to keep things client-only
// and avoid SSR issues in Next.js App Router.
export async function extractDocxText(file: File): Promise<string> {
  const { default: mammoth } = await import("mammoth/mammoth.browser");

  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  // `value` is plaintext extracted from the docx
  return value || "";
}
