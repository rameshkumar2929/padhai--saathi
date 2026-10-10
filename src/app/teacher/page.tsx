import Link from "next/link";

const demoTopics = [
  { subject: "Maths", topic: "Fractions", struggling: 18, total: 30, trend: "Most common" },
  { subject: "Science", topic: "Force and motion", struggling: 14, total: 30, trend: "Needs a recap" },
  { subject: "Maths", topic: "Percentages", struggling: 11, total: 30, trend: "Improving" },
  { subject: "Science", topic: "Food chains", struggling: 8, total: 30, trend: "On track" },
];

export default function TeacherPage() {
  return <main className="teacher-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">પ</span><span>Padhai Saathi</span></Link><nav aria-label="Main navigation" className="main-nav"><Link className="nav-link" href="/">Home</Link><Link className="nav-link" href="/?view=progress">Progress</Link><Link className="nav-link active" href="/teacher" aria-current="page">Teacher</Link></nav></header>
    <section className="teacher-content">
      <div className="eyebrow"><span className="eyebrow-dot" />Classroom overview</div>
      <h1>Where should we practise together?</h1>
      <p className="teacher-intro">A sample class summary to help plan the next lesson.</p>
      <div className="demo-banner"><strong>DEMO DATA</strong><span>This is example information only. No student data is collected or shown here.</span></div>
      <div className="teacher-summary"><div><span>30</span><small>sample students</small></div><div><span>4</span><small>topics checked</small></div><div><span>8-10</span><small>class range</small></div></div>
      <section className="teacher-chart-section" aria-labelledby="weakest-topics-title"><div className="teacher-section-heading"><div><span className="eyebrow">Classroom pulse</span><h2 id="weakest-topics-title">Topics needing attention</h2></div><span className="chart-key"><i />Students needing practice</span></div><div className="teacher-chart">{demoTopics.slice().sort((a, b) => b.struggling / b.total - a.struggling / a.total).map((item) => <div className="teacher-chart-row" key={item.topic}><div className="teacher-chart-label"><span>{item.subject}</span><strong>{item.topic}</strong></div><div className="teacher-chart-track"><i style={{ width: `${Math.round(item.struggling / item.total * 100)}%` }} /></div><strong className="teacher-chart-value">{Math.round(item.struggling / item.total * 100)}%</strong></div>)}</div></section>
      <section className="teacher-table-section" aria-labelledby="topic-details-title"><h2 id="topic-details-title">Topic details</h2><div className="teacher-table" role="table" aria-label="Class topic summary"><div className="teacher-table-head" role="row"><span role="columnheader">Subject / topic</span><span role="columnheader">Students needing practice</span><span role="columnheader">Lesson note</span></div>
        {demoTopics.map((item) => <div className="teacher-table-row" role="row" key={item.topic}><div role="cell"><span>{item.subject}</span><strong>{item.topic}</strong></div><div role="cell"><strong>{item.struggling} <small>/ {item.total}</small></strong></div><span className="teacher-trend" role="cell">{item.trend}</span></div>)}
      </div></section>
      <Link href="/" className="primary-button teacher-cta">Start a student check <span aria-hidden="true">→</span></Link>
    </section>
    <footer className="site-footer"><span><strong>Padhai Saathi</strong><small>Built by Ramesh Kumar, Marwadi University</small></span><span className="sdg-badge">SDG 4 <i aria-hidden="true" /></span></footer>
  </main>;
}