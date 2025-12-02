import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSessions } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function sessionTypeClass(type) {
  if (!type) return "type-pill";
  const t = String(type).toLowerCase();
  if (t.includes("race")) return "type-pill type-race";
  if (t.includes("qual")) return "type-pill type-quali";
  return "type-pill type-practice";
}

function PublicSessions() {
  const [sessions, setSessions] = useState([]);
  const [serverFilter, setServerFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const loadSessions = () => {
    setLoading(true);
    setError(null);
    fetchSessions({
      server: serverFilter || undefined,
      type: typeFilter || undefined
    })
      .then((data) => {
        setSessions(data);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSessions()
      .then((data) => {
        if (!cancelled) {
          setSessions(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const serverOptions = useMemo(() => {
    const set = new Set();
    sessions.forEach((s) => {
      if (s.server_name) set.add(s.server_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const typeOptions = useMemo(() => {
    const set = new Set();
    sessions.forEach((s) => {
      if (s.session_type) set.add(s.session_type);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    return sessions;
  }, [sessions]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Sessions</div>
            <div className="card-subtitle">
              Latest sessions from sTracker (limit 200)
            </div>
          </div>
          <button className="btn btn-sm" onClick={loadSessions}>
            Refresh
          </button>
        </div>

        <div className="filters-row">
          <div className="filter-control">
            <label>Server</label>
            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
            >
              <option value="">All servers</option>
              {serverOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-control">
            <label>Session type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ErrorBanner error={error} />
        {loading ? (
          <LoadingSpinner />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Session</th>
                <th>Track</th>
                <th>Server</th>
                <th>Type</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {visibleSessions.map((s) => (
                <tr
                  key={s.session_id}
                  onClick={() => navigate(`/sessions/${s.session_id}`)}
                >
                  <td>
                    {s.start_time
                      ? new Date(s.start_time).toLocaleString()
                      : "—"}
                  </td>
                  <td>{s.session_name}</td>
                  <td>{s.track}</td>
                  <td>{s.server_name}</td>
                  <td>
                    <span className={sessionTypeClass(s.session_type)}>
                      {s.session_type || "?"}
                    </span>
                  </td>
                  <td>
                    {typeof s.duration_s === "number"
                      ? `${Math.round(s.duration_s / 60)} min`
                      : "—"}
                  </td>
                </tr>
              ))}
              {visibleSessions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    No sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PublicSessions;
