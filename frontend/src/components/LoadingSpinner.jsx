import React from "react";

function LoadingSpinner({ label = "Loading..." }) {
  return <div className="loading">{label}</div>;
}

export default LoadingSpinner;
