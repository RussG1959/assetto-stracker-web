import React, { useEffect, useState } from "react";
import { fetchDrivers } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function PublicDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDrivers()
      .then((data) => {
        if (!cancelled) {
          setDrivers(data);
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
            <div className="card-title">Drivers</div>
            <div className="card-subtitle">
              All drivers seen in the database
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
                <th>Driver</th>
                <th>Sessions</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.player_id}>
                  <td>{d.driver_name}</td>
                  <td>{d.total_sessions}</td>
                  <td>
                    {d.last_seen
                      ? new Date(d.last_seen).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PublicDrivers;
