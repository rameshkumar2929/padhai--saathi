"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandMark from "@/components/BrandMark";
import { coreLanguage, getLanguage, isLanguage, LANGUAGES, translationStorageKey } from "@/lib/languages";
import {
  chapters, createPrerequisiteCheck, createQuestionOrder, emptyProgress, freshPracticeQuestions, labels,
  prerequisiteMap, questionSets, statusFor, statusLabel, storageKey, topicKey,
  type Language, type ProgressData, type Question, type ScoreEntry, type Status, type Subject, type Topic,
} from "@/lib/study";

type View = "start" | "prerequisite" | "check" | "results" | "learn" | "practice" | "progress" | "plan" | "exam";
type Theme = "dark" | "light";
type ExamQuestion = { topic: Topic; question: Question };
type DailyActivity = { date: string; answered: number; streak: number; lastStudyDay: string };
const dailyActivityKey = "padhai-saathi-daily-activity-v1";
const dailyGoal = 10;

function dayStamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readDailyActivity(): DailyActivity {
  const today = dayStamp();
  const empty: DailyActivity = { date: today, answered: 0, streak: 0, lastStudyDay: "" };
  try {
    const saved = localStorage.getItem(dailyActivityKey);
    if (!saved) return empty;
    const activity = { ...empty, ...JSON.parse(saved) as DailyActivity };
    if (activity.date === today) return activity;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { ...activity, date: today, answered: 0, streak: activity.lastStudyDay === dayStamp(yesterday) ? activity.streak : 0 };
  } catch {
    return empty;
  }
}

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
  const [theme, setTheme] = useState<Theme>("dark");
  const [lowData, setLowData] = useState(false);
  const [simpleReading, setSimpleReading] = useState(false);
  const [hasSpeechVoice, setHasSpeechVoice] = useState(false);
  const [speechNote, setSpeechNote] = useState("");
  const [languageSearch, setLanguageSearch] = useState<string>(getLanguage("en").nativeName);
  const [translatedText, setTranslatedText] = useState<Record<string, string>>({});
  const [translationState, setTranslationState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState<Subject>("math");
  const [chapterId, setChapterId] = useState(chapters[0].id);
  const [nickname, setNickname] = useState("");
  const [view, setView] = useState<View>("start");
  const [progress, setProgress] = useState<ProgressData>(emptyProgress);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity>({ date: "", answered: 0, streak: 0, lastStudyDay: "" });
  const [prerequisiteQuestions, setPrerequisiteQuestions] = useState<{ topic: Topic; question: Question }[]>([]);
  const [prerequisiteAnswers, setPrerequisiteAnswers] = useState<number[]>([]);
  const [prerequisiteScore, setPrerequisiteScore] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [practiceAnswers, setPracticeAnswers] = useState<number[]>([]);
  const [practiceDone, setPracticeDone] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceTarget, setPracticeTarget] = useState<Topic | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<number[]>([]);
  const [examSeconds, setExamSeconds] = useState(600);
  const [examDone, setExamDone] = useState(false);
  const [message, setMessage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [extraQuestion, setExtraQuestion] = useState<Question | null>(null);
  const [extraAnswer, setExtraAnswer] = useState<number | null>(null);
  const [checkRound, setCheckRound] = useState(0);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [celebrationTopic, setCelebrationTopic] = useState<string | null>(null);

  const selectedChapter = chapters.find((item) => item.id === chapterId) ?? chapters[0];
  const availableChapters = chapters.filter((item) => item.subject === subject);
  const diagnostic = useMemo(() => createQuestionOrder(selectedChapter.topics, checkRound * 3), [selectedChapter, checkRound]);
  const currentTopic = practiceTarget ?? selectedChapter.topics[0];
  const diagnosticScores = useMemo(() => selectedChapter.topics.map((topic) => {
    const indexes = diagnostic.map((item, index) => item.topic.id === topic.id ? index : -1).filter((index) => index >= 0);
    const score = indexes.filter((index) => answers[index] === diagnostic[index].question.a).length;
    return { topic, score, total: indexes.length, status: statusFor(score, indexes.length) };
  }), [answers, diagnostic, selectedChapter]);
  const planEntries = useMemo(() => selectedChapter.topics.map((topic) => {
    const record = progress.topics[topicKey(selectedChapter.id, topic.id)];
    return { topic, record, priority: record?.status === "weak" ? 0 : record?.status === "improving" ? 1 : record?.status === "ok" ? 3 : 2 };
  }).filter((item) => item.priority < 3).sort((left, right) => left.priority - right.priority), [progress, selectedChapter]);
  const prerequisiteEntries = useMemo(() => (prerequisiteMap[selectedChapter.id] ?? []).map((family) => {
    const topic = chapters.flatMap((chapter) => chapter.topics).find((item) => item.family === family);
    if (!topic) return null;
    const records = Object.entries(progress.topics).filter(([key]) => key.endsWith(`:${topic.id}`)).map(([, record]) => record);
    const record = records.find((item) => item.status === "weak") ?? records.find((item) => item.status === "improving") ?? records[0];
    return { topic, record, priority: record?.status === "weak" || !record ? 0 : record.status === "improving" ? 1 : 2 };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null).sort((left, right) => left.priority - right.priority), [progress, selectedChapter]);
  const translationTexts = useMemo(() => {
    if (["en", "hi", "gu"].includes(language)) return [];
    const values = new Set<string>(Object.values(labels.en));
    const add = (text: string) => { if (text.trim()) values.add(text); };
    ["Topics", "Keep an eye on each skill as you go.", "Learning over time", "Score history", "Score", "Classroom pulse", "Topics needing attention", "Students needing practice", "Topic details", "Today's goal", "questions", "day streak", "My plan", "A small next step, ordered around what needs attention first.", "Step 1", "Prerequisites to revisit", "No earlier skills are needed for this chapter.", "A quick check will show what to revise", "Explain", "Practise", "Needs a check", "Step 2", "Chapter topics", "Take a chapter check to get a personal revision order.", "Not checked", "Ask a doubt", "Board exam", "Start board-exam practice", "Mixed practice", "Board-exam practice", "Questions are drawn from topics you have already practised.", "Start with one topic", "Practise a topic first; your mixed exam will appear here.", "Time left", "answered", "Finish exam", "Exam complete", "correct", "Your topic history has been updated on this device.", "Read aloud", "This week", "Topics improved", "Topics to revisit", "Share on WhatsApp", "No study sessions yet this week."].forEach(add);
    const addQuestion = (question: Question) => {
      question.p.forEach(add);
      question.o.flat().forEach(add);
      question.e.forEach(add);
    };
    chapters.forEach((chapter) => chapter.title.forEach(add));
    selectedChapter.topics.forEach((topic) => topic.title.forEach(add));
    if (view === "check") diagnostic.forEach(({ question, topic }) => { addQuestion(question); topic.title.forEach(add); });
    if (view === "learn") questionSets[currentTopic.family]?.explanation.forEach(add);
    if (view === "practice") {
      const question = practiceQuestions[practiceIndex];
      if (question) addQuestion(question);
      if (extraQuestion) addQuestion(extraQuestion);
    }
    if (view === "exam") examQuestions.forEach(({ question }) => addQuestion(question));
    if (view === "progress") {
      Object.keys(progress.topics).forEach((key) => {
        const [chapterId, topicId] = key.split(":");
        chapters.find((chapter) => chapter.id === chapterId)?.topics.find((topic) => topic.id === topicId)?.title.forEach(add);
      });
      progress.history.slice(0, 12).forEach((entry) => add(entry.topicTitle));
    }
    if (view === "plan") {
      prerequisiteEntries.forEach(({ topic }) => topic.title.forEach(add));
      planEntries.forEach(({ topic }) => topic.title.forEach(add));
    }
    return [...values];
  }, [currentTopic.family, diagnostic, examQuestions, extraQuestion, language, planEntries, practiceIndex, practiceQuestions, prerequisiteEntries, progress, selectedChapter, view]);
  const baseLabels = labels[coreLanguage(language)];
  const t = language === "en" || language === "hi" || language === "gu"
    ? baseLabels
    : Object.fromEntries(Object.entries(baseLabels).map(([key, value]) => [key, translatedText[value] ?? value])) as Record<keyof typeof labels.en, string>;

  useEffect(() => {
    const restore = () => {
      setProgress(readProgress());
      setDailyActivity(readDailyActivity());
      setCurrentTime(Date.now());
      try {
        const cachedNickname = localStorage.getItem("padhai-saathi-nickname");
        if (cachedNickname) setNickname(cachedNickname);
        const savedLanguage = localStorage.getItem("padhai-saathi-language");
        const savedGrade = localStorage.getItem("padhai-saathi-grade");
        const savedSubject = localStorage.getItem("padhai-saathi-subject");
        const savedTheme = localStorage.getItem("padhai-saathi-theme");
        const savedLowData = localStorage.getItem("padhai-saathi-low-data");
        const savedSimpleReading = localStorage.getItem("padhai-saathi-simple-reading");
        if (isLanguage(savedLanguage)) setLanguage(savedLanguage);
        if (["8", "9", "10"].includes(savedGrade ?? "")) setGrade(savedGrade ?? "8");
        if (savedSubject === "math" || savedSubject === "science") setSubject(savedSubject);
        if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
        else if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
        if (savedLowData !== null) setLowData(savedLowData === "true");
        if (savedSimpleReading !== null) setSimpleReading(savedSimpleReading === "true");
        else {
          const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
          if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType ?? "")) setLowData(true);
        }
      } catch {
        setMessage(t.loadError);
      }
      if (new URLSearchParams(window.location.search).get("view") === "progress") setView("progress");
      setReady(true);
    };
    const restoreTimer = window.setTimeout(restore, 0);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    const selectedLanguage = getLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = selectedLanguage.direction;
    document.getElementById("regional-font")?.remove();
    if (selectedLanguage.fontFamily) document.documentElement.style.setProperty("--script-font", `"${selectedLanguage.fontFamily}"`);
    else document.documentElement.style.removeProperty("--script-font");
    if (selectedLanguage.fontFamily) {
      const link = document.createElement("link");
      link.id = "regional-font";
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(selectedLanguage.fontFamily).replace(/%20/g, "+")}&display=swap`;
      document.head.append(link);
    }
  }, [language]);

  useEffect(() => {
    const updateVoices = () => setHasSpeechVoice(window.speechSynthesis?.getVoices().some((voice) => voice.lang.toLowerCase().startsWith(language.toLowerCase())) ?? false);
    updateVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", updateVoices);
  }, [language]);

  useEffect(() => setLanguageSearch(getLanguage(language).nativeName), [language]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("padhai-saathi-language", language);
      localStorage.setItem("padhai-saathi-grade", grade);
      localStorage.setItem("padhai-saathi-subject", subject);
    } catch {
      setMessage(t.loadError);
    }
  }, [grade, language, ready, subject]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("padhai-saathi-theme", theme);
      localStorage.setItem("padhai-saathi-low-data", String(lowData));
      localStorage.setItem("padhai-saathi-simple-reading", String(simpleReading));
    } catch {
      setMessage(t.loadError);
    }
  }, [lowData, ready, simpleReading, theme]);

  useEffect(() => {
    if (!ready || !dailyActivity.date) return;
    try { localStorage.setItem(dailyActivityKey, JSON.stringify(dailyActivity)); } catch { setMessage(t.loadError); }
  }, [dailyActivity, ready]);

  useEffect(() => {
    if (view !== "exam" || examDone || examQuestions.length === 0) return;
    const timer = window.setInterval(() => setExamSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [examDone, examQuestions.length, view]);

  useEffect(() => {
    if (view === "exam" && examQuestions.length > 0 && examSeconds === 0 && !examDone) finishBoardExam();
  }, [examDone, examQuestions.length, examSeconds, view]);

  useEffect(() => {
    if (["en", "hi", "gu"].includes(language)) {
      setTranslatedText({});
      setTranslationState("idle");
      return;
    }
    let cancelled = false;
    let cached: Record<string, string> = {};
    try {
      const saved = localStorage.getItem(translationStorageKey);
      const allLanguages = saved ? JSON.parse(saved) as Record<string, Record<string, string>> : {};
      cached = allLanguages[language] ?? {};
    } catch {
      cached = {};
    }
    setTranslatedText(cached);
    const missing = translationTexts.filter((text) => !cached[text]);
    if (missing.length === 0) {
      setTranslationState("ready");
      return () => { cancelled = true; };
    }
    setTranslationState("loading");
    async function loadTranslations() {
      for (let index = 0; index < missing.length; index += 40) {
        const texts = missing.slice(index, index + 40);
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, texts }),
        });
        if (!response.ok) throw new Error("Translation unavailable");
        const result = await response.json() as { fallback?: boolean; translations?: string[] };
        if (result.fallback || result.translations?.length !== texts.length) throw new Error("Translation unavailable");
        texts.forEach((text, itemIndex) => { cached[text] = result.translations?.[itemIndex] ?? text; });
        if (cancelled) return;
        setTranslatedText({ ...cached });
        try {
          const saved = localStorage.getItem(translationStorageKey);
          const allLanguages = saved ? JSON.parse(saved) as Record<string, Record<string, string>> : {};
          allLanguages[language] = { ...allLanguages[language], ...cached };
          localStorage.setItem(translationStorageKey, JSON.stringify(allLanguages));
        } catch {
          setTranslationState("fallback");
        }
      }
      if (!cancelled) setTranslationState("ready");
    }
    void loadTranslations().catch(() => { if (!cancelled) setTranslationState("fallback"); });
    return () => { cancelled = true; };
  }, [language, translationTexts]);

  function saveProgress(next: ProgressData) {
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setMessage(t.loadError); }
  }

  function recordDailyQuestions(amount: number) {
    setDailyActivity((current) => {
      const today = dayStamp();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const streak = current.lastStudyDay === today ? current.streak : current.lastStudyDay === dayStamp(yesterday) ? current.streak + 1 : 1;
      return { date: today, answered: (current.date === today ? current.answered : 0) + amount, streak, lastStudyDay: today };
    });
  }

  function startBoardExam() {
    const studiedFamilies = [...new Set(Object.entries(progress.topics).flatMap(([key, record]) => {
      if (record.practiceSessions < 1 && record.status === "weak") return [];
      const [chapterId, topicId] = key.split(":");
      const chapter = chapters.find((item) => item.id === chapterId);
      const topic = chapter?.topics.find((item) => item.id === topicId);
      return topic ? [topic.family] : [];
    }))];
    const generated = Array.from({ length: studiedFamilies.length > 0 ? 10 : 0 }, (_, index) => {
      const family = studiedFamilies[index % studiedFamilies.length];
      const questions = questionSets[family]?.questions ?? [];
      const topic = chapters.flatMap((chapter) => chapter.topics).find((item) => item.family === family);
      if (!topic || questions.length === 0) return null;
      return { topic, question: questions[Math.floor(index / studiedFamilies.length) % questions.length] };
    }).filter((item): item is ExamQuestion => item !== null);
    setExamQuestions(generated);
    setExamAnswers(Array(generated.length).fill(-1));
    setExamSeconds(600);
    setExamDone(false);
    setMessage("");
    setView("exam");
  }

  function finishBoardExam() {
    if (examAnswers.some((answer) => answer < 0) && examSeconds > 0) {
      setMessage("Answer each question before ending the exam.");
      return;
    }
    const now = new Date().toISOString();
    const entries: ScoreEntry[] = examQuestions.map(({ topic, question }, index) => {
      const chapter = chapters.find((item) => item.topics.some((candidate) => candidate.family === topic.family && candidate.id === topic.id)) ?? selectedChapter;
      const score = examAnswers[index] === question.a ? 1 : 0;
      return { id: `${now}-${index}-exam`, chapter: chapter.id, chapterTitle: chapter.title[0], topic: topic.id, topicTitle: topic.title[0], score, total: 1, date: now, kind: "exam" };
    });
    saveProgress({ ...progress, history: [...entries, ...progress.history].slice(0, 100) });
    recordDailyQuestions(examQuestions.length);
    setExamDone(true);
    setMessage(`${examAnswers.filter((answer, index) => answer === examQuestions[index]?.question.a).length}/${examQuestions.length}`);
  }

  function selectedLabel(items: readonly string[]) {
    const source = items[language === "gu" ? 2 : language === "hi" ? 1 : 0];
    return language === "en" || language === "hi" || language === "gu" ? source : translatedText[items[0]] ?? items[0];
  }

  function selectedText(text: string) {
    return language === "en" || language === "hi" || language === "gu" ? text : translatedText[text] ?? text;
  }

  function readAloud(text: string) {
    const voice = window.speechSynthesis?.getVoices().find((item) => item.lang.toLowerCase().startsWith(language.toLowerCase()));
    if (!voice) {
      setSpeechNote(`Read aloud is not available for ${getLanguage(language).name} on this device.`);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeechNote("");
  }

  function updateChapter(id: string) {
    setChapterId(id);
    setAnswers([]);
    setMessage("");
  }

  function startChapterCheck() {
    setCheckRound((value) => value + 1);
    setAnswers(Array(10).fill(-1));
    setMessage("");
    setView("check");
  }

  function beginCheck() {
    if (nickname.trim()) localStorage.setItem("padhai-saathi-nickname", nickname.trim().slice(0, 24));
    setPrerequisiteScore(null);
    const questions = createPrerequisiteCheck(selectedChapter.id, 5);
    if (questions.length > 0) {
      setPrerequisiteQuestions(questions);
      setPrerequisiteAnswers(Array(questions.length).fill(-1));
      setMessage("");
      setView("prerequisite");
      return;
    }
    startChapterCheck();
  }

  function submitPrerequisiteCheck() {
    if (prerequisiteAnswers.some((answer) => answer < 0)) {
      setMessage(t.answerFirst);
      return;
    }
    setPrerequisiteScore(prerequisiteAnswers.filter((answer, index) => answer === prerequisiteQuestions[index]?.question.a).length);
    startChapterCheck();
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
    recordDailyQuestions(answers.length);
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
    recordDailyQuestions(practiceAnswers.length);
    if (record.status === "ok" && previous?.status !== "ok") {
      setCelebrationTopic(currentTopic.id);
      window.setTimeout(() => setCelebrationTopic(null), 1800);
    }
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
        body: JSON.stringify({ mode, language, topic: currentTopic.title[0], family: currentTopic.family, grade, lowData }),
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
        setAiExplanation(questionSets[currentTopic.family]?.explanation[coreLanguage(language) === "gu" ? 2 : coreLanguage(language) === "hi" ? 1 : 0] ?? "");
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
  const weekCutoff = currentTime - 7 * 24 * 60 * 60 * 1000;
  const weeklyHistory = progress.history.filter((entry) => new Date(entry.date).getTime() >= weekCutoff);
  const improvedThisWeek = progressEntries.flatMap(([key, record]) => {
    if ((record.status !== "ok" && record.status !== "improving") || new Date(record.updatedAt).getTime() < weekCutoff) return [];
    const [chapterId, topicId] = key.split(":");
    const topic = chapters.find((chapter) => chapter.id === chapterId)?.topics.find((item) => item.id === topicId);
    return topic ? [selectedLabel(topic.title)] : [];
  });
  const weakThisWeek = progressEntries.flatMap(([key, record]) => {
    if (record.status !== "weak") return [];
    const [chapterId, topicId] = key.split(":");
    const topic = chapters.find((chapter) => chapter.id === chapterId)?.topics.find((item) => item.id === topicId);
    return topic ? [selectedLabel(topic.title)] : [];
  });
  const weeklyShareText = `Padhai Saathi weekly progress: ${weeklyHistory.length} study results, ${improvedThisWeek.length} topics improving, ${dailyActivity.streak}-day streak. Topics to revisit: ${weakThisWeek.join(", ") || "none"}.`;

  return <div className="site-shell" data-language={language} data-theme={theme} data-low-data={lowData} data-simple-reading={simpleReading}>
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Padhai Saathi home"><BrandMark /><span>Padhai Saathi</span></Link>
      <nav aria-label="Main navigation" className="main-nav">
        <button className={view !== "progress" ? "nav-link active" : "nav-link"} onClick={goHome}>{t.navStudy}</button>
        <button className={view === "plan" ? "nav-link active" : "nav-link"} onClick={() => setView("plan")}>My plan</button>
        <button className={view === "exam" ? "nav-link active" : "nav-link"} onClick={startBoardExam}>{selectedText("Board exam")}</button>
        <button className={view === "progress" ? "nav-link active" : "nav-link"} onClick={() => setView("progress")}>{t.navProgress}</button>
        <Link className="nav-link" href="/teacher">{t.navTeacher}</Link>
        <Link className="nav-link nav-doubts" href="/doubts">Doubts</Link>
      </nav>
      <div className="header-settings">
        <button className={lowData ? "setting-toggle active" : "setting-toggle"} type="button" aria-pressed={lowData} onClick={() => setLowData((current) => !current)} title="Toggle low-data mode">Low data {lowData ? "On" : "Off"}</button>
        <button className={simpleReading ? "setting-toggle active" : "setting-toggle"} type="button" aria-pressed={simpleReading} onClick={() => setSimpleReading((current) => !current)} title="Toggle simple-reading mode">Simple text {simpleReading ? "On" : "Off"}</button>
        <button className="setting-toggle theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      </div>
      <label className="sr-only" htmlFor="nav-language">{t.language}</label>
      <input id="nav-language" className="nav-language" type="search" list="language-options" value={languageSearch} onChange={(event) => {
        const query = event.target.value;
        setLanguageSearch(query);
        const selected = LANGUAGES.find((item) => item.nativeName.toLocaleLowerCase() === query.toLocaleLowerCase() || item.name.toLocaleLowerCase() === query.toLocaleLowerCase());
        if (selected) setLanguage(selected.code);
      }} aria-label={t.language} autoComplete="off" />
      <datalist id="language-options">{LANGUAGES.map((item) => <option key={item.code} value={item.nativeName} label={item.name} />)}</datalist>
    </header>
    {!["en", "hi", "gu"].includes(language) && <div className={`translation-notice translation-${translationState}`} role="status">
      {translationState === "ready" ? "AI-translated" : translationState === "loading" ? "Translating study text…" : "Translation unavailable. English text is shown."}
    </div>}
    {speechNote && <p className="speech-note" role="status">{speechNote}</p>}

    <main className="main-content">
      {!ready ? <section className="app-skeleton" aria-label="Loading study dashboard" aria-busy="true"><span className="skeleton skeleton-kicker" /><span className="skeleton skeleton-title" /><span className="skeleton skeleton-copy" /><span className="skeleton skeleton-panel" /></section> : <>
      {view === "start" && <section className="start-screen">
        <div className="start-copy">
          <div className="eyebrow"><span className="eyebrow-dot" />{t.kicker}</div>
          <h1>{t.title}</h1>
          <p className="intro">{t.subtitle}</p>
          <div className="quiet-note"><span className="note-icon">01</span><span>{t.learningNote}</span></div>
        </div>
        <div className="hero-art" role="img" aria-label="A student learning with a phone, books and a lightbulb">
          <svg viewBox="0 0 520 430" aria-hidden="true" focusable="false">
            <ellipse cx="267" cy="380" rx="206" ry="24" fill="#dce9df" />
            <circle cx="273" cy="196" r="165" fill="#e9f2ec" />
            <path d="M106 284c34-47 63-58 104-40 33 15 54 40 85 29 39-14 47-55 108-50 32 3 57 22 77 52v87H106z" fill="#d4e6dc" />
            <path d="M355 69c0-24 19-43 43-43s43 19 43 43c0 15-8 28-19 36-7 5-11 13-11 22h-26c0-9-4-17-11-22-11-8-19-21-19-36z" fill="#f5c45f" />
            <path d="M376 135h43m-37 12h31" stroke="#b97715" strokeWidth="5" strokeLinecap="round" />
            <path d="M398 4V0m-51 18-8-8m110 8 8-8m-90 117v11m61-11v11" stroke="#d79a2b" strokeWidth="4" strokeLinecap="round" />
            <path d="M210 189c0-37 27-67 61-67s61 30 61 67v7H210z" fill="#153c39" />
            <path d="M218 187c0-33 23-57 53-57s53 24 53 57v28c0 35-23 61-53 61s-53-26-53-61z" fill="#a96543" />
            <path d="M218 195c16-6 28-17 38-34 16 15 39 24 68 25v-18c0-28-22-51-53-51s-53 23-53 51z" fill="#153c39" />
            <path d="M244 220h2m48 0h2" stroke="#153c39" strokeWidth="6" strokeLinecap="round" />
            <path d="M251 243c8 7 18 7 26 0" fill="none" stroke="#7d3d31" strokeWidth="4" strokeLinecap="round" />
            <path d="M188 327c7-46 35-72 82-72s75 26 82 72v50H188z" fill="#08766d" />
            <path d="m244 258 25 25 25-25" fill="#f8f7f1" />
            <path d="M199 315 160 348m183-33 38 32" stroke="#a96543" strokeWidth="21" strokeLinecap="round" />
            <path d="M386 322h75v10h-75z" fill="#d79a2b" />
            <path d="M379 332h88v11h-88z" fill="#075b56" />
            <path d="M390 343h75v11h-75z" fill="#eaa740" />
            <rect x="110" y="312" width="47" height="67" rx="7" fill="#fffefa" stroke="#b5ccc0" strokeWidth="3" />
            <rect x="119" y="302" width="47" height="67" rx="7" transform="rotate(8 119 302)" fill="#e7a83d" />
            <rect x="117" y="310" width="47" height="67" rx="7" transform="rotate(8 117 310)" fill="#fffefa" stroke="#d8e4dc" strokeWidth="3" />
            <path d="m145 330 23-3 6 49-23 3z" fill="#075b56" />
            <rect x="168" y="288" width="47" height="82" rx="8" transform="rotate(-8 168 288)" fill="#153c39" />
            <rect x="174" y="294" width="35" height="66" rx="4" transform="rotate(-8 174 294)" fill="#bfe0d5" />
            <circle cx="194" cy="351" r="2" fill="#075b56" />
            <path d="M84 108h54m-27-27v54" stroke="#d79a2b" strokeWidth="5" strokeLinecap="round" opacity=".8" />
            <circle cx="410" cy="228" r="7" fill="#e6a43c" />
            <circle cx="134" cy="184" r="5" fill="#08766d" />
          </svg>
        </div>
        <div className="start-form">
          <div className="field-group"><label>{t.language}</label><div className="segmented language-options" role="group" aria-label={t.language}>
            {(["gu", "hi", "en"] as Language[]).map((item) => <button key={item} type="button" className={language === item ? "segment selected" : "segment"} onClick={() => setLanguage(item)}>{getLanguage(item).nativeName}</button>)}
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
        <div className="daily-goal-strip" aria-label="Daily study goal">
          <div className="daily-goal-details"><span>{selectedText("Today's goal")}</span><strong>{Math.min(dailyActivity.answered, dailyGoal)}/{dailyGoal} {selectedText("questions")}</strong><div className="progress-track" role="progressbar" aria-label="Daily question goal" aria-valuemin={0} aria-valuemax={dailyGoal} aria-valuenow={Math.min(dailyActivity.answered, dailyGoal)}><span style={{ width: `${Math.min(dailyActivity.answered / dailyGoal * 100, 100)}%` }} /></div></div>
          <div className="daily-streak"><strong>{dailyActivity.streak}</strong><span>{selectedText("day streak")}</span></div><button className="text-button daily-plan-link" onClick={() => setView("plan")}>My plan</button>
        </div>
        <div className="chapter-ribbon"><span>{t.classLabel} {grade}</span><span className="ribbon-separator" /><span>{selectedLabel(selectedChapter.title)}</span><span className="ribbon-count">{selectedChapter.topics.length} topics</span></div>
      </section>}

      {view === "prerequisite" && <section className="content-section">
        <button className="text-button" onClick={goHome}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>Quick prerequisite check</h1><p>Warm up with five skills that help with this chapter.</p></div>
        <div className="check-progress"><span>{t.question} 1–{prerequisiteQuestions.length} {t.of} {prerequisiteQuestions.length}</span><span>{prerequisiteAnswers.filter((answer) => answer < 0).length} left</span></div>
        <div className="progress-track check-track" role="progressbar" aria-label="Prerequisite questions answered" aria-valuemin={0} aria-valuemax={prerequisiteQuestions.length} aria-valuenow={prerequisiteAnswers.filter((answer) => answer >= 0).length}><span style={{ width: `${prerequisiteAnswers.filter((answer) => answer >= 0).length / prerequisiteQuestions.length * 100}%` }} /></div>
        <div className="question-list prerequisite-list">{prerequisiteQuestions.map(({ topic, question }, index) => <article className="question-card" key={`${topic.family}-${index}`}><div className="question-meta"><span>{t.question} {index + 1}</span><span>{selectedLabel(topic.title)}</span></div><h2>{selectedLabel(question.p)}</h2>{hasSpeechVoice && <button className="text-button voice-button" type="button" onClick={() => readAloud(selectedLabel(question.p))}>{selectedText("Read aloud")}</button>}<div className="answer-options">{question.o.map((option, optionIndex) => <button key={optionIndex} className={prerequisiteAnswers[index] === optionIndex ? "answer-option selected" : "answer-option"} onClick={() => setPrerequisiteAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? optionIndex : value))}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{selectedLabel(option)}</span></button>)}</div></article>)}</div>
        {message && <p className="notice" role="status">{message}</p>}
        <button className="primary-button" onClick={submitPrerequisiteCheck}>Continue to chapter check <span aria-hidden="true">→</span></button>
      </section>}

      {view === "check" && <section className="content-section">
        <button className="text-button" onClick={goHome}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{t.checkTitle}</h1><p>{t.checkSub}</p></div>
        <div className="check-progress"><span>{t.question} 1–{diagnostic.length} {t.of} {diagnostic.length}</span><span>{answers.filter((answer) => answer < 0).length} {language === "en" ? "left" : language === "hi" ? "बाकी" : "બાકી"}</span></div>
        <div className="progress-track check-track" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={diagnostic.length} aria-valuenow={answers.filter((answer) => answer >= 0).length}><span style={{ width: `${answers.filter((answer) => answer >= 0).length / diagnostic.length * 100}%` }} /></div>
        <div className="check-layout"><div className="check-main"><div className="question-list">{diagnostic.map(({ topic, question }, index) => <article className="question-card" key={`${topic.id}-${index}`}>
          <div className="question-meta"><span>{t.question} {index + 1}</span><span>{selectedLabel(topic.title)}</span>{translationState === "ready" && !["en", "hi", "gu"].includes(language) && <span className="translation-badge">AI-translated</span>}</div><h2>{selectedLabel(question.p)}</h2>{hasSpeechVoice && <button className="text-button voice-button" type="button" onClick={() => readAloud(selectedLabel(question.p))}>{selectedText("Read aloud")}</button>}
          <div className="answer-options">{question.o.map((option, optionIndex) => <button key={optionIndex} onClick={() => setAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? optionIndex : value))} className={answers[index] === optionIndex ? "answer-option selected" : "answer-option"}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{selectedLabel(option)}</span></button>)}</div>
        </article>)}</div>
        {message && <p className="notice" role="status">{message}</p>}
        <button className="primary-button" onClick={submitCheck}>{t.submit}<span aria-hidden="true">→</span></button></div>
        <aside className="topic-status-panel" aria-labelledby="topic-status-title"><h2 id="topic-status-title">{selectedText("Topics")}</h2><p>{prerequisiteScore === null ? selectedText("Keep an eye on each skill as you go.") : `Prerequisite check: ${prerequisiteScore}/5`}</p><ul>{diagnosticScores.map(({ topic, status, score, total }) => <li key={topic.id}><span>{selectedLabel(topic.title)}</span><span className={`status-pill status-${status}`}>{selectedText(statusLabel(status, language))}</span><small>{score}/{total}</small></li>)}</ul></aside></div>
      </section>}

      {view === "results" && <section className="content-section">
        <div className="section-heading result-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{t.results}</h1><p>{t.total}: {diagnosticScores.reduce((sum, item) => sum + item.score, 0)}/{diagnostic.length}</p></div>
        <div className="topic-results">{diagnosticScores.map(({ topic, score, total, status }) => <article className="result-row" key={topic.id}>
          <div className="result-main"><div><h2>{selectedLabel(topic.title)}</h2><span className={`status-pill status-${status}`}>{selectedText(statusLabel(status, language))}</span></div><span className="result-score">{score}<span>/{total}</span></span></div>
          <div className="score-track"><span style={{ width: `${Math.round(score / Math.max(total, 1) * 100)}%` }} /></div>
          <div className="result-actions"><button className="secondary-button" onClick={() => { setPracticeTarget(topic); setView("learn"); setAiExplanation(""); }}>{t.explain}</button><button className="outline-button" onClick={() => beginPractice(topic)}>{t.practice}</button></div>
        </article>)}</div>
        <button className="text-button return-button" onClick={goHome}>← {t.backHome}</button>
      </section>}

      {view === "learn" && <section className="content-section lesson-section">
        <button className="text-button" onClick={() => setView("results")}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{selectedLabel(currentTopic.title)}</h1></div>
        <article className="lesson-sheet"><div className="lesson-index">{t.explanation}{translationState === "ready" && !["en", "hi", "gu"].includes(language) && <span className="translation-badge">AI-translated</span>}</div><ol className="lesson-steps">{explanationSteps(selectedText(questionSets[currentTopic.family]?.explanation[coreLanguage(language) === "gu" ? 2 : coreLanguage(language) === "hi" ? 1 : 0] ?? "")).map((step, index) => <li key={index}>{step}</li>)}</ol>{hasSpeechVoice && <button className="text-button voice-button" type="button" onClick={() => readAloud(explanationSteps(selectedText(questionSets[currentTopic.family]?.explanation[coreLanguage(language) === "gu" ? 2 : coreLanguage(language) === "hi" ? 1 : 0] ?? "")).join(" "))}>{selectedText("Read aloud")}</button>}
          {aiExplanation && <div className="ai-explanation"><span>{t.steps}</span><ol className="lesson-steps ai-steps">{explanationSteps(selectedText(aiExplanation)).map((step, index) => <li key={index}>{step}</li>)}</ol></div>}{message && <p className="notice" role="status">{message}</p>}
        </article>
        <div className="lesson-actions"><button className="primary-button" onClick={() => beginPractice(currentTopic)}>{t.practice}<span aria-hidden="true">→</span></button><button className="outline-button" disabled={aiBusy} onClick={() => void askSaathi("simplify")}>{aiBusy ? "…" : t.simpler}</button></div>
      </section>}

      {view === "practice" && <section className="content-section">
        <button className="text-button" onClick={() => setView("results")}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedLabel(selectedChapter.title)}</div><h1>{t.practiceTitle}</h1><p>{selectedLabel(currentTopic.title)}</p></div>
        {!practiceDone && practiceQuestions[practiceIndex] && <>
          <div className="practice-progress"><div className="check-progress"><span>{t.question} {practiceIndex + 1} {t.of} {practiceQuestions.length}</span><span>{Math.round((practiceIndex + (practiceAnswers[practiceIndex] >= 0 ? 1 : 0)) / practiceQuestions.length * 100)}%</span></div><div className="progress-track" role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={practiceQuestions.length} aria-valuenow={practiceIndex + (practiceAnswers[practiceIndex] >= 0 ? 1 : 0)}><span style={{ width: `${(practiceIndex + (practiceAnswers[practiceIndex] >= 0 ? 1 : 0)) / practiceQuestions.length * 100}%` }} /></div></div>
          <article className="question-card practice-card">
          <div className="question-meta"><span>{t.question} {practiceIndex + 1} {t.of} {practiceQuestions.length}</span><span>{selectedLabel(currentTopic.title)}</span>{translationState === "ready" && !["en", "hi", "gu"].includes(language) && <span className="translation-badge">AI-translated</span>}</div><h2>{selectedLabel(practiceQuestions[practiceIndex].p)}</h2>{hasSpeechVoice && <button className="text-button voice-button" type="button" onClick={() => readAloud(selectedLabel(practiceQuestions[practiceIndex].p))}>{selectedText("Read aloud")}</button>}
          <div className="answer-options">{practiceQuestions[practiceIndex].o.map((option, optionIndex) => <button key={optionIndex} onClick={() => setPracticeAnswers((current) => current.map((value, answerIndex) => answerIndex === practiceIndex ? optionIndex : value))} className={practiceAnswers[practiceIndex] === optionIndex ? "answer-option selected" : "answer-option"}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{selectedLabel(option)}</span></button>)}</div>
          {practiceAnswers[practiceIndex] >= 0 && <div className={practiceAnswers[practiceIndex] === practiceQuestions[practiceIndex].a ? "answer-feedback right" : "answer-feedback wrong"}>{selectedLabel(practiceQuestions[practiceIndex].e)}</div>}
          <div className="practice-controls">{practiceIndex > 0 && <button className="text-button" onClick={() => setPracticeIndex((value) => value - 1)}>← {t.back}</button>}
            {practiceIndex < practiceQuestions.length - 1 ? <button className="primary-button" onClick={() => { if (practiceAnswers[practiceIndex] < 0) setMessage(t.answerFirst); else { setPracticeIndex((value) => value + 1); setMessage(""); } }}>{t.nextQuestion}<span aria-hidden="true">→</span></button> : <button className="primary-button" onClick={finishPractice}>{t.finishPractice}<span aria-hidden="true">→</span></button>}
          </div>
        </article></>}
        {practiceDone && <article className="session-complete"><div className="completion-mark">{practiceAnswers.filter((answer, index) => answer === practiceQuestions[index]?.a).length}</div><div className="eyebrow">{t.sessionResult}</div><h2>{message}</h2><p>{progress.topics[topicKey(selectedChapter.id, currentTopic.id)]?.successfulPracticeSessions ?? 0} {t.correctSessions}</p><div className="lesson-actions"><button className="primary-button" onClick={() => beginPractice(currentTopic)}>{t.nextSession}<span aria-hidden="true">→</span></button><button className="outline-button" onClick={() => setView("results")}>{t.results}</button></div></article>}
        <div className="ai-tools"><button className="text-button" disabled={aiBusy} onClick={() => void askSaathi("practice")}>{aiBusy ? "…" : t.aiPractice}</button>{extraQuestion && <div className="extra-question"><span className="eyebrow">{message}</span><h2>{selectedLabel(extraQuestion.p)}</h2><div className="answer-options">{extraQuestion.o.map((option, index) => <button key={index} className={extraAnswer === index ? "answer-option selected" : "answer-option"} onClick={() => setExtraAnswer(index)}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{selectedLabel(option)}</span></button>)}</div>{extraAnswer !== null && <div className={extraAnswer === extraQuestion.a ? "answer-feedback right" : "answer-feedback wrong"}>{selectedLabel(extraQuestion.e)}</div>}</div>}</div>
        {message && !practiceDone && !extraQuestion && <p className="notice" role="status">{message}</p>}
      </section>}

      {view === "plan" && <section className="content-section plan-section">
        <div className="section-heading"><div className="eyebrow">{t.learningNote}</div><h1>{selectedText("My plan")}</h1><p>{selectedText("A small next step, ordered around what needs attention first.")}</p></div>
        <div className="plan-daily-summary"><div><span>{selectedText("Today's goal")}</span><strong>{dailyActivity.answered} / {dailyGoal} {selectedText("questions")}</strong><div className="progress-track" role="progressbar" aria-label="Daily question goal" aria-valuemin={0} aria-valuemax={dailyGoal} aria-valuenow={Math.min(dailyActivity.answered, dailyGoal)}><span style={{ width: `${Math.min(dailyActivity.answered / dailyGoal * 100, 100)}%` }} /></div></div><div className="daily-streak"><strong>{dailyActivity.streak}</strong><span>{selectedText("day streak")}</span></div></div>
        <section className="plan-group" aria-labelledby="prerequisite-plan-title"><div className="plan-group-heading"><span className="eyebrow">{selectedText("Step 1")}</span><h2 id="prerequisite-plan-title">{selectedText("Prerequisites to revisit")}</h2></div>
          {prerequisiteEntries.length === 0 ? <p className="muted-copy">{selectedText("No earlier skills are needed for this chapter.")}</p> : prerequisiteEntries.map(({ topic, record }) => <article className="plan-row" key={topic.family}><div><strong>{selectedLabel(topic.title)}</strong><span>{record ? `${record.mastery}% mastery` : selectedText("A quick check will show what to revise")}</span></div><span className={`status-pill status-${record?.status ?? "weak"}`}>{record ? selectedText(statusLabel(record.status, language)) : selectedText("Needs a check")}</span><div className="plan-actions"><button className="secondary-button" onClick={() => { setPracticeTarget(topic); setView("learn"); }}>{selectedText("Explain")}</button><button className="outline-button" onClick={() => beginPractice(topic)}>{selectedText("Practise")}</button></div></article>)}
        </section>
        <section className="plan-group" aria-labelledby="chapter-plan-title"><div className="plan-group-heading"><span className="eyebrow">{selectedText("Step 2")}</span><h2 id="chapter-plan-title">{selectedText("Chapter topics")}</h2></div>
          {planEntries.length === 0 ? <div className="empty-state"><span>Ready</span><p>{selectedText("Take a chapter check to get a personal revision order.")}</p><button className="primary-button" onClick={beginCheck}>{t.start}<span aria-hidden="true">→</span></button></div> : planEntries.map(({ topic, record }) => <article className="plan-row" key={topic.id}><div><strong>{selectedLabel(topic.title)}</strong><span>{record ? `${record.mastery}% mastery` : selectedText("Not checked")}</span></div><span className={`status-pill status-${record?.status ?? "weak"}`}>{record ? selectedText(statusLabel(record.status, language)) : selectedText("Not checked")}</span><div className="plan-actions"><button className="secondary-button" onClick={() => { setPracticeTarget(topic); setView("learn"); }}>{selectedText("Explain")}</button><button className="outline-button" onClick={() => beginPractice(topic)}>{selectedText("Practise")}</button></div></article>)}
        </section>
        <Link className="outline-button plan-doubt-link" href="/doubts">{selectedText("Ask a doubt")}</Link>
        <button className="primary-button plan-exam-button" onClick={startBoardExam}>{selectedText("Start board-exam practice")} <span aria-hidden="true">→</span></button>
      </section>}

      {view === "exam" && <section className="content-section exam-section">
        <button className="text-button" onClick={() => setView("plan")}>← {t.back}</button>
        <div className="section-heading"><div className="eyebrow">{selectedText("Mixed practice")}</div><h1>{selectedText("Board-exam practice")}</h1><p>{selectedText("Questions are drawn from topics you have already practised.")}</p></div>
        {examQuestions.length === 0 ? <div className="empty-state"><span>{selectedText("Start with one topic")}</span><p>{selectedText("Practise a topic first; your mixed exam will appear here.")}</p><button className="primary-button" onClick={goHome}>{t.start}<span aria-hidden="true">→</span></button></div> : <>
          <div className="exam-timer" role="timer" aria-live="off"><span>{selectedText("Time left")}</span><strong>{String(Math.floor(examSeconds / 60)).padStart(2, "0")}:{String(examSeconds % 60).padStart(2, "0")}</strong></div>
          {examDone ? <article className="session-complete"><div className="completion-mark">{message}</div><div className="eyebrow">{selectedText("Exam complete")}</div><h2>{message} {selectedText("correct")}</h2><p>{selectedText("Your topic history has been updated on this device.")}</p><div className="lesson-actions"><button className="primary-button" onClick={() => setView("progress")}>{t.progressTitle}<span aria-hidden="true">→</span></button><button className="outline-button" onClick={() => setView("plan")}>{selectedText("My plan")}</button></div></article> : <>
            <div className="check-progress"><span>{examAnswers.filter((answer) => answer >= 0).length}/{examQuestions.length} {selectedText("answered")}</span><span>{Math.round(examAnswers.filter((answer) => answer >= 0).length / examQuestions.length * 100)}%</span></div>
            <div className="progress-track check-track" role="progressbar" aria-label="Board exam progress" aria-valuemin={0} aria-valuemax={examQuestions.length} aria-valuenow={examAnswers.filter((answer) => answer >= 0).length}><span style={{ width: `${examAnswers.filter((answer) => answer >= 0).length / examQuestions.length * 100}%` }} /></div>
            <div className="question-list">{examQuestions.map(({ topic, question }, index) => <article className="question-card" key={`${topic.family}-${index}`}><div className="question-meta"><span>Question {index + 1}</span><span>{selectedLabel(topic.title)}</span></div><h2>{selectedLabel(question.p)}</h2>{hasSpeechVoice && <button className="text-button voice-button" type="button" onClick={() => readAloud(selectedLabel(question.p))}>{selectedText("Read aloud")}</button>}<div className="answer-options">{question.o.map((option, optionIndex) => <button key={optionIndex} className={examAnswers[index] === optionIndex ? "answer-option selected" : "answer-option"} onClick={() => setExamAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? optionIndex : answer))}><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{selectedLabel(option)}</span></button>)}</div></article>)}</div>
            {message && <p className="notice" role="status">{message}</p>}
            <button className="primary-button" onClick={finishBoardExam}>{selectedText("Finish exam")} <span aria-hidden="true">→</span></button>
          </>}
        </>}
      </section>}

      {view === "progress" && <section className="content-section progress-section">
        <div className="section-heading"><div className="eyebrow">{t.learningNote}</div><h1>{t.progressTitle}</h1><p>{t.classLabel} {grade}</p></div>
        <section className="weekly-summary" aria-labelledby="weekly-summary-title"><div className="weekly-summary-heading"><div><span className="eyebrow">{selectedText("This week")}</span><h2 id="weekly-summary-title">{selectedText("Topics improved")}</h2></div><strong className="weekly-streak">{dailyActivity.streak} <small>{selectedText("day streak")}</small></strong></div>
          {weeklyHistory.length === 0 ? <p className="muted-copy">{selectedText("No study sessions yet this week.")}</p> : <p className="weekly-summary-copy">{weeklyHistory.length} study results · {improvedThisWeek.length} topics improved</p>}
          <div className="weekly-topic-lists"><div><strong>{selectedText("Topics improved")}</strong><span>{improvedThisWeek.join(", ") || "—"}</span></div><div><strong>{selectedText("Topics to revisit")}</strong><span>{weakThisWeek.join(", ") || "—"}</span></div></div>
          <a className="secondary-button weekly-share-button" href={`https://wa.me/?text=${encodeURIComponent(weeklyShareText)}`} target="_blank" rel="noreferrer">{selectedText("Share on WhatsApp")} <span aria-hidden="true">↗</span></a>
        </section>
        {progressEntries.length === 0 ? <div className="empty-state"><span>01</span><p>{t.noProgress}</p><button className="primary-button" onClick={goHome}>{t.start}<span aria-hidden="true">→</span></button></div> : <>
          <div className="progress-counts">{(["weak", "improving", "ok"] as Status[]).map((status) => <div className={`count-block count-${status}`} key={status}><span>{progressEntries.filter(([, record]) => record.status === status).length}</span><small>{selectedText(statusLabel(status, language))}</small></div>)}</div>
          <h2 className="subheading">{t.allTopics}</h2><div className="progress-topic-list">{progressEntries.map(([key, record]) => {
            const [chapterKey, topicId] = key.split(":");
            const chapter = chapters.find((item) => item.id === chapterKey);
            const topic = chapter?.topics.find((item) => item.id === topicId);
            if (!topic || !chapter) return null;
            const circumference = 2 * Math.PI * 22;
            return <article className={`progress-topic ${celebrationTopic === topic.id ? "topic-celebration" : ""}`} key={key}><div><strong>{selectedLabel(topic.title)}</strong><span>{selectedLabel(chapter.title)}</span></div><span className={`status-pill status-${record.status} ${celebrationTopic === topic.id ? "celebration-chip" : ""}`}>{selectedText(statusLabel(record.status, language))}</span><div className="mastery-cell"><svg className="mastery-ring" viewBox="0 0 56 56" role="img" aria-label={`${record.mastery}% ${t.mastery}`}><circle cx="28" cy="28" r="22" /><circle className="mastery-ring-value" cx="28" cy="28" r="22" style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - record.mastery / 100) }} /></svg><strong>{record.mastery}%</strong></div></article>;
          })}</div>
          {progress.history.length > 0 && <section className="history-chart-section" aria-labelledby="history-chart-title"><div className="history-chart-heading"><div><span className="eyebrow">{selectedText("Learning over time")}</span><h2 id="history-chart-title">{selectedText("Score history")}</h2></div><span className="chart-key"><i />{selectedText("Score")}</span></div><div className="history-chart"><svg viewBox="0 0 600 190" role="img" aria-label="Recent study scores shown over time"><path className="chart-gridline" d="M35 35H580M35 82H580M35 129H580M35 166H580" /><text x="4" y="39">100%</text><text x="13" y="86">66%</text><text x="13" y="133">33%</text><text x="22" y="170">0</text>{(() => { const entries = progress.history.slice(0, 8).reverse(); const points = entries.map((entry, index) => `${entries.length === 1 ? 307 : 45 + index * (520 / (entries.length - 1))},${166 - entry.score / Math.max(entry.total, 1) * 131}`).join(" "); return <><polyline className="chart-line" points={points} />{entries.map((entry, index) => <circle key={entry.id} className="chart-point" cx={entries.length === 1 ? 307 : 45 + index * (520 / (entries.length - 1))} cy={166 - entry.score / Math.max(entry.total, 1) * 131} r="5"><title>{entry.score}/{entry.total}</title></circle>)}</>; })()}</svg></div></section>}
        </>}
        <h2 className="subheading history-heading">{t.history}</h2>
        {progress.history.length === 0 ? <p className="muted-copy">{t.noProgress}</p> : <div className="history-list">{progress.history.slice(0, 12).map((entry) => {
          const title = chapters.find((item) => item.id === entry.chapter)?.topics.find((item) => item.id === entry.topic)?.title ?? [entry.topicTitle, entry.topicTitle, entry.topicTitle];
          return <div className="history-row" key={entry.id}><div><strong>{selectedLabel(title)}</strong><span>{entry.kind === "check" ? t.checkTitle : entry.kind === "exam" ? "Board-exam practice" : t.practiceTitle} · {new Date(entry.date).toLocaleDateString(language === "gu" ? "gu-IN" : language === "hi" ? "hi-IN" : "en-IN")}</span></div><b>{entry.score}/{entry.total}</b></div>;
        })}</div>}
        <button className="text-button clear-button" onClick={clearProgress}>{t.clear}</button>
      </section>}
    </>}
    </main>
    <Link className="doubt-fab" href="/doubts" aria-label="Ask Saathi">?</Link>
    <footer className="site-footer"><span><strong>Padhai Saathi</strong><small>Built by Ramesh Kumar, Marwadi University</small></span><span className="sdg-badge">SDG 4 <i aria-hidden="true" /></span></footer>
  </div>;
}