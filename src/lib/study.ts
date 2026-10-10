import bank from "@/data/study-bank.json";

export type Language = "en" | "hi" | "gu";
export type Subject = "math" | "science";
export type Status = "weak" | "improving" | "ok";

export interface Topic {
  id: string;
  title: [string, string, string];
  family: string;
}

export interface Chapter {
  id: string;
  subject: Subject;
  title: [string, string, string];
  topics: Topic[];
}

export interface Question {
  p: [string, string, string];
  o: [string, string, string][];
  a: number;
  e: [string, string, string];
}

export interface QuestionSet {
  explanation: [string, string, string];
  questions: Question[];
}

export interface TopicRecord {
  status: Status;
  mastery: number;
  successfulPracticeSessions: number;
  practiceSessions: number;
  updatedAt: string;
}

export interface ScoreEntry {
  id: string;
  chapter: string;
  chapterTitle: string;
  topic: string;
  topicTitle: string;
  score: number;
  total: number;
  date: string;
  kind: "check" | "practice";
}

export interface ProgressData {
  topics: Record<string, TopicRecord>;
  history: ScoreEntry[];
}

export const chapters = bank.chapters as Chapter[];
export const questionSets = bank.questionSets as unknown as Record<string, QuestionSet>;
export const storageKey = "padhai-saathi-progress-v1";

