import React from "react";

function ErrorBanner({ error }) {
  if (!error) return null;
  const message =
    typeof error === "string"
      ? error
      : error.message || error.details?.error || "An error occurred";
  return <div className="error-banner">{message}</div>;
}

export default ErrorBanner;
