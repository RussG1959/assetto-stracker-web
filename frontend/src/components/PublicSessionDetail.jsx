import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchSessionDetail, fetchCorrectionsForSession } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function msToTime(ms) {
  if (ms == null) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(3, "0")}`;
}

function PublicSessionDetail() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [corrLoading, setCorrLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSessionDetail(sessionId)
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

    setCorrLoading(true);
    fetchCorrectionsForSession(sessionId)
      .then((res) => {
        if (!cancelled) setCorrections(res);
      })
      .catch(() => {
        if (!cancelled) setCorrections([]);
      })
      .finally(() => {
        if (!cancelled) setCorrLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) return <LoadingSpinner label="Loading session..." />;

  if (!data) return <ErrorBanner error={error || "Session not found"} />;

  const { session, drivers, laps } = data;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{session.session_name}</div>
            <div className="card-subtitle">
              {session.track} · {session.server_name} · {session.session_type} ·{" "}
              {session.start_time
                ? new Date(session.start_time).toLocaleString()
                : "date unknown"}
            </div>
          </div>
        </div>
        <ErrorBanner error={error} />

        <h3 style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
          Classification (corrected)
        </h3>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Laps</th>
              <th>Total (base)</th>
              <th>Total (corr)</th>
              <th>ΔTime</th>
              <th>Tyre</th>
              <th>Pts (base)</th>
              <th>Pts (corr)</th>
              <th>ΔPts</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.player_id}>
                <td>{d.position}</td>
                <td>{d.driver_name}</td>
                <td>
                  {d.corrected_laps_completed}
                  {d.delta_laps
                    ? ` (${d.base_laps_completed}+${d.delta_laps})`
                    : ""}
                </td>
                <td>{msToTime(d.base_total_time_ms)}</td>
                <td>{msToTime(d.corrected_total_time_ms)}</td>
                <td>
                  {d.delta_time_ms
                    ? `${d.delta_time_ms > 0 ? "+" : ""}${msToTime(
                        Math.abs(d.delta_time_ms)
                      )}`
                    : "—"}
                </td>
                <td>{d.compound || "—"}</td>
                <td>{d.base_points}</td>
                <td>{d.corrected_points}</td>
                <td>
                  {d.delta_points
                    ? `${d.delta_points > 0 ? "+" : ""}${d.delta_points}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ fontSize: "0.9rem", marginTop: "1rem" }}>Laps</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Lap</th>
              <th>Time</th>
              <th>Valid</th>
              <th>Tyre</th>
              <th>Sector splits</th>
            </tr>
          </thead>
          <tbody>
            {laps.map((lap) => (
              <tr key={lap.lap_id}>
                <td>{lap.driver_name}</td>
                <td>{lap.lap_no}</td>
                <td>{msToTime(lap.laptime_ms)}</td>
                <td>{lap.is_valid ? "✓" : "×"}</td>
                <td>{lap.compound || "—"}</td>
                <td>
                  {lap.sectors && lap.sectors.length > 0
                    ? lap.sectors
                        .sort((a, b) => a.sector_index - b.sector_index)
                        .map((s) => msToTime(s.sector_time_ms))
                        .join(" / ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ fontSize: "0.9rem", marginTop: "1rem" }}>Corrections</h3>
        {corrLoading ? (
          <LoadingSpinner label="Loading corrections..." />
        ) : corrections.length === 0 ? (
          <div className="card-subtitle">No corrections for this session.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>ΔPts</th>
                <th>ΔTime (ms)</th>
                <th>ΔLaps</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((c) => (
                <tr key={c.id}>
                  <td>{c.driver_name}</td>
                  <td>{c.deltapoints}</td>
                  <td>{c.deltatime}</td>
                  <td>{c.deltalaps}</td>
                  <td>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PublicSessionDetail;
