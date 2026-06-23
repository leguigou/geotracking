import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a, #1e293b)",
      color: "white",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        width: 80, height: 80,
        background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)",
        borderRadius: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 36,
        fontWeight: "bold",
        marginBottom: 24
      }}>G</div>
      <h1 style={{ fontSize: 48, fontWeight: "bold", margin: 0 }}>
        GEOTrack AI
      </h1>
      <p style={{ fontSize: 18, color: "#94a3b8", marginTop: 8 }}>
        Générateurs d Intelligence Artificielle
      </p>
      <div style={{
        marginTop: 32,
        padding: "16px 32px",
        background: "#1e293b",
        borderRadius: 12,
        border: "1px solid #334155",
        color: "#22c55e",
        fontSize: 16
      }}>
        ✅ Serveur opérationnel
      </div>
      <p style={{ marginTop: 32, color: "#64748b", fontSize: 14 }}>
        API · OpenRouter · FastAPI · React
      </p>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
