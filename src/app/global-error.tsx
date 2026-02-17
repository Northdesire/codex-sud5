"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              Kritischer Fehler
            </h2>
            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              {error.message || "Die Anwendung ist auf einen Fehler gestoßen."}
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.5rem",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #ddd",
                background: "#000",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Neu laden
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
