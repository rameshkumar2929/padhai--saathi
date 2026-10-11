import Link from "next/link";

export default function Page() {
  return (
    <main style={{
      minHeight: "100vh",
      padding: "40px 24px",
      background: "#0b1020",
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <Link href="/" style={{ color: "#93c5fd" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "32px", fontSize: "32px" }}>
          Settings
        </h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.7 }}>
          This section is ready for development. Its full functionality
          has not been implemented yet.
        </p>
        <Link href="/doubts" style={{ color: "#93c5fd" }}>
          Open AI Tutor
        </Link>
      </div>
    </main>
  );
}
