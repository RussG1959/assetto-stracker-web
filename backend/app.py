"""
sTracker Custom Web Backend (production-ready, with corrections + drop-worst)

Endpoints:
  GET  /api/health
  GET  /api/sessions
  GET  /api/session/<sessionid>
  GET  /api/session/<sessionid>/driver/<playerid>
  GET  /api/championships
  GET  /api/championship/<csid>?drop=N

Database:
  Uses existing sTracker PostgreSQL DB.

Env:
  DATABASE_URL = postgresql://pgstracker:pgstrackerpass@127.0.0.1:5432/stracker
"""

import os
from collections import defaultdict
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from flask_cors import CORS
from functools import wraps


# -----------------------------------------------------------------------------
# Flask / DB setup
# -----------------------------------------------------------------------------

# In production, we serve the built React app from ../frontend/build
app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
CORS(app)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://pgstracker:pgstrackerpass@127.0.0.1:5432/stracker",
)

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required")

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


def fetchall_dict(sql, params=None):
    params = params or {}
    rows = db.session.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


def fetchone_dict(sql, params=None):
    params = params or {}
    row = db.session.execute(text(sql), params).fetchone()
    return dict(row._mapping) if row else None


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------

@app.route("/api/health")
def health():
    db.session.execute(text("SELECT 1"))
    return jsonify({"status": "ok"})


# -----------------------------------------------------------------------------
# Sessions list + details
# -----------------------------------------------------------------------------

@app.route("/api/sessions")
def list_sessions():
    """
    List sessions with pagination and optional server filter.
    Returns:
      {
        page, per_page,
        sessions: [ { sessionid, starttimedate, sessiontype, track, serveripport, ... } ],
        servers:  [ { serveripport } ]
      }
    """
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(int(request.args.get("per_page", 25)), 200)
    offset = (page - 1) * per_page
    server_filter = request.args.get("server")

    sql = """
    SELECT
      s.sessionid,
      s.sessiontype,
      s.starttimedate,
      s.endtimedate,
      s.multiplayer,
      s.serveripport,
      t.uitrackname AS track
    FROM session s
    LEFT JOIN tracks t ON t.trackid = s.trackid
    WHERE (:server IS NULL OR s.serveripport = :server)
    ORDER BY s.starttimedate DESC
    LIMIT :limit OFFSET :offset
    """
    sessions = fetchall_dict(
        sql,
        {"limit": per_page, "offset": offset, "server": server_filter},
    )

    servers = fetchall_dict(
        """
        SELECT DISTINCT serveripport
        FROM session
        WHERE serveripport IS NOT NULL
        ORDER BY serveripport
        """
    )

    return jsonify(
        {
            "page": page,
            "per_page": per_page,
            "sessions": sessions,
            "servers": servers,
        }
    )


