import Link from "next/link";
import { legalDocuments } from "@/lib/legal-content";

/**
 * Persistenter Rechtshinweis-Footer. Kommuniziert an jeder Stelle der App klar,
 * dass es sich um ein soziales Casinospiel ohne Echtgeldgewinne handelt.
 */
export function LegalFooter() {
  return <footer className="legal-footer">
    <p>
      <strong>18+ · Soziales Casinospiel mit virtuellem Spielgeld.</strong> Keine Echtgeldeinsaetze, keine
      Echtgeldgewinne, keine Auszahlung virtueller Waehrungen. Erfolg in diesem Spiel bedeutet nicht, dass du bei
      echtem Gluecksspiel ebenso erfolgreich waerst.
    </p>
    <nav aria-label="Rechtliche Hinweise">
      {legalDocuments.map((entry) => <Link key={entry.slug} href={`/legal/${entry.slug}`}>{entry.title}</Link>)}
    </nav>
  </footer>;
}
