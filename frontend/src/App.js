// src/App.js
import React, { useState } from "react";
import PublicSessions from "./PublicSessions";
import PublicChampionships from "./PublicChampionships";

export default function App() {
  const [view, setView] = useState("sessions");
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  function handleOpenSessionFromChamp(sessionId) {
    if (!sessionId) return;
    setSelectedSessionId(sessionId);
    setView("sessions");
  }

  function handleExternalSessionHandled() {
    setSelectedSessionId(null);
  }

  return (
    <div>
      <header className="header">
        <div className="logo">sTracker Web UI</div>
        <div className="nav">
          <button
            className={
              "btn " + (view === "sessions" ? "btn-primary" : "btn-secondary")
            }
            onClick={() => setView("sessions")}
          >
            Sessions
          </button>
          <button
            className={
              "btn " + (view === "champs" ? "btn-primary" : "btn-secondary")
            }
            onClick={() => setView("champs")}
          >
            Championships
          </button>
        </div>
      </header>
      <main className="container">
        {view === "sessions" && (
          <PublicSessions
            externalSessionId={selectedSessionId}
            onExternalSessionHandled={handleExternalSessionHandled}
          />
        )}
        {view === "champs" && (
          <PublicChampionships onOpenSession={handleOpenSessionFromChamp} />
        )}
      </main>
    </div>
  );
}