export const labels = {
  en: {
    kicker: "A little stronger, every day", title: "Your next step starts here.",
    subtitle: "Find a topic to work on. Learn it in small steps, then try again.",
    nickname: "What should we call you?", nicknameHint: "A nickname only. No real name needed.",
    language: "Choose your language", grade: "Your class", subject: "Choose a subject",
    math: "Maths", science: "Science", chapter: "Choose a chapter", start: "Start a check",
    navStudy: "Study", navProgress: "My progress", navTeacher: "Teacher view",
    checkTitle: "Let's see what you know", checkSub: "10 questions · choose one answer for each",
    question: "Question", of: "of", submit: "See my topic scores", back: "Back",
    results: "Your topic scores", total: "Overall", weak: "Needs practice", improving: "Getting there", ok: "Looking good",
    explain: "Learn this topic", practice: "Try 5 questions", simpler: "Explain more simply",
    aiPractice: "Make extra questions", nextQuestion: "Next question", answerFirst: "Choose an answer before continuing.", backHome: "Choose another chapter",
    progressTitle: "Your learning", noProgress: "Your first check will appear here.",
    history: "Recent checks and practice", clear: "Clear my progress", sessions: "practice sessions",
    practiceTitle: "A little practice", finishPractice: "Finish session", nextSession: "Start another session",
    correct: "correct", explanation: "A simple way to think about it", steps: "Try these steps",
    aiFallback: "Saathi is taking a break. Here is a practice question from your offline question bank.",
    aiReady: "A fresh question from Saathi.", aiExplainFallback: "Showing the built-in explanation. You can still learn and practise offline.",
    classLabel: "Class", allTopics: "All topics", done: "Done", score: "Score",
    mastery: "Mastery", learningNote: "Your progress stays on this device.", resetConfirm: "Clear all learning progress on this device?",
    sessionResult: "Session complete", correctSessions: "sessions with a correct answer",
    footer: "Made for curious minds in classes 8-10", home: "Home", loadError: "That did not load. Please try again.",
  },
  hi: {
    kicker: "हर दिन थोड़ा बेहतर", title: "अगला कदम यहाँ से शुरू करें।",
    subtitle: "सीखने के लिए एक विषय चुनें। छोटे चरणों में समझें, फिर अभ्यास करें।",
    nickname: "आपको किस नाम से बुलाएँ?", nicknameHint: "उपनाम ही ठीक है। असली नाम ज़रूरी नहीं।",
    language: "अपनी भाषा चुनें", grade: "अपनी कक्षा", subject: "विषय चुनें",
    math: "गणित", science: "विज्ञान", chapter: "अध्याय चुनें", start: "जाँच शुरू करें",
    navStudy: "पढ़ाई", navProgress: "मेरी प्रगति", navTeacher: "शिक्षक दृश्य",
    checkTitle: "देखें, आप कितना जानते हैं", checkSub: "10 प्रश्न · हर प्रश्न का एक उत्तर चुनें",
    question: "प्रश्न", of: "में से", submit: "विषय के अंक देखें", back: "वापस",
    results: "आपके विषय के अंक", total: "कुल", weak: "अभ्यास चाहिए", improving: "आगे बढ़ रहे हैं", ok: "अच्छा कर रहे हैं",
    explain: "यह विषय सीखें", practice: "5 प्रश्न हल करें", simpler: "और आसान भाषा में समझाएँ",
    aiPractice: "नए प्रश्न बनाएँ", nextQuestion: "अगला प्रश्न", answerFirst: "आगे बढ़ने से पहले उत्तर चुनें।", backHome: "दूसरा अध्याय चुनें",
    progressTitle: "आपकी पढ़ाई", noProgress: "आपकी पहली जाँच यहाँ दिखेगी।",
    history: "हाल की जाँच और अभ्यास", clear: "मेरी प्रगति मिटाएँ", sessions: "अभ्यास सत्र",
    practiceTitle: "थोड़ा अभ्यास", finishPractice: "सत्र पूरा करें", nextSession: "एक और सत्र शुरू करें",
    correct: "सही", explanation: "इसे आसान तरह से सोचें", steps: "इन चरणों को आज़माएँ",
    aiFallback: "साथी अभी आराम कर रहा है। ऑफ़लाइन प्रश्न बैंक से अभ्यास करें।", aiReady: "साथी का नया प्रश्न।",
    aiExplainFallback: "यहाँ दिया गया आसान समझाव देखें। ऑफ़लाइन भी पढ़ाई और अभ्यास कर सकते हैं।",
    classLabel: "कक्षा", allTopics: "सभी विषय", done: "पूरा", score: "अंक", mastery: "पकड़",
    learningNote: "आपकी प्रगति इसी डिवाइस में रहती है।", resetConfirm: "इस डिवाइस से पढ़ाई की सारी प्रगति मिटाएँ?",
    sessionResult: "सत्र पूरा हुआ", correctSessions: "सही उत्तर वाले सत्र",
    footer: "कक्षा 8-10 के जिज्ञासु विद्यार्थियों के लिए", home: "मुखपृष्ठ", loadError: "नहीं खुला। फिर से कोशिश करें।",
  },
  gu: {
    kicker: "દરરોજ થોડા વધુ મજબૂત", title: "આગળનું પગલું અહીંથી શરૂ થાય છે.",
    subtitle: "અભ્યાસ માટે વિષય પસંદ કરો. નાના પગલાંમાં શીખો, પછી ફરી અજમાવો.",
    nickname: "તમને કયા નામથી બોલાવીએ?", nicknameHint: "ઉપનામ પૂરતું છે. સાચું નામ જરૂરી નથી.",
    language: "તમારી ભાષા પસંદ કરો", grade: "તમારો વર્ગ", subject: "વિષય પસંદ કરો",
    math: "ગણિત", science: "વિજ્ઞાન", chapter: "પ્રકરણ પસંદ કરો", start: "કસોટી શરૂ કરો",
    navStudy: "અભ્યાસ", navProgress: "મારી પ્રગતિ", navTeacher: "શિક્ષક દૃશ્ય",
    checkTitle: "ચાલો જાણીએ, તમને કેટલું આવડે છે", checkSub: "10 પ્રશ્નો · દરેક માટે એક જવાબ પસંદ કરો",
    question: "પ્રશ્ન", of: "માંથી", submit: "વિષયના ગુણ જુઓ", back: "પાછળ",
    results: "તમારા વિષયના ગુણ", total: "કુલ", weak: "વધુ અભ્યાસ કરો", improving: "આગળ વધી રહ્યા છો", ok: "સરસ કરી રહ્યા છો",
    explain: "આ વિષય શીખો", practice: "5 પ્રશ્નો અજમાવો", simpler: "વધુ સરળ રીતે સમજાવો",
    aiPractice: "નવા પ્રશ્નો બનાવો", nextQuestion: "આગળનો પ્રશ્ન", answerFirst: "આગળ વધતાં પહેલાં જવાબ પસંદ કરો.", backHome: "બીજું પ્રકરણ પસંદ કરો",
    progressTitle: "તમારો અભ્યાસ", noProgress: "તમારી પહેલી કસોટી અહીં દેખાશે.",
    history: "તાજેતરની કસોટી અને અભ્યાસ", clear: "મારી પ્રગતિ ભૂંસો", sessions: "અભ્યાસ સત્રો",
    practiceTitle: "થોડો અભ્યાસ", finishPractice: "સત્ર પૂરું કરો", nextSession: "બીજું સત્ર શરૂ કરો",
    correct: "સાચા", explanation: "આને સરળતાથી સમજો", steps: "આ પગલાં અજમાવો",
    aiFallback: "સાથી અત્યારે આરામ કરે છે. ઑફલાઇન પ્રશ્નભંડારમાંથી અભ્યાસ કરો.", aiReady: "સાથીનો નવો પ્રશ્ન.",
    aiExplainFallback: "અહીં સરળ સમજણ જુઓ. ઑફલાઇન પણ શીખી અને અભ્યાસ કરી શકો છો.",
    classLabel: "વર્ગ", allTopics: "બધા વિષયો", done: "પૂર્ણ", score: "ગુણ", mastery: "માસ્ટરી",
    learningNote: "તમારી પ્રગતિ આ ઉપકરણમાં જ રહે છે.", resetConfirm: "આ ઉપકરણમાંથી અભ્યાસની બધી પ્રગતિ ભૂંસવી?",
    sessionResult: "સત્ર પૂરું થયું", correctSessions: "સાચા જવાબવાળાં સત્રો",
    footer: "ધોરણ 8-10ના જિજ્ઞાસુ વિદ્યાર્થીઓ માટે", home: "મુખ્ય પાનું", loadError: "ખુલ્યું નહીં. ફરી પ્રયત્ન કરો.",
  },
} as const;

