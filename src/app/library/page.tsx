
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

const STORAGE_KEY = "padhai-saathi-library-notes-v1";

export default function LibraryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setNotes(parsed as Note[]);
      }
    } catch {
      setMessage("Saved notes could not be loaded.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes, loaded]);

  function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) {
      setMessage("Enter both a title and note content.");
      return;
    }

    const note: Note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      content: content.trim(),
      updatedAt: new Date().toLocaleString()
    };

    setNotes(previous => [note, ...previous]);
    setTitle("");
    setContent("");
    setMessage("Note saved on this device.");
  }

  function deleteNote(id: string) {
    setNotes(previous => previous.filter(note => note.id !== id));
    setMessage("Note deleted.");
  }

  const filtered = notes.filter(note =>
    `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={s.page}>
      <div style={s.container}>
        <Link href="/" style={s.link}>← Back to Dashboard</Link>
        <h1 style={s.heading}>Notes & Library</h1>
        <p style={s.muted}>
          Save your revision notes, organize ideas, and find them later.
        </p>

        <form onSubmit={saveNote} style={s.form}>
          <h2>Create a note</h2>
          <label style={s.label} htmlFor="note-title">Title</label>
          <input
            id="note-title"
            style={s.input}
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="e.g. Physics — Newton's Laws"
            maxLength={120}
          />

          <label style={s.label} htmlFor="note-content">Notes</label>
          <textarea
            id="note-content"
            style={s.textarea}
            value={content}
            onChange={event => setContent(event.target.value)}
            placeholder="Write definitions, formulas, key points..."
            rows={6}
            maxLength={20000}
          />

          <button style={s.button} type="submit">Save Note</button>
        </form>

        <div style={s.searchArea}>
          <h2>Your saved notes ({notes.length})</h2>
          <input
            style={s.input}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
          />
        </div>

        {message && <p role="status" style={s.muted}>{message}</p>}

        {!loaded ? (
          <p style={s.muted}>Loading notes...</p>
        ) : filtered.length === 0 ? (
          <section style={s.empty}>
            {notes.length === 0
              ? "No notes yet. Create your first note above."
              : "No notes match your search."}
          </section>
        ) : (
          <div style={s.grid}>
            {filtered.map(note => (
              <article key={note.id} style={s.note}>
                <h3>{note.title}</h3>
                <p style={s.noteContent}>{note.content}</p>
                <small style={s.muted}>Saved: {note.updatedAt}</small>
                <div>
                  <button
                    type="button"
                    style={s.delete}
                    onClick={() => deleteNote(note.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <p style={s.muted}>
          Notes are stored in this browser on this device. They are not yet
          synchronized between devices or accounts.
        </p>

        <Link href="/doubts" style={s.link}>Open AI Tutor →</Link>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", padding: "36px 20px",
    background: "#0b1020", color: "#f8fafc",
    fontFamily: "Arial, sans-serif"
  },
  container: { maxWidth: 950, margin: "0 auto" },
  link: { color: "#93c5fd" },
  heading: { fontSize: 34, marginTop: 28, marginBottom: 8 },
  muted: { color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" },
  form: {
    marginTop: 28, padding: 24, borderRadius: 16,
    border: "1px solid #334155", background: "#111827"
  },
  label: { display: "block", marginTop: 16, marginBottom: 8 },
  input: {
    display: "block", width: "100%", boxSizing: "border-box",
    padding: 13, borderRadius: 9, border: "1px solid #475569",
    background: "#0b1020", color: "white", marginBottom: 14
  },
  textarea: {
    display: "block", width: "100%", boxSizing: "border-box",
    padding: 13, borderRadius: 9, border: "1px solid #475569",
    background: "#0b1020", color: "white", resize: "vertical"
  },
  button: {
    padding: "12px 18px", marginTop: 14, border: 0,
    borderRadius: 9, background: "#2563eb",
    color: "white", cursor: "pointer", fontWeight: 600
  },
  searchArea: { marginTop: 32, marginBottom: 16 },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16
  },
  note: {
    padding: 20, borderRadius: 14, border: "1px solid #334155",
    background: "#111827", overflowWrap: "anywhere"
  },
  noteContent: { whiteSpace: "pre-wrap", lineHeight: 1.7 },
  delete: {
    marginTop: 12, padding: "8px 12px", borderRadius: 8,
    border: "1px solid #7f1d1d", background: "#451a1a",
    color: "#fecaca", cursor: "pointer"
  },
  empty: {
    padding: 28, borderRadius: 12, background: "#111827",
    border: "1px solid #334155", color: "#cbd5e1"
  }
};
