"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";

type ExtractResult = {
  pages?: string[];
  pageCount?: number;
  status?: "ready" | "needs-ocr";
  error?: string;
};

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setResult(null);
    setError("");

    if (!selected) {
      setFile(null);
      return;
    }

    if (
      selected.type !== "application/pdf" ||
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      setFile(null);
      setError("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (selected.size > 8 * 1024 * 1024) {
      setFile(null);
      setError("The PDF must be 8 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function extractPdf() {
    if (!file || busy) return;

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ExtractResult;

      if (!response.ok) {
        throw new Error(data.error || "Could not extract this PDF.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the PDF."
      );
    } finally {
      setBusy(false);
    }
  }

  const extractedText = (result?.pages ?? [])
    .map((text, index) => `Page ${index + 1}\n${text || "(No selectable text found)"}`)
    .join("\n\n");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <nav className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
          <Link
            href="/doubts"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Ask Saathi
          </Link>
        </nav>

        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-cyan-400">
            Padhai Saathi
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">My Documents</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Upload a PDF to extract its text and prepare it for study notes,
            revision, and exam planning.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <label
            htmlFor="pdf-upload"
            className="mb-3 block text-sm font-semibold"
          >
            Choose a PDF document
          </label>

          <input
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            disabled={busy}
            className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
          />

          <p className="mt-2 text-xs text-slate-400">
            PDF only · Maximum 8 MB · Up to 150 pages
          </p>

          {file && (
            <p className="mt-4 break-all text-sm text-cyan-300">
              Selected: {file.name}
            </p>
          )}

          <button
            type="button"
            onClick={extractPdf}
            disabled={!file || busy}
            className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Reading PDF…" : "Extract PDF text"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200"
            >
              {error}
            </p>
          )}
        </section>

        {result && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
            <h2 className="text-xl font-bold">Extraction results</h2>
            <p className="mt-2 text-sm text-slate-300">
              Pages processed: {result.pageCount ?? result.pages?.length ?? 0}
            </p>

            {result.status === "needs-ocr" ? (
              <div className="mt-4 rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-200">
                This PDF contains no selectable text. It may be a scanned
                document and needs OCR before its contents can be read.
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm text-emerald-300">
                  PDF text extracted successfully.
                </p>
                <pre className="mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
                  {extractedText || "No text was returned."}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(extractedText);
                  }}
                  className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                >
                  Copy extracted text
                </button>
              </>
            )}
          </section>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Extracted text is displayed in this browser session. This page does
          not permanently save uploaded PDFs.
        </p>
      </div>
    </main>
  );
}