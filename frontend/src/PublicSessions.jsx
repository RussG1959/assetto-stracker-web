/* src/PublicSessions.jsx */
import React, { useEffect, useState } from "react";
import { fetchJSON, formatLap } from "./api";

function sessionTypeClass(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("race")) return "type-race";
  if (t.includes("qual")) return "type-qual";
  if (t.includes("prac")) return "type-practice";
  return "type-other";
}

export default function PublicSessions({
  externalSessionId = null,
  onExternalSessionHandled = () => {},
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [driverLaps, setDriverLaps] = useState(null);

  // Load sessions list
  useEffect(() => {
    load();
  }, [page, selectedServer]);

  async function load() {
    setLoading(true);
    try {
      const q = `/api/sessions?page=${page}&per_page=12${
        selectedServer ? `&server=${encodeURIComponent(selectedServer)}` : ""
      }`;
      const data = await fetchJSON(q);
      setRows(data.sessions || []);
      setServers(
        (data.servers || []).map((s) => s.serveripport).filter(Boolean)
      );

      // If detail session isn't in this page anymore, clear it
      if (
        detail &&
        !(data.sessions || []).some(
          (r) => r.sessionid === detail.session.sessionid
        )
      ) {
        setDetail(null);
        setDriverLaps(null);
      }
    } finally {
      setLoading(false);
    }
  }

  // Open a session in the right-hand pane
  async function openSession(id) {
    const d = await fetchJSON(`/api/session/${id}`);
    setDetail(d);
    setDriverLaps(null);
  }

  // Open laps for a specific driver
  async function openDriverLaps(sessionid, playerid) {
    const data = await fetchJSON(
      `/api/session/${sessionid}/driver/${playerid}`
    );
    setDriverLaps({ playerid, ...data });
  }

  // Handle external session request (from Championships)
  useEffect(() => {
    if (externalSessionId) {
      openSession(externalSessionId).finally(() => {
        onExternalSessionHandled && onExternalSessionHandled();
      });
    }
  }, [externalSessionId]);

  const bestOfSelected = driverLaps ? driverLaps.best_ms : null;

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {/* Left: Recent Sessions */}
      <div>
        <h3>Recent Sessions</h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <label>Server:</label>
          <select
            className="input"
            value={selectedServer}
            onChange={(e) => {
              setSelectedServer(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {servers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Page {page}</span>
        </div>

        {loading && <div>Loading…</div>}

        <table className="table">
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Server</th>
              <th>Track</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sessionid}>
                <td>
                  {r.starttimedate
                    ? new Date(r.starttimedate * 1000).toLocaleString()
                    : "-"}
                </td>
                <td>{r.serveripport || "-"}</td>
                <td>{r.track || "-"}</td>
                <td>
                  <span className={`badge ${sessionTypeClass(r.sessiontype)}`}>
                    {r.sessiontype}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => openSession(r.sessionid)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5}>No sessions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Right: Session details + driver laps */}
      <div>
        <h3>Session Details</h3>
        {!detail && <div className="card">Select a session…</div>}
        {detail && (
          <div className="card">
            <div>
              <strong>Session:</strong> #{detail.session.sessionid} •{" "}
              {detail.session.sessiontype}
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Server: {detail.session.serveripport || "-"}
            </div>

            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Car</th>
                  <th>Best Lap</th>
                  <th>Adjustment</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {detail.participants.map((p) => (
                  <tr key={p.playerinsessionid}>
                    <td>{p.finishposition ?? "-"}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          openDriverLaps(
                            detail.session.sessionid,
                            p.playerid
                          )
                        }
                      >
                        {p.driver_name}
                      </button>
                    </td>
                    <td>{p.car_name || "-"}</td>
                    <td>{formatLap(p.best_laptime)}</td>
                    <td>{p.adjustment || "-"}</td>
                    <td>{p.comment || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {driverLaps && (
              <div className="card" style={{ marginTop: 12 }}>
                <h4>
                  Driver laps –{" "}
                  {
                    detail.participants.find(
                      (p) => p.playerid === driverLaps.playerid
                    )?.driver_name
                  }
                  {bestOfSelected != null && (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      Best: {formatLap(bestOfSelected)}
                    </span>
                  )}
                </h4>
                <table className="table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Lap</th>
                      <th>S1</th>
                      <th>S2</th>
                      <th>S3</th>
                      <th>Tyre</th>
                      <th>Valid</th>
                      <th>Cuts</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverLaps.laps.map((lap, i) => {
                      const isBest =
                        bestOfSelected != null &&
                        lap.laptime === bestOfSelected;
                      return (
                        <tr
                          key={lap.lapid}
                          style={isBest ? { background: "#d1fae5" } : {}}
                        >
                          <td>{i + 1}</td>
                          <td>{formatLap(lap.laptime)}</td>
                          <td>{formatLap(lap.sectortime0)}</td>
                          <td>{formatLap(lap.sectortime1)}</td>
                          <td>{formatLap(lap.sectortime2)}</td>
                          <td>{lap.tyre || "-"}</td>
                          <td>{lap.valid}</td>
                          <td>{lap.cuts}</td>
                          <td>
                            {lap.timestamp
                              ? new Date(
                                  lap.timestamp * 1000
                                ).toLocaleTimeString()
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
