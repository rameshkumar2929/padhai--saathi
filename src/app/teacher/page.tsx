import Link from "next/link";

const demoTopics = [
  { subject: "Maths", topic: "Fractions", struggling: 18, total: 30, trend: "Most common" },
  { subject: "Science", topic: "Force and motion", struggling: 14, total: 30, trend: "Needs a recap" },
  { subject: "Maths", topic: "Percentages", struggling: 11, total: 30, trend: "Improving" },
  { subject: "Science", topic: "Food chains", struggling: 8, total: 30, trend: "On track" },
];

export default function TeacherPage() {
  return <main className="teacher-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">પ</span><span>Padhai Saathi</span></Link><Link className="nav-link active" href="/">Student view</Link></header>
    <section className="teacher-content">
      <div className="eyebrow"><span className="eyebrow-dot" />Classroom overview</div>
      <h1>Where should we practise together?</h1>
      <p className="teacher-intro">A sample class summary to help plan the next lesson.</p>
      <div className="demo-banner"><strong>DEMO DATA</strong><span>This is example information only. No student data is collected or shown here.</span></div>
      <div className="teacher-summary"><div><span>30</span><small>sample students</small></div><div><span>4</span><small>topics checked</small></div><div><span>8-10</span><small>class range</small></div></div>
      <h2>Topics to revisit</h2>
      <div className="teacher-table"><div className="teacher-table-head"><span>Subject / topic</span><span>Students needing practice</span><span>Lesson note</span></div>
        {demoTopics.map((item) => <div className="teacher-table-row" key={item.topic}><div><span>{item.subject}</span><strong>{item.topic}</strong></div><div><strong>{item.struggling} <small>/ {item.total}</small></strong><span className="teacher-bar"><i style={{ width: `${Math.round(item.struggling / item.total * 100)}%` }} /></span></div><span className="teacher-trend">{item.trend}</span></div>)}
      </div>
      <Link href="/" className="primary-button teacher-cta">Start a student check <span aria-hidden="true">→</span></Link>
    </section>
    <footer className="site-footer"><span>Planning aid for educators</span><span>SDG 4 <i aria-hidden="true" /></span></footer>
  </main>;
}