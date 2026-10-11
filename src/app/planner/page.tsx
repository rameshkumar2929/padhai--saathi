"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Subject = {
  id: string;
  name: string;
  examDate: string;
  difficulty: "Easy" | "Medium" | "Hard";
  progress: number;
};

type Task = {
  id: string;
  subjectId: string;
  date: string;
  topic: string;
  done: boolean;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [difficulty, setDifficulty] =
    useState<Subject["difficulty"]>("Medium");
  const [hours, setHours] = useState(3);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const savedSubjects = localStorage.getItem("padhai-planner-subjects");
      const savedTasks = localStorage.getItem("padhai-planner-tasks");

      if (savedSubjects) {
        const parsed: unknown = JSON.parse(savedSubjects);
        if (Array.isArray(parsed)) setSubjects(parsed);
      }

      if (savedTasks) {
        const parsed: unknown = JSON.parse(savedTasks);
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch (error) {
      console.error("Could not load planner data:", error);
      setMessage("Saved planner data could not be loaded.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(
        "padhai-planner-subjects",
        JSON.stringify(subjects)
      );
      localStorage.setItem(
        "padhai-planner-tasks",
        JSON.stringify(tasks)
      );
    } catch (error) {
      console.error("Could not save planner data:", error);
      setMessage("Unable to save data in this browser.");
    }
  }, [subjects, tasks, ready]);

  const completed = tasks.filter((task) => task.done).length;
  const completion = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const upcoming = useMemo(
    () => [...subjects].sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [subjects]
  );

  function addSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim() || !examDate) {
      setMessage("Enter a subject name and exam date.");
      return;
    }

    if (examDate < today()) {
      setMessage("Choose today or a future date for the exam.");
      return;
    }

    setSubjects((old) => [
      ...old,
      {
        id: makeId(),
        name: name.trim(),
        examDate,
        difficulty,
        progress: 0,
      },
    ]);

    setName("");
    setExamDate("");
    setDifficulty("Medium");
    setMessage("Subject added successfully.");
  }

  function generatePlan() {
    if (!subjects.length) {
      setMessage("Add at least one subject first.");
      return;
    }

    const start = new Date(`${today()}T12:00:00`);
    const newTasks: Task[] = [];

    const topics = [
      "Review core concepts",
      "Practice important questions",
      "Revise notes and examples",
      "Solve a practice test",
      "Review mistakes and weak topics",
    ];

    for (const subject of subjects) {
      const end = new Date(`${subject.examDate}T12:00:00`);
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / 86400000)
      );

      const count = Math.min(
        days,
        Math.max(1, Math.ceil(hours / subjects.length))
      );

      for (let i = 0; i < count; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + Math.floor((i * days) / count));

        newTasks.push({
          id: makeId(),
          subjectId: subject.id,
          date: `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          topic: topics[i % topics.length],
          done: false,
        });
      }
    }

    setTasks(newTasks.sort((a, b) => a.date.localeCompare(b.date)));
    setMessage("Revision schedule generated. Mark tasks complete as you study.");
  }

  function toggleTask(id: string) {
    setTasks((old) =>
      old.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }

  function deleteSubject(id: string) {
    setSubjects((old) => old.filter((subject) => subject.id !== id));
    setTasks((old) => old.filter((task) => task.subjectId !== id));
    setMessage("Subject and its study tasks removed.");
  }

  const subjectName = (id: string) =>
    subjects.find((subject) => subject.id === id)?.name ?? "Removed subject";

  const panel: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 22,
  };

  const field: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    marginTop: 6,
    color: "#0f172a",
    background: "#fff",
  };

  const primary: React.CSSProperties = {
    border: 0,
    borderRadius: 9,
    padding: "12px 16px",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };

  if (!ready) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#f5f7fb",
          color: "#172033",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading your exam planner...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#172033",
        padding: "28px 18px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#4f46e5", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>

        <header style={{ margin: "26px 0" }}>
          <p style={{ color: "#4f46e5", fontWeight: 700, marginBottom: 8 }}>
            PADHAI SAATHI · STUDY SMARTER
          </p>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 42px)", margin: "0 0 10px" }}>
            Exam Planner
          </h1>
          <p style={{ color: "#64748b", lineHeight: 1.7, margin: 0 }}>
            Organize exams, generate a revision schedule, and track daily
            preparation.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {[
            { label: "Subjects", value: subjects.length },
            { label: "Study tasks", value: tasks.length },
            { label: "Tasks completed", value: completed },
            { label: "Overall progress", value: `${completion}%` },
          ].map((item) => (
            <div key={item.label} style={{ ...panel, padding: 18 }}>
              <p style={{ color: "#64748b", margin: "0 0 8px", fontSize: 14 }}>
                {item.label}
              </p>
              <strong style={{ fontSize: 28 }}>{item.value}</strong>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 20,
          }}
        >
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Add an exam subject</h2>

            <form onSubmit={addSubject}>
              <label>
                Subject name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Data Structures"
                  style={field}
                  required
                  maxLength={100}
                />
              </label>

              <label style={{ display: "block", marginTop: 16 }}>
                Exam date
                <input
                  type="date"
                  value={examDate}
                  min={today()}
                  onChange={(e) => setExamDate(e.target.value)}
                  style={field}
                  required
                />
              </label>

              <label style={{ display: "block", marginTop: 16 }}>
                Difficulty
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as Subject["difficulty"])
                  }
                  style={field}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </label>

              <label style={{ display: "block", marginTop: 16 }}>
                Study hours per day: <strong>{hours}</strong>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  style={{ width: "100%", marginTop: 12 }}
                />
              </label>

              <button
                type="submit"
                style={{ ...primary, width: "100%", marginTop: 20 }}
              >
                + Add subject
              </button>
            </form>
          </div>

          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Your exam subjects</h2>

            {upcoming.length === 0 ? (
              <p style={{ color: "#64748b", lineHeight: 1.7 }}>
                No subjects yet. Add your first exam to start planning.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {upcoming.map((subject) => {
                  const days = Math.max(
                    0,
                    Math.ceil(
                      (new Date(`${subject.examDate}T12:00:00`).getTime() -
                        new Date(`${today()}T12:00:00`).getTime()) /
                        86400000
                    )
                  );

                  return (
                    <article
                      key={subject.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <strong>{subject.name}</strong>
                          <p
                            style={{
                              color: "#64748b",
                              margin: "7px 0",
                              fontSize: 14,
                            }}
                          >
                            Exam: {subject.examDate} ·{" "}
                            {days === 0 ? "Today" : `${days} day(s) left`}
                          </p>
                          <span
                            style={{
                              fontSize: 12,
                              background:
                                subject.difficulty === "Hard"
                                  ? "#fee2e2"
                                  : subject.difficulty === "Medium"
                                    ? "#fef3c7"
                                    : "#dcfce7",
                              padding: "4px 8px",
                              borderRadius: 20,
                            }}
                          >
                            {subject.difficulty}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteSubject(subject.id)}
                          aria-label={`Delete ${subject.name}`}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fff",
                            color: "#b91c1c",
                            borderRadius: 8,
                            padding: "7px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={generatePlan}
              style={{ ...primary, width: "100%", marginTop: 20 }}
            >
              Generate revision schedule
            </button>
          </div>
        </section>

        <section style={{ ...panel, marginTop: 22 }}>
          <h2 style={{ marginTop: 0 }}>Daily revision schedule</h2>

          {tasks.length === 0 ? (
            <p style={{ color: "#64748b", lineHeight: 1.7 }}>
              Add subjects and generate your schedule to see daily study tasks.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {tasks.map((task) => (
                <label
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    background: task.done ? "#f0fdf4" : "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span
                    style={{
                      flex: 1,
                      textDecoration: task.done ? "line-through" : "none",
                    }}
                  >
                    <strong>{subjectName(task.subjectId)}</strong>
                    <span
                      style={{
                        display: "block",
                        color: "#64748b",
                        fontSize: 14,
                        marginTop: 4,
                      }}
                    >
                      {task.topic} · {task.date}
                    </span>
                  </span>
                  <span
                    style={{
                      color: task.done ? "#15803d" : "#64748b",
                      fontSize: 13,
                    }}
                  >
                    {task.done ? "Done" : "Pending"}
                  </span>
                </label>
              ))}

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete the generated schedule? Your subjects will remain."
                    )
                  ) {
                    setTasks([]);
                  }
                }}
                style={{
                  justifySelf: "start",
                  padding: "10px 14px",
                  borderRadius: 9,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: "pointer",
                  color: "#334155",
                }}
              >
                Clear schedule
              </button>
            </div>
          )}
        </section>

        {message && (
          <p
            role="status"
            style={{
              marginTop: 18,
              padding: 13,
              borderRadius: 10,
              background: "#eef2ff",
              color: "#3730a3",
            }}
          >
            {message}
          </p>
        )}

        <footer style={{ marginTop: 24 }}>
          <Link href="/doubts" style={{ color: "#4f46e5" }}>
            Ask the AI Tutor a question →
          </Link>
        </footer>
      </div>
    </main>
  );
}
