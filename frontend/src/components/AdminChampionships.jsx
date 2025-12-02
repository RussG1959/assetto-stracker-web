import React, { useEffect, useState } from "react";
import {
  fetchChampionships,
  updateChampionshipDropWorst,
  fetchAdminStats
} from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function AdminChampionships() {
  const [champs, setChamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchChampionships()
      .then((data) => {
        setChamps(data);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));

    fetchAdminStats()
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  };

  useEffect(() => {
    load();
  }, []);

  const onDropWorstChange = (id, value) => {
    setChamps((prev) =>
      prev.map((c) =>
        c.championship_id === id ? { ...c, drop_worst: value } : c
      )
    );
  };

  const saveDropWorst = (id, value) => {
    setSavingId(id);
    updateChampionshipDropWorst(id, Number(value || 0))
      .then(() => load())
      .catch((err) => setError(err))
      .finally(() => setSavingId(null));
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Admin · Championships</div>
            <div className="card-subtitle">
              Manage drop-worst settings and view basic DB stats
            </div>
          </div>
          <button className="btn btn-sm" onClick={load}>
            Refresh
          </button>
        </div>

        {stats && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem",
              fontSize: "0.75rem"
            }}
          >
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="badge">
                <span style={{ textTransform: "uppercase" }}>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}

        <ErrorBanner error={error} />
        {loading ? (
          <LoadingSpinner />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Championship</th>
                <th>Drop worst</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {champs.map((c) => (
                <tr key={c.championship_id}>
                  <td>{c.championship_id}</td>
                  <td>{c.championship_name}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      style={{ width: "4rem" }}
                      value={c.drop_worst}
                      onChange={(e) =>
                        onDropWorstChange(
                          c.championship_id,
                          e.target.valueAsNumber || 0
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      disabled={savingId === c.championship_id}
                      onClick={() => saveDropWorst(c.championship_id, c.drop_worst)}
                    >
                      {savingId === c.championship_id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
              {champs.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    No championships.
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

export default AdminChampionships;
