// src/PublicChampionships.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "./api";

// Keep drop in the URL (?drop=N)
function useDropQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const initial = Math.max(parseInt(params.get("drop") || "0", 10), 0);
  const [drop, setDrop] = useState(initial);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (drop > 0) p.set("drop", String(drop));
    else p.delete("drop");
    const newUrl =
      window.location.pathname + (p.toString() ? "?" + p.toString() : "");
    window.history.replaceState(null, "", newUrl);
  }, [drop]);

  return [drop, setDrop];
}

export default function PublicChampionships({ onOpenSession }) {
  onOpenSession = onOpenSession || (() => {});

  const [seasons, setSeasons] = useState([]);
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [drop, setDrop] = useDropQueryParam();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setSeasons(await fetchJSON("/api/championships"));
    })();
  }, []);

  useEffect(() => {
    if (active) load(active.csid, drop);
    // eslint-disable-next-line
  }, [active, drop]);

  async function load(id, d) {
    setLoading(true);
    try {
      const q = `/api/championship/${id}?drop=${parseInt(d || 0, 10)}`;
      setData(await fetchJSON(q));
    } finally {
      setLoading(false);
    }
  }

  const sessionsByEvent = useMemo(() => {
    if (!data) return {};
    const groups = {};
    for (const s of data.sessions) {
      if (!groups[s.eventid]) groups[s.eventid] = [];
      groups[s.eventid].push(s);
    }
    for (const eid of Object.keys(groups)) {
      groups[eid].sort(
        (a, b) =>
          (a.starttimedate || 0) - (b.starttimedate || 0) ||
          a.cseventsessionid - b.cseventsessionid
      );
    }
    return groups;
  }, [data]);

  return (
    <div className="grid" style={{ gridTemplateColumns: "260px 1fr" }}>
      <div className="card">
        <h3>Championships</h3>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {seasons.map((s) => (
            <li
              key={s.csid}
              style={{
                padding: "4px 0",
                cursor: "pointer",
                fontWeight:
                  active && active.csid === s.csid ? "bold" : "normal",
              }}
              onClick={() => setActive(s)}
            >
              {s.csname}
            </li>
          ))}
        </ul>
      </div>

      <div>
        {!active && <div className="card">Select a championship…</div>}
        {active && (
          <div className="card">
            {/* Name + drop input on the left */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0 }}>{active.csname}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label>Drop worst events:</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={drop}
                  onChange={(e) =>
                    setDrop(Math.max(parseInt(e.target.value || "0", 10), 0))
                  }
                  style={{ width: 80 }}
                />
              </div>
            </div>

            {loading && <div>Loading…</div>}
            {!loading && data && (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th rowSpan="2">#</th>
                      <th rowSpan="2">Driver</th>
                      <th rowSpan="2">
                        Total (drop {data.drop || 0})
                      </th>
                      {data.events.map((ev) => (
                        <th
                          key={ev.eventid}
                          colSpan={
                            (sessionsByEvent[ev.eventid] || []).length || 1
                          }
                        >
                          {ev.eventname}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {data.events.flatMap((ev) =>
                        (sessionsByEvent[ev.eventid] || []).map((s) => (
                          <th key={s.cseventsessionid}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "2px 6px", fontSize: 11 }}
                              onClick={() => {
                                if (s.sessionid) {
                                  onOpenSession(s.sessionid);
                                }
                              }}
                            >
                              {s.sessionname || s.sessiontype || "Race"}
                            </button>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((d, idx) => (
                      <tr key={d.playerid}>
                        <td>{idx + 1}</td>
                        <td>{d.driver_name}</td>
                        <td>
                          <strong>{d.total_points ?? 0}</strong>
                        </td>
                        {data.events.flatMap((ev) =>
                          (sessionsByEvent[ev.eventid] || []).map((s) => {
                            const isDropped =
                              Array.isArray(d.dropped_events) &&
                              d.dropped_events.includes(ev.eventid);
                            return (
                              <td
                                key={s.cseventsessionid}
                                className={
                                  isDropped ? "dropped-cell" : undefined
                                }
                              >
                                {d.per_session?.[s.cseventsessionid] ?? 0}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 12, marginTop: 4, color: "#6b7280" }}>
                  <em>Red cells are events dropped for that driver.</em>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
