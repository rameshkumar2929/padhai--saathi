
"use client";

import Link from "next/link";
import { useState } from "react";

const cards = [
  { front: "What is photosynthesis?", back: "The process by which green plants use sunlight, water, and carbon dioxide to make food." },
  { front: "What is a prime number?", back: "A whole number greater than 1 that has exactly two factors: 1 and itself." },
  { front: "What is Newton's second law?", back: "Force equals mass multiplied by acceleration: F = ma." },
  { front: "What is the Pythagorean theorem?", back: "For a right triangle, a² + b² = c², where c is the hypotenuse." },
  { front: "What is an atom?", back: "The smallest unit of an element that retains its chemical identity." }
];

export default function FlashcardsPage() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<number[]>([]);

  const card = cards[index];

  function goTo(next: number) {
    setIndex((next + cards.length) % cards.length);
    setFlipped(false);
  }

  function markKnown() {
    setKnown(previous =>
      previous.includes(index) ? previous : [...previous, index]
    );
    goTo(index + 1);
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <Link href="/" style={s.link}>← Back to Dashboard</Link>
        <h1 style={s.heading}>Flashcards</h1>
        <p style={s.muted}>
          Review a concept, flip the card, and test your memory.
        </p>

        <div style={s.topline}>
          <span>Card {index + 1} of {cards.length}</span>
          <span>Mastered: {known.length} / {cards.length}</span>
        </div>

        <button
          type="button"
          style={s.card}
          onClick={() => setFlipped(value => !value)}
          aria-label="Flip flashcard"
        >
          <span style={s.tag}>{flipped ? "ANSWER" : "QUESTION"}</span>
          <span style={s.content}>{flipped ? card.back : card.front}</span>
          <span style={s.hint}>Click to flip</span>
        </button>

        <div style={s.actions}>
          <button style={s.secondary} onClick={() => goTo(index - 1)}>
            ← Previous
          </button>
          <button style={s.secondary} onClick={() => setFlipped(v => !v)}>
            Flip Card
          </button>
          <button style={s.secondary} onClick={() => goTo(index + 1)}>
            Next →
          </button>
        </div>

        <button style={s.button} onClick={markKnown}>
          I Know This
        </button>

        <p style={s.muted}>
          These are sample flashcards. Gemini-based card generation will be
          added after the AI API is verified.
        </p>
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
  container: { maxWidth: 850, margin: "0 auto" },
  link: { color: "#93c5fd" },
  heading: { fontSize: 34, marginTop: 28, marginBottom: 8 },
  muted: { color: "#94a3b8", lineHeight: 1.7 },
  topline: {
    display: "flex", justifyContent: "space-between",
    gap: 12, marginTop: 28, color: "#cbd5e1"
  },
  card: {
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    gap: 24, width: "100%", minHeight: 300,
    marginTop: 16, padding: 28, borderRadius: 20,
    border: "1px solid #475569", background: "#172033",
    color: "#f8fafc", cursor: "pointer", textAlign: "center"
  },
  tag: { color: "#93c5fd", fontSize: 13, letterSpacing: 2 },
  content: { fontSize: 24, lineHeight: 1.6, maxWidth: 650 },
  hint: { color: "#94a3b8", fontSize: 13 },
  actions: {
    display: "flex", flexWrap: "wrap", justifyContent: "center",
    gap: 10, marginTop: 20
  },
  secondary: {
    padding: "12px 16px", borderRadius: 9,
    border: "1px solid #475569", background: "#1e293b",
    color: "white", cursor: "pointer"
  },
  button: {
    padding: "12px 18px", marginTop: 16, border: 0,
    borderRadius: 9, background: "#2563eb",
    color: "white", cursor: "pointer", fontWeight: 600
  }
};
