import React from "react";
import { NavLink } from "react-router-dom";
import { fetchHealth } from "../api";
import { useEffect, useState } from "react";

function NavBar() {
  const [health, setHealth] = useState({ status: "unknown", db_ok: false });

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((res) => {
        if (!cancelled) setHealth(res);
      })
      .catch(() => {
        if (!cancelled) setHealth({ status: "error", db_ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dbOk = health.db_ok;
  const statusLabel =
    health.status === "ok"
      ? dbOk
        ? "API + DB OK"
        : "API OK, DB?"
      : "API error";

  return (
    <header className="nav-bar">
      <div className="nav-title">
        <span>Assetto Corsa + sTracker</span>
        <span>Results &amp; Championships</span>
      </div>
      <nav className="nav-links">
        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " active" : "")
          }
        >
          Sessions
        </NavLink>
        <NavLink
          to="/drivers"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " active" : "")
          }
        >
          Drivers
        </NavLink>
        <NavLink
          to="/championships"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " active" : "")
          }
        >
          Championships
        </NavLink>
        <NavLink
          to="/admin/championships"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " active" : "")
          }
        >
          Admin
        </NavLink>

        <div className="badge" title={statusLabel}>
          <span
            className={
              "badge-dot " + (health.status === "ok" && dbOk ? "ok" : "bad")
            }
          />
          <span>{statusLabel}</span>
        </div>
      </nav>
    </header>
  );
}

export default NavBar;
