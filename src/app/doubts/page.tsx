"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import BrandMark from "@/components/BrandMark";
import DashboardFrame from "@/components/DashboardFrame";
import { coreLanguage, getLanguage, LANGUAGES, translationStorageKey } from "@/lib/languages";
import type { CoreLanguage, Language } from "@/lib/languages";

type Message = {
  id: string;
  role: "student" | "saathi";
  text: string;
  followUp?: string;
  question?: string;
  imageUrl?: string;
  saved?: boolean;
  reported?: boolean;
};
type PendingImage = { mimeType: string; data: string; preview: string };
type RecognitionResult = { transcript: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<RecognitionResult>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

const historyKey = "padhai-saathi-doubts-v1";
const answerWrong = "Saathi could not connect right now. Please try again when you are online. You can continue studying from the built-in question bank.";
const doubtUiStrings = ["Your study companion", "Offline mode", "Ask Saathi", "Ask a Maths or Science question in your language. Saathi teaches in steps and can start with a hint.", "Class", "Subject", "Online", "Offline", "Ask", "Share the part that feels confusing. You can type, speak, or attach a question photo.", "You", "Saathi", "Read aloud", "Read aloud is not available for this language on your device.", "Show full solution", "Save to my doubts", "Saved", "This answer was wrong", "Wrong answer reported", "Listening…", "Voice input is not available in this browser.", "Voice input could not start. You can type your question instead.", "Choose a JPG, PNG, or WebP photo smaller than 2.4 MB.", "That photo could not be opened. Try another image.", "Remove photo", "Type your question…", "Microphone", "Add photo", "Send", "Saathi is thinking…", "Saathi can make mistakes. Check important answers with a teacher. Your conversation stays on this device.", "Clear doubt history", "Clear doubt history on this device?", "AI-translated", "Translation unavailable. English text is shown."];
const coreDoubtLabels: Record<string, Partial<Record<CoreLanguage, string>>> = {
  "Your study companion": { hi: "आपका पढ़ाई साथी", gu: "તમારો અભ્યાસ સાથી" },
  "Offline mode": { hi: "ऑफ़लाइन", gu: "ઑફલાઇન" },
  "Ask Saathi": { hi: "साथी से पूछें", gu: "સાથીને પૂછો" },
  "Ask a Maths or Science question in your language. Saathi teaches in steps and can start with a hint.": { hi: "अपनी भाषा में गणित या विज्ञान का सवाल पूछें। साथी चरणों में समझाएगा और संकेत से शुरू कर सकता है।", gu: "તમારી ભાષામાં ગણિત કે વિજ્ઞાનનો પ્રશ્ન પૂછો. સાથી પગલાંમાં સમજાવશે અને સંકેતથી શરૂ કરી શકે છે." },
  "Class": { hi: "कक्षा", gu: "વર્ગ" },
  "Subject": { hi: "विषय", gu: "વિષય" },
  "Online": { hi: "ऑनलाइन", gu: "ઑનલાઇન" },
  "Offline": { hi: "ऑफ़लाइन", gu: "ઑફલાઇન" },
  "Ask": { hi: "पूछें", gu: "પૂછો" },
  "You": { hi: "आप", gu: "તમે" },
  "Saathi": { hi: "साथी", gu: "સાથી" },
  "Read aloud": { hi: "ज़ोर से सुनें", gu: "મોટેથી સાંભળો" },
  "Show full solution": { hi: "पूरा हल देखें", gu: "પૂરું સમાધાન જુઓ" },
  "Save to my doubts": { hi: "मेरे सवालों में सहेजें", gu: "મારા પ્રશ્નોમાં સાચવો" },
  "Saved": { hi: "सहेजा गया", gu: "સાચવ્યું" },
  "This answer was wrong": { hi: "यह उत्तर गलत था", gu: "આ જવાબ ખોટો હતો" },
  "Wrong answer reported": { hi: "गलत उत्तर की सूचना दी", gu: "ખોટા જવાબની જાણ કરી" },
  "Remove photo": { hi: "फ़ोटो हटाएँ", gu: "ફોટો દૂર કરો" },
  "Type your question…": { hi: "अपना सवाल लिखें…", gu: "તમારો પ્રશ્ન લખો…" },
  "Microphone": { hi: "माइक्रोफ़ोन", gu: "માઇક્રોફોન" },
  "Add photo": { hi: "फ़ोटो जोड़ें", gu: "ફોટો ઉમેરો" },
  "Send": { hi: "भेजें", gu: "મોકલો" },
  "Clear doubt history": { hi: "सवालों का इतिहास मिटाएँ", gu: "પ્રશ્નોનો ઇતિહાસ ભૂંસો" },
};

function newMessage(role: Message["role"], text: string, detail: Partial<Message> = {}): Message {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text, ...detail };
}