@app.route("/api/session/<int:sessionid>")
def session_detail(sessionid):
    """
    Session detail:
      - base session info (including derived track name, duration, ISO timestamps)
      - participants
      - best lap per driver
      - piscorrections deltas as "adjustment" + comment
    """
    session = fetchone_dict(
        "SELECT * FROM session WHERE sessionid = :id", {"id": sessionid}
    )
    if not session:
        abort(404, "session not found")

    # Enrich session with human‑friendly fields for the UI
    # Track name (from tracks table)
    track_name = None
    if session.get("trackid"):
        track_row = fetchone_dict(
            "SELECT uitrackname FROM tracks WHERE trackid = :tid",
            {"tid": session["trackid"]},
        )
        if track_row:
            track_name = track_row.get("uitrackname")
    session["track_name"] = track_name

    # Helper to normalise timestamps to ISO 8601 (UTC) for potential consumers
    def _to_iso(ts):
        if ts is None:
            return None
        # sTracker schema stores timestamps as integer seconds since epoch
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        # Fallback: cast to string
        return str(ts)

    session["start_iso"] = _to_iso(session.get("starttimedate"))
    session["end_iso"] = _to_iso(session.get("endtimedate"))

    # Duration in seconds (prefer computed from start/end, otherwise use raw column)
    if session.get("starttimedate") and session.get("endtimedate"):
        try:
            duration = int(session["endtimedate"] - session["starttimedate"])
            session["duration_seconds"] = max(duration, 0)
        except Exception:
            session["duration_seconds"] = session.get("duration")
    else:
        session["duration_seconds"] = session.get("duration")

    # Participants + corrections (deltas only; we don't rely on base laps/points columns)
    participant_sql = """
    SELECT
      pis.playerinsessionid,
      pis.finishposition,
      pis.finishtime,          -- base finish time (ms)
      p.playerid,
      p.name AS driver_name,
      c.uicarname AS car_name,
      COALESCE(pc.deltapoints, 0) AS deltapoints,
      COALESCE(pc.deltalaps, 0)   AS deltalaps,
      COALESCE(pc.deltatime, 0)   AS deltatime,
      pc.comment
    FROM playerinsession pis
    JOIN players p ON p.playerid = pis.playerid
    LEFT JOIN cars c ON c.carid = pis.carid
    LEFT JOIN piscorrections pc ON pc.playerinsessionid = pis.playerinsessionid
    WHERE pis.sessionid = :sid
    ORDER BY COALESCE(pis.finishposition, 9999)
    """
    participants = fetchall_dict(participant_sql, {"sid": sessionid})

    # Best lap per driver in this session
    best_sql = """
    SELECT
      l.playerinsessionid,
      MIN(l.laptime) AS best_laptime
    FROM lap l
    JOIN playerinsession pis ON l.playerinsessionid = pis.playerinsessionid
    WHERE pis.sessionid = :sid
      AND l.valid = ANY (ARRAY[1,2])
    GROUP BY l.playerinsessionid
    """
    best_rows = fetchall_dict(best_sql, {"sid": sessionid})
    best_map = {r["playerinsessionid"]: r["best_laptime"] for r in best_rows}

    # Overall best lap in the session (for highlighting fastest best lap)
    overall_best = None
    if best_map:
        overall_best = min(
            (v for v in best_map.values() if v is not None),
            default=None,
        )

    # Lap counts per driver (to determine if driver is laps down)
    lap_count_sql = """
    SELECT
      pis.playerinsessionid,
      COUNT(*) AS lap_count
    FROM lap l
    JOIN playerinsession pis ON pis.playerinsessionid = l.playerinsessionid
    WHERE pis.sessionid = :sid
    GROUP BY pis.playerinsessionid
    """
    lap_count_rows = fetchall_dict(lap_count_sql, {"sid": sessionid})
    lap_count_map = {r["playerinsessionid"]: int(r.get("lap_count", 0)) for r in lap_count_rows}

    # Pit stop summary per driver
    pit_sql = """
    SELECT
      pis.playerinsessionid,
      SUM(
        CASE
          WHEN l.timeinpitlane IS NOT NULL AND l.timeinpitlane > 0
          THEN 1
          ELSE 0
        END
      ) AS pit_stops,
      COALESCE(SUM(l.timeinpitlane), 0) AS pit_lane_time
    FROM lap l
    JOIN playerinsession pis ON pis.playerinsessionid = l.playerinsessionid
    WHERE pis.sessionid = :sid
    GROUP BY pis.playerinsessionid
    """
    pit_rows = fetchall_dict(pit_sql, {"sid": sessionid})
    pit_map = {
        r["playerinsessionid"]: {
            "pit_stops": int(r.get("pit_stops") or 0),
            "pit_lane_time": int(r.get("pit_lane_time") or 0),
        }
        for r in pit_rows
    }

    # Determine session type (race vs practice/qualify)
    session_type = (session.get("sessiontype") or "").lower()
    is_race = "race" in session_type

    # For race sessions: find fastest total race time (1st place finishtime)
    # For practice/qualify: gap will be calculated from best lap time
    fastest_finishtime = None
    fastest_lap_count = None
    if is_race:
        for p in participants:
            finishtime = p.get("finishtime")
            if finishtime is not None and finishtime > 0:
                if fastest_finishtime is None or finishtime < fastest_finishtime:
                    fastest_finishtime = finishtime
                    pid_sess = p["playerinsessionid"]
                    fastest_lap_count = lap_count_map.get(pid_sess, 0)

    # Compose adjustment string, attach best lap, total time, gap, and pit info
    for p in participants:
        pid_sess = p["playerinsessionid"]

        best_lap = best_map.get(pid_sess)
        p["best_laptime"] = best_lap

        # Total race time (finishtime in ms) - only relevant for race sessions
        finishtime = p.get("finishtime")
        p["total_time_ms"] = finishtime if finishtime is not None and finishtime > 0 else None

        # Gap to first calculation depends on session type
        gap_to_first = None
        gap_laps_down = None
        
        if is_race:
            # Race: gap based on total race time
            # If driver is laps down, show lap difference; otherwise show time gap
            if finishtime is not None and finishtime > 0 and fastest_finishtime is not None:
                driver_lap_count = lap_count_map.get(pid_sess, 0)
                if fastest_lap_count is not None and driver_lap_count < fastest_lap_count:
                    # Driver is laps down
                    gap_laps_down = fastest_lap_count - driver_lap_count
                else:
                    # Same number of laps (or more), calculate time gap
                    gap_to_first = finishtime - fastest_finishtime
        else:
            # Practice/Qualify: gap based on best lap time
            if best_lap is not None and overall_best is not None:
                gap_to_first = best_lap - overall_best
        
        p["gap_to_first_ms"] = gap_to_first
        p["gap_laps_down"] = gap_laps_down

        # Pit stats
        pit_info = pit_map.get(pid_sess, {})
        p["pit_stops"] = pit_info.get("pit_stops", 0)
        p["pit_lane_time_ms"] = pit_info.get("pit_lane_time", 0)

        # Human-readable adjustment summary from correction deltas
        adj_parts = []
        if p["deltapoints"] != 0:
            adj_parts.append(f"{'+' if p['deltapoints'] > 0 else ''}{p['deltapoints']} pts")
        if p["deltalaps"] != 0:
            adj_parts.append(f"{'+' if p['deltalaps'] > 0 else ''}{p['deltalaps']} laps")
        if p["deltatime"] != 0:
            adj_parts.append(f"{'+' if p['deltatime'] > 0 else ''}{p['deltatime']} ms")

        p["adjustment"] = ", ".join(adj_parts) if adj_parts else ""

    # Ensure serveripport is present
    if "serveripport" not in session:
        sr = fetchone_dict(
            "SELECT serveripport FROM session WHERE sessionid = :id", {"id": sessionid}
        )
        if sr:
            session["serveripport"] = sr["serveripport"]

    return jsonify({"session": session, "participants": participants})


