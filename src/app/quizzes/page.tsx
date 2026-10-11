
"use client";

import Link from "next/link";
import { useState } from "react";

const questions = [
  {
    question: "What is the value of 12 × 8?",
    options: ["84", "96", "108", "88"],
    answer: 1,
    explanation: "12 × 8 = 96."
  },
  {
    question: "Which gas do plants absorb during photosynthesis?",
    options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    answer: 2,
    explanation: "Plants absorb carbon dioxide to make food."
  },
  {
    question: "What is the SI unit of force?",
    options: ["Joule", "Watt", "Pascal", "Newton"],
    answer: 3,
    explanation: "Force is measured in newtons."
  },
  {
    question: "What is the square root of 144?",
    options: ["10", "11", "12", "14"],
    answer: 2,
    explanation: "12 × 12 = 144."
  },
  {
    question: "Which organ pumps blood around the human body?",
    options: ["Lungs", "Heart", "Kidney", "Brain"],
    answer: 1,
    explanation: "The heart pumps blood through the circulatory system."
  }
];

export default function QuizPage() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);

  const question = questions[current];
  const score = questions.reduce(
    (total, item, index) =>
      total + (answers[index] === item.answer ? 1 : 0),
    0
  );

  function restart() {
    setCurrent(0);
    setAnswers({});
    setFinished(false);
    setStarted(true);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/" style={styles.link}>← Back to Dashboard</Link>
        <h1 style={styles.heading}>Quiz Center</h1>
        <p style={styles.muted}>
          Test your knowledge and learn from every answer.
        </p>

        {!started ? (
          <section style={styles.card}>
            <h2>Practice Quiz</h2>
            <p>5 multiple-choice questions covering Maths and Science.</p>
            <button style={styles.button} onClick={() => setStarted(true)}>
              Start Quiz
            </button>
          </section>
        ) : finished ? (
          <section style={styles.card}>
            <h2>Quiz Completed!</h2>
            <p style={styles.score}>{score} / {questions.length}</p>
            <p>
              {score === questions.length
                ? "Excellent! All answers are correct."
                : "Review the explanations and try again."}
            </p>

            {questions.map((item, index) => (
              <div key={index} style={styles.review}>
                <strong>{index + 1}. {item.question}</strong>
                <p>
                  Your answer: {answers[index] === undefined
                    ? "Not answered"
                    : item.options[answers[index]]}
                </p>
                <p>Correct answer: {item.options[item.answer]}</p>
                <small>{item.explanation}</small>
              </div>
            ))}

            <button style={styles.button} onClick={restart}>
              Try Again
            </button>
          </section>
        ) : (
          <section style={styles.card}>
            <p style={styles.muted}>
              Question {current + 1} of {questions.length}
            </p>
            <div style={styles.progressTrack}>
              <div style={{
                ...styles.progress,
                width: `${((current + 1) / questions.length) * 100}%`
              }} />
            </div>

            <h2>{question.question}</h2>

            {question.options.map((option, index) => (
              <button
                key={option}
                onClick={() => setAnswers(previous => ({
                  ...previous,
                  [current]: index
                }))}
                style={{
                  ...styles.option,
                  borderColor: answers[current] === index
                    ? "#60a5fa" : "#334155",
                  background: answers[current] === index
                    ? "#1e3a5f" : "#111827"
                }}
              >
                {String.fromCharCode(65 + index)}. {option}
              </button>
            ))}

            <div style={styles.actions}>
              <button
                style={styles.secondary}
                disabled={current === 0}
                onClick={() => setCurrent(value => value - 1)}
              >
                Previous
              </button>

              <button
                style={styles.button}
                onClick={() => {
                  if (current === questions.length - 1) {
                    setFinished(true);
                  } else {
                    setCurrent(value => value + 1);
                  }
                }}
              >
                {current === questions.length - 1
                  ? "Finish Quiz" : "Next Question"}
              </button>
            </div>
          </section>
        )}

        <p style={styles.muted}>
          AI-generated quizzes will be connected after Gemini setup is verified.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", padding: "36px 20px",
    background: "#0b1020", color: "#f8fafc",
    fontFamily: "Arial, sans-serif"
  },
  container: { maxWidth: 850, margin: "0 auto" },
  heading: { fontSize: 34, marginTop: 28, marginBottom: 8 },
  link: { color: "#93c5fd" },
  muted: { color: "#94a3b8", lineHeight: 1.7 },
  card: {
    marginTop: 28, padding: 26, borderRadius: 18,
    border: "1px solid #334155", background: "#111827"
  },
  button: {
    background: "#2563eb", color: "white", border: 0,
    padding: "12px 18px", borderRadius: 9,
    cursor: "pointer", fontWeight: 600, marginTop: 12
  },
  secondary: {
    background: "#334155", color: "white", border: 0,
    padding: "12px 18px", borderRadius: 9, cursor: "pointer"
  },
  option: {
    display: "block", width: "100%", textAlign: "left",
    color: "#f8fafc", padding: 15, border: "1px solid",
    borderRadius: 10, marginTop: 10, cursor: "pointer"
  },
  actions: {
    display: "flex", justifyContent: "space-between",
    gap: 12, marginTop: 24
  },
  score: { fontSize: 36, fontWeight: 700, color: "#60a5fa" },
  review: {
    padding: 14, marginTop: 12, borderRadius: 10,
    background: "#0b1020", lineHeight: 1.6
  },
  progressTrack: {
    height: 6, background: "#334155", borderRadius: 10, overflow: "hidden"
  },
  progress: { height: "100%", background: "#3b82f6" }
};
