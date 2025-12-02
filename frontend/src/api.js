// src/api.js

// Simple JSON helper
export async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Format lap time in ms as mm:ss.mmm
export function formatLap(ms) {
  if (ms == null || ms <= 0) return "-";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  return `${String(minutes)}:${String(seconds).padStart(2, "0")}.${String(
    millis
  ).padStart(3, "0")}`;
}

// Optional default export if something imports default
export default { fetchJSON, formatLap };
