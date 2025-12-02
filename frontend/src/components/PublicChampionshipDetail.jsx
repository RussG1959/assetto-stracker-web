import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchChampionshipDetail } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function PublicChampionshipDetail() {
  const { championshipId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChampionshipDetail(championshipId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
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
  }, [championshipId]);

  if (loading) return <LoadingSpinner label="Loading championship..." />;
  if (!data) return <ErrorBanner error={error || "Championship not found"} />;

  const { championship, events, standings } = data;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              {championship.championship_name} (#{championship.championship_id})
            </div>
            <div className="card-subtitle">
              Drop worst {championship.drop_worst} event
              {championship.drop_worst === 1 ? "" : "s"} per driver
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
          Championship Standings
        </h3>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Total points</th>
              <th>Dropped events</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.player_id}>
                <td>{s.champ_position}</td>
                <td>{s.driver_name}</td>
                <td>{s.total_points.toFixed(1)}</td>
                <td>
                  {s.dropped_event_ids && s.dropped_event_ids.length > 0
                    ? s.dropped_event_ids.join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ fontSize: "0.9rem", marginTop: "1rem" }}>Events</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Name</th>
              <th>Date</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.event_id}>
                <td>{e.event_id}</td>
                <td>{e.event_name}</td>
                <td>
                  {e.event_date
                    ? new Date(e.event_date).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  {e.sessions.map((s) => s.session_name).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PublicChampionshipDetail;