@app.route("/api/session/<int:sessionid>/driver/<int:playerid>")
def driver_laps_in_session(sessionid, playerid):
    """
    All laps for a driver in a session, chronological, with sector splits.
    """
    sql = """
    SELECT
      l.lapid,
      l.laptime,
      l.valid,
      l.cuts,
      l."timestamp",
      l.sectortime0,
      l.sectortime1,
      l.sectortime2,
      tc.tyrecompound AS tyre
    FROM lap l
    JOIN playerinsession pis ON pis.playerinsessionid = l.playerinsessionid
    LEFT JOIN tyrecompounds tc ON tc.tyrecompoundid = l.tyrecompoundid
    WHERE pis.sessionid = :sid
      AND pis.playerid = :pid
    ORDER BY l."timestamp" ASC
    """

    laps = fetchall_dict(sql, {"sid": sessionid, "pid": playerid})
    best_ms = min((x["laptime"] for x in laps if x["laptime"] is not None), default=None)
    return jsonify({"best_ms": best_ms, "laps": laps})


# -----------------------------------------------------------------------------
# Championships
# -----------------------------------------------------------------------------

@app.route("/api/championships")
def championships_list():
    """
    List seasons/championships.
    """
    seasons = fetchall_dict(
        "SELECT csid, csname FROM csseasons ORDER BY csname"
    )
    return jsonify(seasons)


