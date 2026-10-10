"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

const navigation = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: "grid" },
  { id: "ai", label: "AI Tutor", href: "/doubts", icon: "spark" },
  { id: "documents", label: "My Documents", href: "/documents", icon: "file" },
  { id: "planner", label: "Exam Planner", href: "/planner", icon: "calendar" },
  { id: "quizzes", label: "Quiz Center", href: "/quizzes", icon: "check" },
  { id: "flashcards", label: "Flashcards", href: "/flashcards", icon: "cards" },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: "chart" },
  { id: "library", label: "Notes & Library", href: "/library", icon: "book" },
  { id: "teacher", label: "Teacher View", href: "/teacher", icon: "calendar" },
];

function WorkspaceIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
    file: <><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z"/><path d="M13 3v7h7M8 14h8M8 17h8"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2m4 0h2m-8 3h2"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    cards: <><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h5M3 7v13a2 2 0 0 0 2 2h11"/></>,
    chart: <><path d="M4 20V11m5 9V5m5 15v-7m5 7V8M2 20h20"/></>,
    book: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H20v17H5.5A2.5 2.5 0 0 0 3 22Z"/><path d="M3 5.5V22m4-14h9m-9 4h9"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 1.7Z" transform="translate(-1 -1)"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    plus: <path d="M12 5v14m-7-7h14"/>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
  };
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.grid}</svg>;
}

export type DashboardFrameProps = {
  active: string;
  profileName?: string;
  grade?: string;
  context?: string;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  controls?: ReactNode;
  aside?: ReactNode;
  language?: string;
  lowData?: boolean;
  simpleReading?: boolean;
  children: ReactNode;
};

export default function DashboardFrame({ active, profileName = "Learner", grade = "8", context, theme, onThemeToggle, controls, aside, language = "en", lowData = false, simpleReading = false, children }: DashboardFrameProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [storedName, setStoredName] = useState(profileName);

  useEffect(() => {
    try { setStoredName(localStorage.getItem("padhai-saathi-nickname") || profileName); } catch { setStoredName(profileName); }
  }, [profileName]);

  function searchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) window.location.href = `/library?q=${encodeURIComponent(query)}`;
  }

  const selected = navigation.find((item) => item.id === active);
  const mobileItems = [navigation[0], navigation[1], navigation[4], navigation[6]];

  return <div className="workspace-app" data-theme={theme} data-language={language} data-low-data={lowData} data-simple-reading={simpleReading}>
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <Link href="/" className="workspace-brand" aria-label="Padhai Saathi dashboard"><span className="workspace-brand-mark"><WorkspaceIcon name="book"/></span></Link>
      <nav className="workspace-nav" aria-label="Main navigation">
        {navigation.map((item) => <Link key={item.id} href={item.href} className={`workspace-nav-item ${active === item.id ? "selected" : ""}`} aria-current={active === item.id ? "page" : undefined} title={item.label}>
          <WorkspaceIcon name={item.icon}/><span className="workspace-tooltip">{item.label}</span>
        </Link>)}
      </nav>
      <div className="workspace-sidebar-bottom">
        <Link href="/settings" className={`workspace-nav-item ${active === "settings" ? "selected" : ""}`} aria-label="Settings" title="Settings"><WorkspaceIcon name="settings"/><span className="workspace-tooltip">Settings</span></Link>
        <Link href="/settings" className="workspace-profile" title={`${storedName} · Class ${grade}`}><span className="profile-initial">{storedName.slice(0, 1).toLocaleUpperCase()}</span><span className="profile-meta"><strong>{storedName}</strong><small>Class {grade}</small></span></Link>
      </div>
    </aside>

    <div className="workspace-body">
      <header className="command-bar">
        <div className="command-context"><span className="command-brand-mobile"><WorkspaceIcon name="book"/></span><div><strong>{selected?.label ?? "Student workspace"}</strong><span>{context ?? `Class ${grade} · ${storedName}`}</span></div></div>
        <form className="command-search" role="search" onSubmit={searchSubmit}><WorkspaceIcon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search studies, notes, and documents" placeholder="Search workspace"/><kbd>/</kbd></form>
        <div className="command-actions">
          <div className="local-state-pill"><i aria-hidden="true"/>Stored on this device</div>
          <div className="quick-create-wrap"><button className="icon-command" type="button" aria-label="Quick create" aria-expanded={quickCreateOpen} onClick={() => setQuickCreateOpen((open) => !open)}><WorkspaceIcon name="plus"/></button>
            {quickCreateOpen && <div className="command-menu" role="menu"><strong>Create</strong><Link role="menuitem" href="/documents">Upload document</Link><Link role="menuitem" href="/planner">Exam plan</Link><Link role="menuitem" href="/quizzes">Quiz</Link><Link role="menuitem" href="/flashcards">Flashcard deck</Link><Link role="menuitem" href="/library">Note</Link></div>}
          </div>
          {controls}
          <button className="icon-command theme-command" type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "◐" : "◑"}</button>
        </div>
      </header>
      <div className={`workspace-content ${aside ? "with-context-panel" : ""}`}>
        <main className="workspace-main" id="main-content">{children}</main>
        {aside && <aside className="workspace-context-panel"><div className="context-panel-heading"><span>Context</span><button className="icon-command" type="button" aria-label="Collapse context panel" onClick={(event) => event.currentTarget.closest(".workspace-content")?.classList.toggle("context-collapsed")}><WorkspaceIcon name="panel"/></button></div>{aside}</aside>}
      </div>
    </div>

    <nav className="workspace-bottom-nav" aria-label="Primary mobile navigation">
      {mobileItems.map((item) => <Link key={item.id} href={item.href} className={active === item.id ? "selected" : ""} aria-label={item.label}><WorkspaceIcon name={item.icon}/><span>{item.label}</span></Link>)}
      <button type="button" className={moreOpen ? "selected" : ""} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}><WorkspaceIcon name="chevron"/><span>More</span></button>
      {moreOpen && <div className="mobile-more-menu">{navigation.filter((item) => !mobileItems.some((mobileItem) => mobileItem.id === item.id)).map((item) => <Link key={item.id} href={item.href}><WorkspaceIcon name={item.icon}/>{item.label}</Link>)}<Link href="/settings"><WorkspaceIcon name="settings"/>Settings</Link></div>}
    </nav>
  </div>;
}
