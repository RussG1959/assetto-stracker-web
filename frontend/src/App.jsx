import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import NavBar from "./components/NavBar";
import PublicDrivers from "./components/PublicDrivers";
import PublicSessions from "./components/PublicSessions";
import PublicSessionDetail from "./components/PublicSessionDetail";
import PublicChampionships from "./components/PublicChampionships";
import PublicChampionshipDetail from "./components/PublicChampionshipDetail";
import AdminChampionships from "./components/AdminChampionships";
import AdminCorrections from "./components/AdminCorrections";

function App() {
  return (
    <div className="app-root">
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/sessions" replace />} />

          {/* Public */}
          <Route path="/drivers" element={<PublicDrivers />} />
          <Route path="/sessions" element={<PublicSessions />} />
          <Route path="/sessions/:sessionId" element={<PublicSessionDetail />} />
          <Route path="/championships" element={<PublicChampionships />} />
          <Route
            path="/championships/:championshipId"
            element={<PublicChampionshipDetail />}
          />

          {/* Admin */}
          <Route path="/admin/championships" element={<AdminChampionships />} />
          <Route path="/admin/corrections" element={<AdminCorrections />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/sessions" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
