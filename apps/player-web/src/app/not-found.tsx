import Link from "next/link";

export default function NotFound() {
  return <main className="status-page"><h1>Dieser Raum ist geschlossen</h1><p>Das Spiel oder die Seite wurde nicht gefunden.</p><Link className="primary-button" href="/">Zurueck zur Lobby</Link></main>;
}
