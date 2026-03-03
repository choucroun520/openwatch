export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        background: "#0b0b14",
        color: "#e2e8f0",
        fontFamily: "Inter, -apple-system, sans-serif",
      }}
    >
      <div style={{ fontSize: 32 }}>⌚</div>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          margin: 0,
        }}
      >
        OpenWatch
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
        Dealer Network — Phase 1
      </p>
    </div>
  );
}