export function topicKey(chapterId: string, topicId: string) {
  return `${chapterId}:${topicId}`;
}

export function statusLabel(status: Status, language: Language) {
  const t = labels[language];
  return status === "weak" ? t.weak : status === "improving" ? t.improving : t.ok;
}

export function statusFor(score: number, total: number): Status {
  const ratio = total === 0 ? 0 : score / total;
  return ratio >= 0.7 ? "ok" : ratio >= 0.4 ? "improving" : "weak";
}

export function createQuestionOrder(topics: Topic[], offset = 0): { topic: Topic; question: Question }[] {
  const sets = topics.map((topic) => ({ topic, questions: questionSets[topic.family]?.questions ?? [] }));
  const questionCount = Math.max(0, ...sets.map((set) => set.questions.length));
  const all = Array.from({ length: questionCount }, (_, round) => sets.flatMap(({ topic, questions }) => {
    const question = questions[round];
    return question ? [{ topic, question }] : [];
  })).flat();
  return all.length === 0 ? [] : Array.from({ length: Math.min(10, all.length) }, (_, index) => all[(offset + index) % all.length]);
}

export function freshPracticeQuestions(topic: Topic, offset: number, amount = 5): Question[] {
  const questions = questionSets[topic.family]?.questions ?? [];
  if (questions.length === 0) return [];
  return Array.from({ length: Math.min(amount, questions.length) }, (_, index) => questions[(offset + index) % questions.length]);
}

export function emptyProgress(): ProgressData {
  return { topics: {}, history: [] };
}