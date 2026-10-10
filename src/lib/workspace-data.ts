export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type TaskStatus = "todo" | "done";

export type StudyTask = {
  id: string;
  title: string;
  subject: string;
  topic: string;
  priority: TaskPriority;
  durationMinutes: number;
  scheduledFor: string;
  status: TaskStatus;
  createdAt: string;
  examId?: string;
};

export type ExamPlan = {
  id: string;
  name: string;
  date: string;
  subjects: string[];
  availableMinutes: number;
  readiness: "starting" | "steady" | "revision";
  createdAt: string;
};

export type StudyNote = {
  id: string;
  title: string;
  subject: string;
  body: string;
  updatedAt: string;
};

export type Flashcard = { id: string; front: string; back: string; mastery: "new" | "review" | "known"; lastReviewedAt?: string };
export type FlashcardDeck = { id: string; name: string; subject: string; cards: Flashcard[]; updatedAt: string };
export type QuizAttempt = { id: string; chapterId: string; chapterTitle: string; score: number; total: number; date: string; durationSeconds: number };
export type StoredDocument = { id: string; name: string; subject: string; pages: number; uploadedAt: string; status: "ready" | "failed" | "needs-ocr"; textByPage: string[]; blob: Blob };

export const workspaceKeys = {
  tasks: "padhai-saathi-study-tasks-v1",
  exams: "padhai-saathi-exam-plans-v1",
  notes: "padhai-saathi-notes-v1",
  decks: "padhai-saathi-flashcard-decks-v1",
  quizzes: "padhai-saathi-quiz-attempts-v1",
  documents: "padhai-saathi-document-index-v1",
} as const;

export function readLocalList<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

export function writeLocalList<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

const databaseName = "padhai-saathi-workspace-v1";
const storeName = "documents";

function openDocumentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support local document storage."));
      return;
    }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local document storage could not be opened."));
  });
}

async function documentTransaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void): Promise<T> {
  const database = await openDocumentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    run(transaction.objectStore(storeName), resolve, reject);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Local document storage failed.")); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("Local document storage was interrupted.")); };
  });
}

export function saveDocument(document: StoredDocument): Promise<void> {
  return documentTransaction("readwrite", (store, resolve, reject) => {
    const request = store.put(document);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("The document could not be saved on this device."));
  });
}

export function listStoredDocuments(): Promise<StoredDocument[]> {
  return documentTransaction("readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as StoredDocument[]);
    request.onerror = () => reject(request.error ?? new Error("Documents could not be loaded from this device."));
  });
}

export function getStoredDocument(id: string): Promise<StoredDocument | undefined> {
  return documentTransaction("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
    request.onerror = () => reject(request.error ?? new Error("The document could not be opened."));
  });
}

export function deleteStoredDocument(id: string): Promise<void> {
  return documentTransaction("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("The document could not be deleted."));
  });
}
