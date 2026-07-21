"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const storageKey = "aurora.compliance.v1";

interface ComplianceState {
  readonly ageConfirmed: boolean;
  readonly termsAccepted: boolean;
  readonly analytics: boolean;
  readonly confirmedAt: string;
}

function readState(): ComplianceState | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ComplianceState>;
    return parsed.ageConfirmed && parsed.termsAccepted ? parsed as ComplianceState : null;
  } catch {
    return null;
  }
}

/**
 * Altersbestaetigung (18+), Zustimmung zu den Nutzungsbedingungen und
 * optionale Analyse-Einwilligung. Blockiert die App bis zur Entscheidung.
 * Die Einwilligung ist granular und jederzeit widerrufbar (Konto-Seite).
 */
export function AgeGate() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    setOpen(readState() === null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, ready]);

  function confirm() {
    const state: ComplianceState = {
      ageConfirmed: true, termsAccepted: true, analytics,
      confirmedAt: new Date().toISOString(),
    };
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Speicher optional */ }
    setOpen(false);
  }

  if (!ready || !open) return null;
  return <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
    <div className="age-gate-panel">
      <span className="age-gate-badge">18+</span>
      <h1 id="age-gate-title">Willkommen bei Aurora Casino</h1>
      <p className="age-gate-lead">
        Aurora Casino ist ein <strong>soziales Casinospiel mit virtuellem Spielgeld</strong>. Es gibt keine
        Echtgeldeinsaetze, keine Echtgeldgewinne und keine Auszahlung virtueller Waehrungen. Erfolg hier bedeutet
        nicht, dass du bei echtem Gluecksspiel ebenso erfolgreich waerst.
      </p>
      <label className="age-gate-option">
        <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
        <span>
          <strong>Optional: anonyme Nutzungsanalyse erlauben</strong>
          <small>Hilft uns, Fehler zu finden und das Spiel zu verbessern. Jederzeit widerrufbar.</small>
        </span>
      </label>
      <button className="age-gate-confirm" onClick={confirm}>
        Ich bin 18 Jahre oder aelter und stimme zu
      </button>
      <p className="age-gate-links">
        Mit der Bestaetigung akzeptierst du die <Link href="/legal/nutzungsbedingungen">Nutzungsbedingungen</Link> und
        die <Link href="/legal/datenschutz">Datenschutzerklaerung</Link>.
        Mehr zum <Link href="/legal/verantwortungsvolles-spielen">verantwortungsvollen Spielen</Link>.
      </p>
    </div>
  </div>;
}
