import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchChampionships } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function PublicChampionships() {
  const [champs, setChamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChampionships()
      .then((data) => {
        if (!cancelled) {
          setChamps(data);
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

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Championships</div>
            <div className="card-subtitle">
              Championship System entries (csevent)
            </div>
          </div>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {champs.map((c) => (
                <tr
                  key={c.championship_id}
                  onClick={() =>
                    navigate(`/championships/${c.championship_id}`)
                  }
                >
                  <td>{c.championship_id}</td>
                  <td>{c.championship_name}</td>
                  <td>{c.drop_worst}</td>
                </tr>
              ))}
              {champs.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center" }}>
                    No championships found.
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

export default PublicChampionships;
