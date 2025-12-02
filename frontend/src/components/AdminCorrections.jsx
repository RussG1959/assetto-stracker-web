import React, { useState } from "react";
import { addCorrection, fetchCorrectionsForSession } from "../api";
import LoadingSpinner from "./LoadingSpinner";
import ErrorBanner from "./ErrorBanner";

function AdminCorrections() {
  const [form, setForm] = useState({
    session_id: "",
    player_id: "",
    deltapoints: 0,
    deltatime: 0,
    deltalaps: 0,
    note: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loadingCorr, setLoadingCorr] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadCorr = () => {
    if (!form.session_id) return;
    setLoadingCorr(true);
    fetchCorrectionsForSession(form.session_id)
      .then((res) => {
        setCorrections(res);
      })
      .catch(() => {
        setCorrections([]);
      })
      .finally(() => setLoadingCorr(false));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.session_id || !form.player_id) {
      setError("session_id and player_id are required");
     
