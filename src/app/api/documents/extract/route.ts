import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 150;

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "The upload form could not be read." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Choose a valid PDF file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "This PDF is larger than 8 MB. Choose a smaller file." }, { status: 413 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const loading = getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
    const document = await loading.promise;
    if (document.numPages > MAX_PAGES) {
      await document.destroy();
      return Response.json({ error: `This PDF has ${document.numPages} pages. The local reader supports up to ${MAX_PAGES} pages at a time.` }, { status: 413 });
    }
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim());
      page.cleanup();
    }
    await document.destroy();
    const hasText = pages.some((text) => text.length > 0);
    return Response.json({ pages, pageCount: pages.length, status: hasText ? "ready" : "needs-ocr" });
  } catch (error) {
    console.error("PDF extraction failed", { message: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
    return Response.json({ error: "This PDF could not be read. It may be damaged or password-protected." }, { status: 422 });
  }
}
