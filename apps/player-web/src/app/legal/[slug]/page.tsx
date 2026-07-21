import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findLegalDocument, legalDocuments } from "@/lib/legal-content";

export function generateStaticParams() {
  return legalDocuments.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ slug: string }> }>): Promise<Metadata> {
  const { slug } = await params;
  const legalDocument = findLegalDocument(slug);
  if (!legalDocument) return { title: "Nicht gefunden" };
  return {
    title: legalDocument.title,
    description: legalDocument.description,
    alternates: { canonical: `/legal/${legalDocument.slug}` },
  };
}

export default async function LegalPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const legalDocument = findLegalDocument(slug);
  if (!legalDocument) notFound();
  return <main className="legal-page">
    <nav className="legal-nav" aria-label="Rechtliche Seiten">
      <Link href="/">&larr; Lobby</Link>
      {legalDocuments.map((entry) => <Link key={entry.slug} href={`/legal/${entry.slug}`} className={entry.slug === legalDocument.slug ? "active" : ""}>{entry.title}</Link>)}
    </nav>
    <article className="legal-article">
      <h1>{legalDocument.title}</h1>
      <p className="legal-updated">Zuletzt aktualisiert: {new Date(legalDocument.updatedAt).toLocaleDateString("de-DE")}</p>
      {legalDocument.intro && <p className="legal-intro">{legalDocument.intro}</p>}
      {legalDocument.sections.map((section) => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
      <aside className="legal-note" role="note">
        Aurora Casino ist ein soziales Casinospiel mit virtuellem Spielgeld ab 18 Jahren. Es gibt keine Echtgeldeinsaetze,
        keine Echtgeldgewinne und keine Auszahlung virtueller Waehrungen.
      </aside>
    </article>
  </main>;
}
