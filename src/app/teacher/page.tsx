"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardFrame from "@/components/DashboardFrame";
import { getLanguage, isLanguage, LANGUAGES, type Language } from "@/lib/languages";

const demoTopics = [
  { subject: "Maths", topic: "Fractions", struggling: 18, total: 30, trend: "Most common" },
  { subject: "Science", topic: "Force and motion", struggling: 14, total: 30, trend: "Needs a recap" },
  { subject: "Maths", topic: "Percentages", struggling: 11, total: 30, trend: "Improving" },
  { subject: "Science", topic: "Food chains", struggling: 8, total: 30, trend: "On track" },
];

type TeacherDoubt = { id: string; nickname: string; grade: string; subject: string; question: string; answer: string; status: "new" | "answered"; created_at: string };

export default function TeacherPage() {
  const [doubts, setDoubts] = useState<TeacherDoubt[]>([]);
  const [doubtsLoading, setDoubtsLoading] = useState(true);
  const [doubtsConfigured, setDoubtsConfigured] = useState(false);
  const [doubtsError, setDoubtsError] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherToken, setTeacherToken] = useState("");
  const [accessRequired, setAccessRequired] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem("padhai-saathi-language");
      const savedTheme = localStorage.getItem("padhai-saathi-theme");
      if (isLanguage(savedLanguage)) setLanguage(savedLanguage);
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
    } catch { /* Preferences are optional. */ }
    void fetch("/api/doubts").then(async (response) => {
      const result = await response.json() as { configured?: boolean; doubts?: TeacherDoubt[]; error?: string };
      if (response.status === 401) { setAccessRequired(true); return; }
      if (!response.ok) throw new Error(result.error ?? "Teacher doubts could not be loaded.");
      setDoubtsConfigured(Boolean(result.configured));
      setDoubts(result.doubts ?? []);
    }).catch((error: unknown) => setDoubtsError(error instanceof Error ? error.message : "Teacher doubts could not be loaded.")).finally(() => setDoubtsLoading(false));
  }, []);

  async function unlockTeacher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = teacherCode.trim();
    if (!token) return;
    setDoubtsLoading(true);
    setDoubtsError("");
    try {
      const response = await fetch("/api/doubts", { headers: { "x-teacher-token": token } });
      const result = await response.json() as { configured?: boolean; doubts?: TeacherDoubt[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "That access code was not accepted.");
      setTeacherToken(token);
      setDoubtsConfigured(Boolean(result.configured));
      setDoubts(result.doubts ?? []);
      setAccessRequired(false);
      setTeacherCode("");
    } catch (error) {
      setDoubtsError(error instanceof Error ? error.message : "Teacher doubts could not be loaded.");
    } finally { setDoubtsLoading(false); }
  }

  useEffect(() => {
    document.documentElement.lang = language;
    const selected = getLanguage(language);
    document.documentElement.dir = selected.direction;
    document.getElementById("teacher-regional-font")?.remove();
    if (selected.fontFamily) {
      const link = document.createElement("link");
      link.id = "teacher-regional-font";
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(selected.fontFamily).replace(/%20/g, "+")}&display=swap`;
      document.head.append(link);
      document.documentElement.style.setProperty("--script-font", `"${selected.fontFamily}"`);
    } else document.documentElement.style.removeProperty("--script-font");
    try { localStorage.setItem("padhai-saathi-language", language); } catch { /* Preferences are optional. */ }
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("padhai-saathi-theme", theme); } catch { /* Preferences are optional. */ }
  }, [theme]);

  async function markAnswered(id: string) {
    try {
      const response = await fetch("/api/doubts", { method: "PATCH", headers: { "Content-Type": "application/json", "x-teacher-token": teacherToken }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("That doubt could not be updated.");
      setDoubts((current) => current.map((doubt) => doubt.id === id ? { ...doubt, status: "answered" } : doubt));
    } catch (error) {
      setDoubtsError(error instanceof Error ? error.message : "That doubt could not be updated.");
    }
  }

  return <DashboardFrame active="teacher" profileName="Teacher" context="Demo classroom" theme={theme} onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} controls={<><label className="sr-only" htmlFor="teacher-language">Language</label><select id="teacher-language" className="nav-language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.nativeName}</option>)}</select></>}>
    <section className="teacher-content">
      <div className="eyebrow"><span className="eyebrow-dot" />Classroom overview</div>
      <h1>Where should we practise together?</h1>
      <p className="teacher-intro">A sample class summary to help plan the next lesson.</p>
      <div className="demo-banner"><strong>DEMO DATA</strong><span>{doubtsConfigured ? "Class summary and chart are sample numbers; shared doubts below come from configured storage." : "This is example information only. No student data is collected or shown here."}</span></div>
      <div className="teacher-summary"><div><span>30</span><small>sample students</small></div><div><span>4</span><small>topics checked</small></div><div><span>8-10</span><small>class range</small></div></div>
      <section className="teacher-chart-section" aria-labelledby="weakest-topics-title"><div className="teacher-section-heading"><div><span className="eyebrow">Classroom pulse</span><h2 id="weakest-topics-title">Topics needing attention</h2></div><span className="chart-key"><i />Students needing practice</span></div><div className="teacher-chart">{demoTopics.slice().sort((a, b) => b.struggling / b.total - a.struggling / a.total).map((item) => <div className="teacher-chart-row" key={item.topic}><div className="teacher-chart-label"><span>{item.subject}</span><strong>{item.topic}</strong></div><div className="teacher-chart-track"><i style={{ width: `${Math.round(item.struggling / item.total * 100)}%` }} /></div><strong className="teacher-chart-value">{Math.round(item.struggling / item.total * 100)}%</strong></div>)}</div></section>
      <section className="teacher-table-section" aria-labelledby="topic-details-title"><h2 id="topic-details-title">Topic details</h2><div className="teacher-table" role="table" aria-label="Class topic summary"><div className="teacher-table-head" role="row"><span role="columnheader">Subject / topic</span><span role="columnheader">Students needing practice</span><span role="columnheader">Lesson note</span></div>
        {demoTopics.map((item) => <div className="teacher-table-row" role="row" key={item.topic}><div role="cell"><span>{item.subject}</span><strong>{item.topic}</strong></div><div role="cell"><strong>{item.struggling} <small>/ {item.total}</small></strong></div><span className="teacher-trend" role="cell">{item.trend}</span></div>)}
      </div></section>
      <section className="teacher-doubts-section" aria-labelledby="student-doubts-title"><div className="teacher-section-heading"><div><span className="eyebrow">{doubtsConfigured ? "Shared class questions" : "Local-only mode"}</span><h2 id="student-doubts-title">Student doubts</h2></div>{doubtsConfigured && <span className="chart-key">{doubts.filter((doubt) => doubt.status !== "answered").length} need a reply</span>}</div>
        {doubtsLoading ? <div className="teacher-doubt-state" aria-busy="true"><span className="skeleton skeleton-copy" /><span className="skeleton skeleton-copy" /></div> : accessRequired ? <form className="teacher-unlock" onSubmit={(event) => void unlockTeacher(event)}><label htmlFor="teacher-code">Teacher access code</label><input id="teacher-code" type="password" autoComplete="current-password" value={teacherCode} onChange={(event) => setTeacherCode(event.target.value)} /><button className="primary-button" type="submit">Unlock shared doubts <span aria-hidden="true">→</span></button>{doubtsError && <p role="alert">{doubtsError}</p>}</form> : doubtsError ? <div className="empty-state" role="alert"><p>{doubtsError}</p><button className="outline-button" onClick={() => window.location.reload()}>Try again</button></div> : !doubtsConfigured ? <div className="empty-state"><span>Not connected</span><p>Shared student doubts appear here when optional Supabase storage is configured.</p></div> : doubts.length === 0 ? <div className="empty-state"><span>All clear</span><p>No student doubts have been submitted yet.</p></div> : <div className="teacher-doubt-list">{doubts.map((doubt) => <article className="teacher-doubt-row" key={doubt.id}><div className="teacher-doubt-meta"><strong>{doubt.nickname || "Student"}</strong><span>Class {doubt.grade} · {doubt.subject} · {new Date(doubt.created_at).toLocaleDateString()}</span><span className={`status-pill ${doubt.status === "answered" ? "status-ok" : "status-improving"}`}>{doubt.status === "answered" ? "Answered" : "New"}</span></div><p>{doubt.question}</p><p className="teacher-doubt-answer">{doubt.answer}</p>{doubt.status !== "answered" && <button className="outline-button" onClick={() => void markAnswered(doubt.id)}>Mark answered</button>}</article>)}</div>}
      </section>
      <Link href="/" className="primary-button teacher-cta">Start a student check <span aria-hidden="true">→</span></Link>
    </section>
  </DashboardFrame>;
}