@app.route("/api/championship/<int:csid>")
def championship_standings(csid):
    """
    Championship standings with:
      - per-session points (columns)
      - total points with drop-worst events
      - corrections (piscorrections.deltapoints) included
      - dropped events per driver (for highlighting)
    """
    drop = max(int(request.args.get("drop", 0)), 0)

    # Events in this season
    events = fetchall_dict(
        "SELECT eventid, eventname FROM csevent WHERE csid = :csid ORDER BY eventid",
        {"csid": csid},
    )
    event_ids = [e["eventid"] for e in events]

    # Sessions (races) inside events
    sessions = fetchall_dict(
        """
        SELECT
          es.cseventsessionid,
          es.eventid,
          es.sessionid,
          es.sessionname,
          s.sessiontype,
          s.starttimedate
        FROM cseventsessions es
        JOIN csevent e ON e.eventid = es.eventid
        LEFT JOIN session s ON s.sessionid = es.sessionid
        WHERE e.csid = :csid
        ORDER BY es.eventid, s.starttimedate NULLS FIRST, es.cseventsessionid
        """,
        {"csid": csid},
    )

    # Points per driver per session, including corrections
    points_rows = fetchall_dict(
        """
        SELECT
          es.cseventsessionid,
          es.eventid,
          pis.playerid,
          SUM(
            COALESCE(pse.points, 0) + COALESCE(pc.deltapoints, 0)
          ) AS points
        FROM cseventsessions es
        JOIN session s ON s.sessionid = es.sessionid
        JOIN playerinsession pis ON pis.sessionid = s.sessionid
        JOIN csevent e ON e.eventid = es.eventid
        LEFT JOIN cspointschemaentry pse
          ON pse.pointschemaid = es.pointschemaid
         AND pse."position" = pis.finishposition
        LEFT JOIN piscorrections pc
          ON pc.playerinsessionid = pis.playerinsessionid
        WHERE e.csid = :csid
        GROUP BY es.cseventsessionid, es.eventid, pis.playerid
        """,
        {"csid": csid},
    )

    # Build driver structures
    drivers = {}
    per_event_totals = defaultdict(lambda: defaultdict(float))
    participated = defaultdict(lambda: defaultdict(bool))  # pid -> eventid -> bool

    for r in points_rows:
        pid = r["playerid"]
        if pid not in drivers:
            name_row = fetchone_dict(
                "SELECT name FROM players WHERE playerid = :pid",
                {"pid": pid},
            )
            drivers[pid] = {
                "playerid": pid,
                "driver_name": name_row["name"] if name_row else f"#{pid}",
                "per_session": {},  # cseventsessionid -> points
                "per_event": {},    # eventid -> points
                "total_points": 0,
                "dropped_events": [],
            }

        ses_id = r["cseventsessionid"]
        ev_id = r["eventid"]
        pts = float(r["points"] or 0.0)

        drivers[pid]["per_session"][ses_id] = pts
        per_event_totals[pid][ev_id] += pts
        participated[pid][ev_id] = True

    # Apply drop-worst logic per driver
    for pid, ev_map in per_event_totals.items():
        # Ensure all events exist
        for eid in event_ids:
            ev_map.setdefault(eid, 0.0)

        ev_list = []
        for eid in event_ids:
            pts = float(ev_map[eid])
            did_participate = participated[pid].get(eid, False)
            ev_list.append(
                {"eventid": eid, "points": pts, "participated": did_participate}
            )

        to_drop = set()

        # 1) drop missed zero events first
        missed_zero = [
            e for e in ev_list if e["points"] <= 0 and not e["participated"]
        ]
        missed_zero.sort(key=lambda x: x["eventid"])
        for e in missed_zero[:drop]:
            to_drop.add(e["eventid"])

        remaining = max(0, drop - len(to_drop))

        # 2) then drop lowest scored participated events if needed
        if remaining > 0:
            scored = [
                e
                for e in ev_list
                if e["participated"] and e["eventid"] not in to_drop
            ]
            scored.sort(key=lambda x: (x["points"], x["eventid"]))
            for e in scored[:remaining]:
                to_drop.add(e["eventid"])

        # Store per-event + total + dropped event info
        drivers[pid]["per_event"] = {eid: ev_map[eid] for eid in event_ids}
        total = sum(ev_map[eid] for eid in event_ids if eid not in to_drop)
        drivers[pid]["total_points"] = total
        drivers[pid]["dropped_events"] = list(to_drop)

    # Final standings sorted by total desc
    standings = sorted(
        drivers.values(),
        key=lambda d: (-d["total_points"], d["driver_name"]),
    )

    return jsonify(
        {
            "drop": drop,
            "events": events,
            "sessions": sessions,
            "standings": standings,
        }
    )


# -----------------------------------------------------------------------------
# Serve React build (for production)
# -----------------------------------------------------------------------------

# Serve React build in production
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    # If the requested file exists in the build folder, serve it directly
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)

    # Otherwise, always serve index.html (React router handles the rest)
    return send_from_directory(app.static_folder, "index.html")



if __name__ == "__main__":
    # Production-ish: bind to all interfaces so you can port-forward
    app.run(host="0.0.0.0", port=8084, debug=False)
