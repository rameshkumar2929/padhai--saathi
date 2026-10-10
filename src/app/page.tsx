"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  chapters, createQuestionOrder, emptyProgress, freshPracticeQuestions, labels,
  questionSets, statusFor, statusLabel, storageKey, topicKey,
  type Language, type ProgressData, type Question, type ScoreEntry, type Status, type Subject, type Topic,
} from "@/lib/study";

type View = "start" | "check" | "results" | "learn" | "practice" | "progress";
const languageNames: Record<Language, string> = { en: "English", hi: "हिन्दी", gu: "ગુજરાતી" };

function explanationSteps(text: string) {
  return text.match(/[^.!?।]+[.!?।]?/g)?.map((step) => step.trim()).filter(Boolean) ?? [text];
}

function readProgress(): ProgressData {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? { ...emptyProgress(), ...JSON.parse(saved) as ProgressData } : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState<Subject>("math");
  const [chapterId, setChapterId] = useState(chapters[0].id);
  const [nickname, setNickname] = useState("");
  const [view, setView] = useState<View>("start");
  const [progress, setProgress] = useState<ProgressData>(emptyProgress);
  const [answers, setAnswers] = useState<number[]>([]);
  const [practiceAnswers, setPracticeAnswers] = useState<number[]>([]);
  const [practiceDone, setPracticeDone] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceTarget, setPracticeTarget] = useState<Topic | null>(null);
  const [message, setMessage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [extraQuestion, setExtraQuestion] = useState<Question | null>(null);
  const [extraAnswer, setExtraAnswer] = useState<number | null>(null);
  const [checkRound, setCheckRound] = useState(0);

  const t = labels[language];
  const selectedChapter = chapters.find((item) => item.id === chapterId) ?? chapters[0];
  const availableChapters = chapters.filter((item) => item.subject === subject);
  const diagnostic = useMemo(() => createQuestionOrder(selectedChapter.topics, checkRound * 3), [selectedChapter, checkRound]);
  const currentTopic = practiceTarget ?? selectedChapter.topics[0];
  const diagnosticScores = useMemo(() => selectedChapter.topics.map((topic) => {
    const indexes = diagnostic.map((item, index) => item.topic.id === topic.id ? index : -1).filter((index) => index >= 0);
    const score = indexes.filter((index) => answers[index] === diagnostic[index].question.a).length;
    return { topic, score, total: indexes.length, status: statusFor(score, indexes.length) };
  }), [answers, diagnostic, selectedChapter]);

  useEffect(() => {
    const restore = () => {
      setProgress(readProgress());
      const cachedNickname = localStorage.getItem("padhai-saathi-nickname");
      if (cachedNickname) setNickname(cachedNickname);
    };
    const restoreTimer = window.setTimeout(restore, 0);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "gu" ? "gu" : language === "hi" ? "hi" : "en";
    document.getElementById("regional-font")?.remove();
    if (language !== "en") {
      const link = document.createElement("link");
      link.id = "regional-font";
      link.rel = "stylesheet";
      link.href = language === "gu"
        ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap"
        : "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap";
      document.head.append(link);
    }
  }, [language]);

  function saveProgress(next: ProgressData) {
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setMessage(t.loadError); }
  }

  function selectedLabel(items: readonly string[]) {
    return items[language === "gu" ? 2 : language === "hi" ? 1 : 0];
  }

  function updateChapter(id: string) {
    setChapterId(id);
    setAnswers([]);
    setMessage("");
  }

  function beginCheck() {
    if (nickname.trim()) localStorage.setItem("padhai-saathi-nickname", nickname.trim().slice(0, 24));
    setCheckRound((value) => value + 1);
    setAnswers(Array(10).fill(-1));
    setMessage("");
    setView("check");
  }

  function submitCheck() {
    if (answers.some((answer) => answer < 0)) {
      setMessage(language === "hi" ? "आगे बढ़ने से पहले हर प्रश्न का उत्तर चुनें।" : language === "gu" ? "આગળ વધતાં પહેલાં દરેક પ્રશ્નનો જવાબ પસંદ કરો." : "Choose one answer for each question before continuing.");
      return;
    }
    const next = structuredClone(progress);
    const now = new Date().toISOString();
    const entries: ScoreEntry[] = [];
    for (const result of diagnosticScores) {
      const key = topicKey(selectedChapter.id, result.topic.id);
      const previous = next.topics[key];
      const savedStatus: Status = (previous?.successfulPracticeSessions ?? 0) >= 2 ? "ok" : result.status === "ok" ? "improving" : result.status;
      next.topics[key] = {
        status: savedStatus,
        mastery: previous?.mastery ?? Math.round((result.score / Math.max(result.total, 1)) * 100),
        successfulPracticeSessions: previous?.successfulPracticeSessions ?? 0,
        practiceSessions: previous?.practiceSessions ?? 0,
        updatedAt: now,
      };
      entries.push({ id: `${now}-${key}`, chapter: selectedChapter.id, chapterTitle: selectedChapter.title[0], topic: result.topic.id, topicTitle: result.topic.title[0], score: result.score, total: result.total, date: now, kind: "check" });
    }
    next.history = [...entries, ...next.history].slice(0, 100);
    saveProgress(next);
    setView("results");
  }

  function beginPractice(topic: Topic, questions?: Question[]) {
    const record = progress.topics[topicKey(selectedChapter.id, topic.id)];
    const count = questionSets[topic.family]?.questions.length ?? 1;
    const offset = (record?.practiceSessions ?? 0) % count;
    setPracticeTarget(topic);
    setPracticeQuestions(questions ?? freshPracticeQuestions(topic, offset));
    setPracticeIndex(0);
    setPracticeAnswers(Array(questions?.length ?? 5).fill(-1));
    setPracticeDone(false);
    setExtraQuestion(null);
    setExtraAnswer(null);
    setAiExplanation("");
    setMessage("");
    setView("practice");
  }

  function finishPractice() {
    if (practiceAnswers.some((answer) => answer < 0)) {
      setMessage(language === "hi" ? "आगे बढ़ने से पहले हर प्रश्न का उत्तर चुनें।" : language === "gu" ? "આગળ વધતાં પહેલાં દરેક પ્રશ્નનો જવાબ પસંદ કરો." : "Choose one answer for each question before continuing.");
      return;
    }
    const score = practiceAnswers.filter((answer, index) => answer === practiceQuestions[index]?.a).length;
    const key = topicKey(selectedChapter.id, currentTopic.id);
    const previous = progress.topics[key];
    const successfulPracticeSessions = (previous?.successfulPracticeSessions ?? 0) + (score > 0 ? 1 : 0);
    const practiceSessions = (previous?.practiceSessions ?? 0) + 1;
    const record = {
      status: (successfulPracticeSessions >= 2 ? "ok" : score > 0 || previous?.status === "improving" ? "improving" : "weak") as Status,
      mastery: Math.round(((previous?.mastery ?? 0) * (practiceSessions - 1) + (score / Math.max(practiceQuestions.length, 1)) * 100) / practiceSessions),
      successfulPracticeSessions,
      practiceSessions,
      updatedAt: new Date().toISOString(),
    };
    const now = new Date().toISOString();
    saveProgress({
      topics: { ...progress.topics, [key]: record },
      history: [{ id: `${now}-${key}-practice`, chapter: selectedChapter.id, chapterTitle: selectedChapter.title[0], topic: currentTopic.id, topicTitle: currentTopic.title[0], score, total: practiceQuestions.length, date: now, kind: "practice" as const }, ...progress.history].slice(0, 100),
    });
    setPracticeDone(true);
    setMessage(`${score}/${practiceQuestions.length} ${t.correct}`);
  }

  async function askSaathi(mode: "practice" | "simplify") {
    setAiBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, language, topic: currentTopic.title[0], family: currentTopic.family, grade }),
      });
      const data = await response.json() as { fallback?: boolean; question?: Question; explanation?: string };
      if (mode === "practice" && data.question) {
        setExtraQuestion(data.question);
        setExtraAnswer(null);
        setMessage(data.fallback ? t.aiFallback : t.aiReady);
      } else if (data.explanation) {
        setAiExplanation(data.explanation);
        setMessage(data.fallback ? t.aiExplainFallback : "");
      } else {
        throw new Error("No study content returned");
      }
    } catch {
      if (mode === "practice") {
        const fallback = freshPracticeQuestions(currentTopic, Date.now() % 5, 1)[0];
        if (fallback) setExtraQuestion(fallback);
        setExtraAnswer(null);
        setMessage(t.aiFallback);
      } else {
        setAiExplanation(questionSets[currentTopic.family]?.explanation[language === "gu" ? 2 : language === "hi" ? 1 : 0] ?? "");
        setMessage(t.aiExplainFallback);
      }
    } finally {
      setAiBusy(false);
    }
  }

  function clearProgress() {
    if (!window.confirm(t.resetConfirm)) return;
    localStorage.removeItem(storageKey);
    localStorage.removeItem("padhai-saathi-nickname");
    setProgress(emptyProgress());
    setNickname("");
  }

  function goHome() {
    setMessage("");
    setAiExplanation("");
    setExtraQuestion(null);
    setView("start");
  }

  const progressEntries = Object.entries(progress.topics);

  return <div className="site-shell" data-language={language}>
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Padhai Saathi home"><span className="brand-mark">પ</span><span>Padhai Saathi</span></Link>
      <nav aria-label="Main navigation" className="main-nav">
        <button className={view !== "progress" ? "nav-link active" : "nav-link"} onClick={goHome}>{t.navStudy}</button>
        <button className={view === "progress" ? "nav-link active" : "nav-link"} onClick={() => setView("progress")}>{t.navProgress}</button>
        <Link className="nav-link" href="/teacher">{t.navTeacher}</Link>
      </nav>
    </header>

    <main className="main-content">
      {view === "start" && <section className="start-screen">
        <div className="start-copy">
          <div className="eyebrow"><span className="eyebrow-dot" />{t.kicker}</div>
          <h1>{t.title}</h1>
          <p className="intro">{t.subtitle}</p>
          <div className="quiet-note"><span className="note-icon">01</span><span>{t.learningNote}</span></div>
        </div>
        <div className="start-form">
          <div className="field-group"><label>{t.language}</label><div className="segmented language-options" role="group" aria-label={t.language}>
            {(["gu", "hi", "en"] as Language[]).map((item) => <button key={item} type="button" className={language === item ? "segment selected" : "segment"} onClick={() => setLanguage(item)}>{languageNames[item]}</button>)}
          </div></div>
          <div className="field-group"><label>{t.grade}</label><div className="segmented grade-options" role="group" aria-label={t.grade}>
            {["8", "9", "10"].map((item) => <button key={item} type="button" className={grade === item ? "segment selected" : "segment"} onClick={() => setGrade(item)}>{item}</button>)}
          </div></div>
          <div className="field-group"><label>{t.subject}</label><div className="choice-grid">
            {(["math", "science"] as Subject[]).map((item) => <button key={item} className={subject === item ? "choice selected" : "choice"} onClick={() => { setSubject(item); updateChapter(chapters.find((chapter) => chapter.subject === item)?.id ?? chapters[0].id); }}><span className="choice-index">{item === "math" ? "M" : "S"}</span><span>{item === "math" ? t.math : t.science}</span><span className="choice-arrow">→</span></button>)}
          </div></div>
          <div className="field-group"><label htmlFor="chapter-select">{t.chapter}</label><select id="chapter-select" className="chapter-select" value={chapterId} onChange={(event) => updateChapter(event.target.value)}>
            {availableChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{selectedLabel(chapter.title)}</option>)}
          </select></div>
          <div className="field-group nickname-field"><label htmlFor="nickname">{t.nickname}</label><input id="nickname" maxLength={24} value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="nickname" /><span>{t.nicknameHint}</span></div>
          <button className="primary-button full-button" onClick={beginCheck}>{t.start}<span aria-hidden="true">→</span></button>
        </div>
        <div className="chapter-ribbon"><span>{t.classLabel} {grade}</span><span className="ribbon-separator" /><span>{selectedLabel(selectedChapter.title)}</span><span className="ribbon-count">{selectedChapter.topics.length} topics</span></div>
      </section>}

      {view === "check" && <section className="content-section">
        <button className="text-button" onClick={goHome}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{t.checkTitle}</h1><p>{t.checkSub}</p></div>
        <div className="check-progress"><span>{t.question} 1–{diagnostic.length} {t.of} {diagnostic.length}</span><span>{answers.filter((answer) => answer < 0).length} {language === "en" ? "left" : language === "hi" ? "बाकी" : "બાકી"}</span></div>
        <div className="question-list">{diagnostic.map(({ topic, question }, index) => <article className="question-card" key={`${topic.id}-${index}`}>
          <div className="question-meta"><span>{t.question} {index + 1}</span><span>{selectedLabel(topic.title)}</span></div><h2>{selectedLabel(question.p)}</h2>
          <div className="answer-options">{question.o.map((option, optionIndex) => <button key={optionIndex} onClick={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? optionIndex : value))} className={answers[index] === optionIndex ? "answer-option selected" : "answer-option"}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{selectedLabel(option)}</span></button>)}</div>
        </article>)}</div>
        {message && <p className="notice" role="status">{message}</p>}
        <button className="primary-button" onClick={submitCheck}>{t.submit}<span aria-hidden="true">→</span></button>
      </section>}

      {view === "results" && <section className="content-section">
        <div className="section-heading result-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{t.results}</h1><p>{t.total}: {diagnosticScores.reduce((sum, item) => sum + item.score, 0)}/{diagnostic.length}</p></div>
        <div className="topic-results">{diagnosticScores.map(({ topic, score, total, status }) => <article className="result-row" key={topic.id}>
          <div className="result-main"><div><h2>{selectedLabel(topic.title)}</h2><span className={`status-pill status-${status}`}>{statusLabel(status, language)}</span></div><span className="result-score">{score}<span>/{total}</span></span></div>
          <div className="score-track"><span style={{ width: `${Math.round(score / Math.max(total, 1) * 100)}%` }} /></div>
          <div className="result-actions"><button className="secondary-button" onClick={() => { setPracticeTarget(topic); setView("learn"); setAiExplanation(""); }}>{t.explain}</button><button className="outline-button" onClick={() => beginPractice(topic)}>{t.practice}</button></div>
        </article>)}</div>
        <button className="text-button return-button" onClick={goHome}>← {t.backHome}</button>
      </section>}

      {view === "learn" && <section className="content-section lesson-section">
        <button className="text-button" onClick={() => setView("results")}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{selectedLabel(currentTopic.title)}</h1></div>
        <article className="lesson-sheet"><div className="lesson-index">{t.explanation}</div><ol className="lesson-steps">{explanationSteps(questionSets[currentTopic.family]?.explanation[language === "gu" ? 2 : language === "hi" ? 1 : 0] ?? "").map((step, index) => <li key={index}>{step}</li>)}</ol>
          {aiExplanation && <div className="ai-explanation"><span>{t.steps}</span><ol className="lesson-steps ai-steps">{explanationSteps(aiExplanation).map((step, index) => <li key={index}>{step}</li>)}</ol></div>}{message && <p className="notice" role="status">{message}</p>}
        </article>
        <div className="lesson-actions"><button className="primary-button" onClick={() => beginPractice(currentTopic)}>{t.practice}<span aria-hidden="true">→</span></button><button className="outline-button" disabled={aiBusy} onClick={() => void askSaathi("simplify")}>{aiBusy ? "…" : t.simpler}</button></div>
      </section>}

      {view === "practice" && <section className="content-section">
        <button className="text-button" onClick={() => setView("results")}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{t.practiceTitle}</h1><p>{selectedLabel(currentTopic.title)}</p></div>
        {!practiceDone && practiceQuestions[practiceIndex] && <article className="question-card practice-card">
          <div className="question-meta"><span>{t.question} {practiceIndex + 1} {t.of} {practiceQuestions.length}</span><span>{selectedLabel(currentTopic.title)}</span></div><h2>{selectedLabel(practiceQuestions[practiceIndex].p)}</h2>
          <div className="answer-options">{practiceQuestions[practiceIndex].o.map((option, optionIndex) => <button key={optionIndex} onClick={() => setPracticeAnswers((current) => current.map((value, answerIndex) => answerIndex === practiceIndex ? optionIndex : value))} className={practiceAnswers[practiceIndex] === optionIndex ? "answer-option selected" : "answer-option"}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{selectedLabel(option)}</span></button>)}</div>
          {practiceAnswers[practiceIndex] >= 0 && <div className={practiceAnswers[practiceIndex] === practiceQuestions[practiceIndex].a ? "answer-feedback right" : "answer-feedback wrong"}>{selectedLabel(practiceQuestions[practiceIndex].e)}</div>}
          <div className="practice-controls">{practiceIndex > 0 && <button className="text-button" onClick={() => setPracticeIndex((value) => value - 1)}>← {t.back}</button>}
            {practiceIndex < practiceQuestions.length - 1 ? <button className="primary-button" onClick={() => { if (practiceAnswers[practiceIndex] < 0) setMessage(t.answerFirst); else { setPracticeIndex((value) => value + 1); setMessage(""); } }}>{t.nextQuestion}<span aria-hidden="true">→</span></button> : <button className="primary-button" onClick={finishPractice}>{t.finishPractice}<span aria-hidden="true">→</span></button>}
          </div>
        </article>}
        {practiceDone && <article className="session-complete"><div className="completion-mark">{practiceAnswers.filter((answer, index) => answer === practiceQuestions[index]?.a).length}</div><div className="eyebrow">{t.sessionResult}</div><h2>{message}</h2><p>{progress.topics[topicKey(selectedChapter.id, currentTopic.id)]?.successfulPracticeSessions ?? 0} {t.correctSessions}</p><div className="lesson-actions"><button className="primary-button" onClick={() => beginPractice(currentTopic)}>{t.nextSession}<span aria-hidden="true">→</span></button><button className="outline-button" onClick={() => setView("results")}>{t.results}</button></div></article>}
        <div className="ai-tools"><button className="text-button" disabled={aiBusy} onClick={() => void askSaathi("practice")}>{aiBusy ? "…" : t.aiPractice}</button>{extraQuestion && <div className="extra-question"><span className="eyebrow">{message}</span><h2>{selectedLabel(extraQuestion.p)}</h2><div className="answer-options">{extraQuestion.o.map((option, index) => <button key={index} className={extraAnswer === index ? "answer-option selected" : "answer-option"} onClick={() => setExtraAnswer(index)}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{selectedLabel(option)}</span></button>)}</div>{extraAnswer !== null && <div className={extraAnswer === extraQuestion.a ? "answer-feedback right" : "answer-feedback wrong"}>{selectedLabel(extraQuestion.e)}</div>}</div>}</div>
        {message && !practiceDone && !extraQuestion && <p className="notice" role="status">{message}</p>}
      </section>}

      {view === "progress" && <section className="content-section progress-section">
        <div className="section-heading"><div className="eyebrow">{t.learningNote}</div><h1>{t.progressTitle}</h1><p>{t.classLabel} {grade}</p></div>
        {progressEntries.length === 0 ? <div className="empty-state"><span>01</span><p>{t.noProgress}</p><button className="primary-button" onClick={goHome}>{t.start}<span aria-hidden="true">→</span></button></div> : <>
          <div className="progress-counts">{(["weak", "improving", "ok"] as Status[]).map((status) => <div className={`count-block count-${status}`} key={status}><span>{progressEntries.filter(([, record]) => record.status === status).length}</span><small>{statusLabel(status, language)}</small></div>)}</div>
          <h2 className="subheading">{t.allTopics}</h2><div className="progress-topic-list">{progressEntries.map(([key, record]) => {
            const [chapterKey, topicId] = key.split(":");
            const chapter = chapters.find((item) => item.id === chapterKey);
            const topic = chapter?.topics.find((item) => item.id === topicId);
            if (!topic || !chapter) return null;
            return <div className="progress-topic" key={key}><div><strong>{selectedLabel(topic.title)}</strong><span>{selectedLabel(chapter.title)}</span></div><span className={`status-pill status-${record.status}`}>{statusLabel(record.status, language)}</span><div className="mastery-cell"><span>{t.mastery}</span><strong>{record.mastery}%</strong></div></div>;
          })}</div>
        </>}
        <h2 className="subheading history-heading">{t.history}</h2>
        {progress.history.length === 0 ? <p className="muted-copy">{t.noProgress}</p> : <div className="history-list">{progress.history.slice(0, 12).map((entry) => {
          const title = chapters.find((item) => item.id === entry.chapter)?.topics.find((item) => item.id === entry.topic)?.title ?? [entry.topicTitle, entry.topicTitle, entry.topicTitle];
          return <div className="history-row" key={entry.id}><div><strong>{selectedLabel(title)}</strong><span>{entry.kind === "check" ? t.checkTitle : t.practiceTitle} · {new Date(entry.date).toLocaleDateString(language === "gu" ? "gu-IN" : language === "hi" ? "hi-IN" : "en-IN")}</span></div><b>{entry.score}/{entry.total}</b></div>;
        })}</div>}
        <button className="text-button clear-button" onClick={clearProgress}>{t.clear}</button>
      </section>}
    </main>
    <footer className="site-footer"><span>{t.footer}</span><span>SDG 4 <i aria-hidden="true" /></span></footer>
  </div>;
}