export default function DoubtsPage() {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lowData, setLowData] = useState(false);
  const [simpleReading, setSimpleReading] = useState(false);
  const [translatedLabels, setTranslatedLabels] = useState<Record<string, string>>({});
  const [translationState, setTranslationState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [grade, setGrade] = useState("8");
  const [subject, setSubject] = useState<"math" | "science">("math");
  const [nickname, setNickname] = useState("Learner");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<PendingImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [hasVoice, setHasVoice] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(historyKey);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
      const savedLanguage = localStorage.getItem("padhai-saathi-language") as Language | null;
      const savedGrade = localStorage.getItem("padhai-saathi-grade");
      const savedSubject = localStorage.getItem("padhai-saathi-subject");
      const savedNickname = localStorage.getItem("padhai-saathi-nickname");
      const savedTheme = localStorage.getItem("padhai-saathi-theme");
      const savedLowData = localStorage.getItem("padhai-saathi-low-data");
      const savedSimpleReading = localStorage.getItem("padhai-saathi-simple-reading");
      if (savedLanguage && LANGUAGES.some((item) => item.code === savedLanguage)) setLanguage(savedLanguage);
      if (["8", "9", "10"].includes(savedGrade ?? "")) setGrade(savedGrade ?? "8");
      if (savedSubject === "math" || savedSubject === "science") setSubject(savedSubject);
      if (savedNickname) setNickname(savedNickname);
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
      if (savedLowData !== null) setLowData(savedLowData === "true");
      if (savedSimpleReading !== null) setSimpleReading(savedSimpleReading === "true");
    } catch {
      setNotice("Your saved doubt history could not be loaded on this device.");
    }
    setOnline(navigator.onLine);
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    const selected = getLanguage(language);
    document.documentElement.dir = selected.direction;
    document.getElementById("doubt-regional-font")?.remove();
    if (selected.fontFamily) {
      const link = document.createElement("link");
      link.id = "doubt-regional-font";
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(selected.fontFamily).replace(/%20/g, "+")}&display=swap`;
      document.head.append(link);
      document.documentElement.style.setProperty("--script-font", `"${selected.fontFamily}"`);
    } else document.documentElement.style.removeProperty("--script-font");
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("padhai-saathi-theme", theme); } catch { /* Preferences are optional. */ }
  }, [theme]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  useEffect(() => {
    const updateVoices = () => setHasVoice(window.speechSynthesis?.getVoices().some((voice) => voice.lang.toLowerCase().startsWith(language.toLowerCase())) ?? false);
    updateVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", updateVoices);
  }, [language]);

  useEffect(() => {
    if (["en", "hi", "gu"].includes(language)) {
      setTranslatedLabels({});
      setTranslationState("idle");
      return;
    }
    let cancelled = false;
    let cached: Record<string, string> = {};
    try {
      const saved = localStorage.getItem(translationStorageKey);
      const allLanguages = saved ? JSON.parse(saved) as Record<string, Record<string, string>> : {};
      cached = allLanguages[language] ?? {};
    } catch { cached = {}; }
    setTranslatedLabels(cached);
    const missing = doubtUiStrings.filter((text) => !cached[text]);
    if (missing.length === 0) {
      setTranslationState("ready");
      return () => { cancelled = true; };
    }
    setTranslationState("loading");
    void fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, texts: missing }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Translation unavailable");
      const result = await response.json() as { fallback?: boolean; translations?: string[] };
      if (result.fallback || result.translations?.length !== missing.length) throw new Error("Translation unavailable");
      missing.forEach((text, index) => { cached[text] = result.translations?.[index] ?? text; });
      if (cancelled) return;
      setTranslatedLabels({ ...cached });
      setTranslationState("ready");
      try {
        const saved = localStorage.getItem(translationStorageKey);
        const allLanguages = saved ? JSON.parse(saved) as Record<string, Record<string, string>> : {};
        allLanguages[language] = { ...allLanguages[language], ...cached };
        localStorage.setItem(translationStorageKey, JSON.stringify(allLanguages));
      } catch { /* Display the in-memory translation if storage is full. */ }
    }).catch(() => { if (!cancelled) setTranslationState("fallback"); });
    return () => { cancelled = true; };
  }, [language]);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(historyKey, JSON.stringify(messages)); } catch { setNotice("There is not enough space to save more doubt history on this device."); }
    }
  }, [messages, ready]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  async function askQuestion(question: string, pendingImage: PendingImage | null, showSolution = false) {
    if (!online) {
      setMessages((current) => [...current, newMessage("student", question, pendingImage ? { imageUrl: pendingImage.preview } : {}), newMessage("saathi", "AI doubt help needs an internet connection. Your saved questions remain available on this device.", { question })]);
      return;
    }
    const studentMessage = newMessage("student", question, pendingImage ? { imageUrl: pendingImage.preview } : {});
    setMessages((current) => [...current, studentMessage]);
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, grade, subject, question, showSolution, lowData, nickname: localStorage.getItem("padhai-saathi-nickname") ?? undefined, image: pendingImage ? { mimeType: pendingImage.mimeType, data: pendingImage.data } : undefined }),
      });
      const result = await response.json() as { answer?: string; followUp?: string; fallback?: boolean; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error ?? answerWrong);
      setMessages((current) => [...current, newMessage("saathi", result.answer ?? answerWrong, { followUp: result.followUp, question })]);
      if (result.fallback) setNotice("Saathi is using a friendly fallback. Try again when the AI service is available.");
    } catch (error) {
      const message = error instanceof Error ? error.message : answerWrong;
      setMessages((current) => [...current, newMessage("saathi", message, { question })]);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>, showSolution = false, questionOverride?: string) {
    event.preventDefault();
    const question = (questionOverride ?? draft.trim()) || (image ? "Please explain the school question in this photo." : "");
    if (!question || busy) return;
    const pendingImage = image;
    setDraft("");
    setImage(null);
    await askQuestion(question, pendingImage, showSolution);
  }

  function listen() {
    const RecognitionApi = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!RecognitionApi) {
      setVoiceNote("Voice input is not available in this browser.");
      return;
    }
    const recognition = new RecognitionApi();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => setDraft((current) => `${current} ${event.results[0]?.[0]?.transcript ?? ""}`.trim());
    recognition.onerror = () => setVoiceNote("Voice input could not start. You can type your question instead.");
    recognition.onend = () => setVoiceNote("");
    setVoiceNote("Listening…");
    try { recognition.start(); } catch { setVoiceNote("Voice input could not start. You can type your question instead."); }
  }

  function readAloud(text: string) {
    const voice = window.speechSynthesis?.getVoices().find((item) => item.lang.toLowerCase().startsWith(language.toLowerCase()));
    if (!voice) {
      setVoiceNote(`Read aloud is not available for ${getLanguage(language).name} on this device.`);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function selectImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_400_000) {
      setNotice("Choose a JPG, PNG, or WebP photo smaller than 2.4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setImage({ mimeType: file.type, data: result.split(",")[1] ?? "", preview: result });
      setNotice("");
    };
    reader.onerror = () => setNotice("That photo could not be opened. Try another image.");
    reader.readAsDataURL(file);
  }

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...patch } : message));
  }

  const selectedLanguage = getLanguage(language);
  const copy = (text: string) => {
    const core = coreLanguage(language);
    return core === "en" ? text : coreDoubtLabels[text]?.[core] ?? (core === "gu" || core === "hi" ? text : translatedLabels[text] ?? text);
  };

  return <DashboardFrame active="ai" profileName={nickname} grade={grade} context={`${grade} · ${subject === "math" ? "Maths" : "Science"}`} theme={theme} onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} language={language} lowData={lowData} simpleReading={simpleReading} controls={<>
    <button className={lowData ? "setting-toggle active" : "setting-toggle"} type="button" aria-pressed={lowData} onClick={() => { const next = !lowData; setLowData(next); try { localStorage.setItem("padhai-saathi-low-data", String(next)); } catch { /* Preferences are optional. */ } }}>Low data {lowData ? "On" : "Off"}</button>
    <button className={simpleReading ? "setting-toggle active" : "setting-toggle"} type="button" aria-pressed={simpleReading} onClick={() => { const next = !simpleReading; setSimpleReading(next); try { localStorage.setItem("padhai-saathi-simple-reading", String(next)); } catch { /* Preferences are optional. */ } }}>Simple text {simpleReading ? "On" : "Off"}</button>
    <label className="sr-only" htmlFor="doubt-language">Language</label>
    <select id="doubt-language" className="nav-language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.nativeName}</option>)}</select>
  </>}>
    {!["en", "hi", "gu"].includes(language) && <div className={`translation-notice translation-${translationState}`} role="status">{translationState === "ready" ? copy("AI-translated") : translationState === "loading" ? "Translating study text…" : copy("Translation unavailable. English text is shown.")}</div>}
    <main className="main-content">
      <section className="content-section doubts-section" aria-labelledby="doubts-title">
        <div className="section-heading">
          <div className="eyebrow"><span className="eyebrow-dot" />{copy(online ? "Your study companion" : "Offline mode")}</div>
          <h1 id="doubts-title">{copy("Ask Saathi")}</h1>
          <p>{copy("Ask a Maths or Science question in your language. Saathi teaches in steps and can start with a hint.")}</p>
        </div>
        <div className="doubt-settings" aria-label="Study context">
          <label>{copy("Class")}<select value={grade} onChange={(event) => setGrade(event.target.value)}><option>8</option><option>9</option><option>10</option></select></label>
          <label>{copy("Subject")}<select value={subject} onChange={(event) => setSubject(event.target.value as "math" | "science")}><option value="math">{copy("Maths")}</option><option value="science">{copy("Science")}</option></select></label>
          <span className={`connection-badge ${online ? "online" : "offline"}`} role="status">{copy(online ? "Online" : "Offline")}</span>
        </div>
        <section className="doubt-chat" aria-label={copy("Doubt conversation")}>
          {!ready ? <div className="app-skeleton" aria-busy="true"><span className="skeleton skeleton-copy" /><span className="skeleton skeleton-panel" /></div> : messages.length === 0 ? <div className="empty-state doubt-empty"><span>{copy("Ask")}</span><p>{copy("Share the part that feels confusing. You can type, speak, or attach a question photo.")}</p></div> : <div className="doubt-messages" role="log" aria-live="polite">
            {messages.map((message) => <article className={`doubt-message ${message.role}`} key={message.id}>
              <div className="doubt-message-label">{copy(message.role === "student" ? "You" : "Saathi")}</div>
              {message.imageUrl && <img className="doubt-image-preview" src={message.imageUrl} alt="Uploaded textbook question" />}
              <p>{message.text}</p>
              {message.followUp && <p className="doubt-follow-up">{message.followUp}</p>}
              {message.role === "saathi" && <div className="doubt-actions">
                {hasVoice ? <button className="text-button" type="button" onClick={() => readAloud(`${message.text} ${message.followUp ?? ""}`)}>{copy("Read aloud")}</button> : <small>{copy("Read aloud is not available for this language on your device.")}</small>}
                {message.question && <button className="text-button" type="button" onClick={() => { void askQuestion(message.question ?? "", null, true); }}>{copy("Show full solution")}</button>}
                <button className="text-button" type="button" onClick={() => updateMessage(message.id, { saved: !message.saved })}>{copy(message.saved ? "Saved" : "Save to my doubts")}</button>
                <button className="text-button" type="button" onClick={() => updateMessage(message.id, { reported: true })} disabled={message.reported}>{copy(message.reported ? "Wrong answer reported" : "This answer was wrong")}</button>
              </div>}
            </article>)}
            {busy && <div className="doubt-loading" role="status"><span className="skeleton skeleton-copy" /><span>{copy("Saathi is thinking…")}</span></div>}
            <div ref={chatEnd} />
          </div>}
          {image && <div className="pending-image"><img src={image.preview} alt="Selected textbook question" /><button className="text-button" type="button" onClick={() => setImage(null)}>{copy("Remove photo")}</button></div>}
          <form className="doubt-composer" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="doubt-question">Your doubt</label>
            <textarea id="doubt-question" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} placeholder={copy("Type your question…")} rows={3} />
            <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => selectImage(event.target.files?.[0])} />
            <div className="composer-actions">
              <button className="outline-button" type="button" onClick={listen} aria-label={copy("Speak your question")}>{copy("Microphone")}</button>
              <button className="outline-button" type="button" onClick={() => fileInput.current?.click()}>{copy("Add photo")}</button>
              <span className="composer-spacer" />
              <button className="primary-button" type="submit" disabled={busy || (!draft.trim() && !image)}>{copy("Send")} <span aria-hidden="true">→</span></button>
            </div>
          </form>
        </section>
        {voiceNote && <p className="muted-copy" role="status">{voiceNote}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <p className="doubt-safety-note">{copy("Saathi can make mistakes. Check important answers with a teacher. Your conversation stays on this device.")}</p>
        {messages.length > 0 && <button className="text-button clear-button" type="button" onClick={() => { if (window.confirm(copy("Clear doubt history on this device?"))) setMessages([]); }}>{copy("Clear doubt history")}</button>}
      </section>
    </main>
  </DashboardFrame>;
}
