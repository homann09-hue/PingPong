/**
 * Zentrale Rechtstexte-Quelle fuer die Web-App.
 *
 * WICHTIG: Diese Texte sind ein fachlich vorbereitetes Geruest und ersetzen KEINE
 * Rechtsberatung. Alle mit TODO_LEGAL markierten Stellen benoetigen echte
 * Unternehmensdaten bzw. eine anwaltliche Pruefung vor Veroeffentlichung.
 * Siehe docs/legal-compliance.md.
 */

export const operator = {
  /** TODO_LEGAL: Firmierung eintragen. */
  companyName: "TODO_LEGAL: Firmenname",
  /** TODO_LEGAL: Ladungsfaehige Anschrift eintragen. */
  address: "TODO_LEGAL: Strasse, PLZ Ort, Land",
  /** TODO_LEGAL: Vertretungsberechtigte Person eintragen. */
  representative: "TODO_LEGAL: Geschaeftsfuehrung",
  /** TODO_LEGAL: Handelsregister und Nummer eintragen. */
  register: "TODO_LEGAL: Registergericht, HRB-Nummer",
  /** TODO_LEGAL: USt-IdNr. eintragen, falls vorhanden. */
  vatId: "TODO_LEGAL: USt-IdNr.",
  supportEmail: "support@aurora-casino.example",
  privacyEmail: "datenschutz@aurora-casino.example",
} as const;

export interface LegalSection { readonly heading: string; readonly paragraphs: readonly string[] }
export interface LegalDocument {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly updatedAt: string;
  readonly intro?: string;
  readonly sections: readonly LegalSection[];
}

const lastUpdated = "2026-07-21";

export const legalDocuments: readonly LegalDocument[] = [
  {
    slug: "datenschutz",
    title: "Datenschutzerklaerung",
    description: "Welche Daten Aurora Casino verarbeitet, zu welchem Zweck und welche Rechte du hast.",
    updatedAt: lastUpdated,
    intro: "Diese Erklaerung beschreibt die Verarbeitung personenbezogener Daten bei der Nutzung von Aurora Casino (Web und Apps).",
    sections: [
      { heading: "Verantwortlicher", paragraphs: [
        `Verantwortlich fuer die Datenverarbeitung ist ${operator.companyName}, ${operator.address}.`,
        `Fragen zum Datenschutz: ${operator.privacyEmail}`,
      ] },
      { heading: "Welche Daten wir verarbeiten", paragraphs: [
        "Kontodaten: eine pseudonyme Spieler-ID, Zeitpunkt der Kontoerstellung sowie — falls du dein Konto verknuepfst — die E-Mail-Adresse bzw. die Kennung deines Apple- oder Google-Kontos.",
        "Spieldaten: Spielstaende, Level, Erfahrungspunkte, Spielverlauf (Spins), Guthaben virtueller Waehrungen und der unveraenderliche Wallet-Verlauf. Diese Daten sind fuer den Betrieb zwingend erforderlich, damit Spielstaende geraeteuebergreifend korrekt und nachvollziehbar sind.",
        "Technische Daten: Geraete- und Installationskennung, Plattform, IP-Adresse zur Missbrauchsabwehr und Ratenbegrenzung, Sitzungsdaten sowie Fehler- und Leistungsdiagnosen.",
        "Kaufdaten: Wenn du virtuelle Guthaben kaufst, verarbeiten wir die Transaktionskennung des Stores und einen Pruefsummen-Nachweis. Zahlungsdaten selbst verarbeiten Apple bzw. Google, nicht wir.",
      ] },
      { heading: "Zwecke und Rechtsgrundlagen", paragraphs: [
        "Vertragserfuellung (Art. 6 Abs. 1 lit. b DSGVO): Bereitstellung des Spiels, Kontoverwaltung, Speicherung von Spielstaenden, Abwicklung von In-App-Kaeufen.",
        "Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO): Betrugs- und Missbrauchsabwehr, Stabilitaet und Sicherheit, Ratenbegrenzung, Fehleranalyse.",
        "Einwilligung (Art. 6 Abs. 1 lit. a DSGVO): optionale Analyse zur Produktverbesserung, Marketing-Benachrichtigungen und — sofern eingesetzt — personalisierte Werbung. Du kannst deine Einwilligung jederzeit in den Einstellungen widerrufen.",
      ] },
      { heading: "Werbung und Tracking", paragraphs: [
        "Marketing-Benachrichtigungen sind standardmaessig deaktiviert und werden nur nach ausdruecklicher Zustimmung versendet.",
        "Auf iOS fragen wir vor einer geraeteuebergreifenden Verfolgung ueber die App Tracking Transparency ab. Ohne deine Zustimmung erfolgt keine solche Verfolgung.",
        "Freiwillige Werbevideos (Rewarded Ads) koennen von Werbepartnern ausgeliefert werden. Deren Datenverarbeitung erfolgt nach den Bestimmungen des jeweiligen Anbieters. TODO_LEGAL: eingesetzte Werbepartner hier konkret benennen, sobald ausgewaehlt.",
      ] },
      { heading: "Empfaenger und Auftragsverarbeiter", paragraphs: [
        "Wir setzen Dienstleister als Auftragsverarbeiter ein, insbesondere fuer Hosting, Datenbank und Authentifizierung, Auslieferung von Inhalten sowie Fehler- und Leistungsueberwachung. TODO_LEGAL: konkrete Anbieter und Auftragsverarbeitungsvertraege nach Abschluss der Infrastruktur-Migration ergaenzen (siehe docs/MIGRATION.md).",
        "Eine Uebermittlung in Drittlaender erfolgt nur auf Grundlage geeigneter Garantien, etwa Standardvertragsklauseln.",
      ] },
      { heading: "Speicherdauer", paragraphs: [
        "Kontodaten speichern wir, solange dein Konto besteht. Nach einer Loeschung entfernen wir personenbezogene Daten oder anonymisieren sie.",
        "Buchungs- und Kaufnachweise bewahren wir auf, solange gesetzliche Aufbewahrungspflichten bestehen.",
        "Sicherheitsrelevante Protokolle werden nach kurzer Frist geloescht bzw. aggregiert.",
      ] },
      { heading: "Deine Rechte", paragraphs: [
        "Du hast das Recht auf Auskunft, Berichtigung, Loeschung, Einschraenkung der Verarbeitung, Datenuebertragbarkeit sowie Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen.",
        "Auskunft und Uebertragbarkeit kannst du direkt in der App ausloesen: Konto → Deine Daten → Datenexport herunterladen. Die Loeschung deines Kontos startest du ebenfalls dort.",
        "Du hast zudem das Recht, dich bei einer Datenschutz-Aufsichtsbehoerde zu beschweren.",
      ] },
      { heading: "Kinder und Jugendliche", paragraphs: [
        "Aurora Casino richtet sich ausschliesslich an Erwachsene ab 18 Jahren. Wir erheben nicht wissentlich Daten von Minderjaehrigen. Wenn uns bekannt wird, dass ein Konto von einer minderjaehrigen Person angelegt wurde, loeschen wir es.",
      ] },
    ],
  },
  {
    slug: "nutzungsbedingungen",
    title: "Nutzungsbedingungen",
    description: "Regeln fuer die Nutzung von Aurora Casino, virtuelle Waehrungen und Kaeufe.",
    updatedAt: lastUpdated,
    sections: [
      { heading: "Geltungsbereich und Anbieter", paragraphs: [
        `Diese Bedingungen regeln die Nutzung von Aurora Casino, angeboten von ${operator.companyName}, ${operator.address}.`,
        "Mit der Nutzung des Dienstes erklaerst du dich mit diesen Bedingungen einverstanden.",
      ] },
      { heading: "Soziales Spiel ohne Echtgeldgewinne", paragraphs: [
        "Aurora Casino ist ein reines Unterhaltungsangebot mit virtuellem Spielgeld. Es handelt sich NICHT um Gluecksspiel um Echtgeld.",
        "Es besteht keine Moeglichkeit, echtes Geld zu gewinnen. Virtuelle Coins, Gems und alle weiteren In-Game-Gegenstaende besitzen keinen Geldwert, koennen nicht ausgezahlt, nicht zurueckgetauscht und nicht ausserhalb des Spiels gehandelt werden.",
        "Erfolg in diesem Spiel bedeutet nicht, dass du bei echtem Gluecksspiel ebenso erfolgreich waerst.",
      ] },
      { heading: "Mindestalter", paragraphs: [
        "Die Nutzung ist Personen ab 18 Jahren vorbehalten. Mit der Nutzung bestaetigst du, dass du mindestens 18 Jahre alt bist.",
      ] },
      { heading: "Konto", paragraphs: [
        "Du kannst zunaechst als Gast spielen. Damit dein Fortschritt geraeteuebergreifend gesichert ist, kannst du dein Konto mit Apple, Google oder einer E-Mail-Adresse verknuepfen.",
        "Du bist fuer die Sicherheit deiner Zugangsdaten verantwortlich. Eine Weitergabe oder ein Verkauf von Konten ist nicht gestattet.",
      ] },
      { heading: "Virtuelle Waehrungen und Kaeufe", paragraphs: [
        "Virtuelle Waehrungen werden dir als widerrufliche, nicht uebertragbare Lizenz zur Nutzung innerhalb des Spiels eingeraeumt. Ein Eigentumsrecht entsteht nicht.",
        "Kaeufe virtueller Guthaben werden ueber den App Store bzw. Google Play abgewickelt. Fuer Erstattungen gelten die Bestimmungen des jeweiligen Stores.",
        "Bei Einstellung des Dienstes besteht kein Anspruch auf Erstattung nicht verbrauchter virtueller Waehrungen, soweit gesetzlich zulaessig. TODO_LEGAL: Vereinbarkeit mit Verbraucherrecht im Zielmarkt pruefen lassen.",
      ] },
      { heading: "Faires Spiel", paragraphs: [
        "Alle Spielergebnisse werden serverseitig ermittelt. Manipulationsversuche, automatisierte Zugriffe, Ausnutzung von Fehlern sowie das Erstellen mehrerer Konten zur Vorteilsnahme sind untersagt.",
        "Bei Verstoessen koennen wir Guthaben korrigieren, Funktionen einschraenken oder Konten sperren.",
      ] },
      { heading: "Verfuegbarkeit und Aenderungen", paragraphs: [
        "Wir entwickeln das Angebot laufend weiter und koennen Funktionen, Spiele und Belohnungen aendern oder einstellen. Eine ununterbrochene Verfuegbarkeit koennen wir nicht zusichern.",
      ] },
      { heading: "Haftung", paragraphs: [
        "Wir haften nach den gesetzlichen Bestimmungen fuer Vorsatz und grobe Fahrlaessigkeit sowie fuer Schaeden aus der Verletzung des Lebens, des Koerpers oder der Gesundheit. Im Uebrigen ist die Haftung auf vertragstypische, vorhersehbare Schaeden begrenzt. TODO_LEGAL: Haftungsklausel anwaltlich pruefen lassen.",
      ] },
      { heading: "Kontakt", paragraphs: [`Support: ${operator.supportEmail}`] },
    ],
  },
  {
    slug: "impressum",
    title: "Impressum",
    description: "Anbieterkennzeichnung nach den gesetzlichen Vorgaben.",
    updatedAt: lastUpdated,
    sections: [
      { heading: "Anbieter", paragraphs: [
        operator.companyName,
        operator.address,
        `Vertreten durch: ${operator.representative}`,
      ] },
      { heading: "Kontakt", paragraphs: [`E-Mail: ${operator.supportEmail}`, "TODO_LEGAL: Telefonnummer ergaenzen, falls erforderlich."] },
      { heading: "Registereintrag", paragraphs: [operator.register, `Umsatzsteuer-Identifikationsnummer: ${operator.vatId}`] },
      { heading: "Hinweis", paragraphs: [
        "TODO_LEGAL: Die Pflichtangaben richten sich nach dem Sitz des Anbieters (z. B. Digitale-Dienste-Gesetz in Deutschland). Vor Veroeffentlichung durch eine qualifizierte Rechtsberatung pruefen lassen.",
      ] },
    ],
  },
  {
    slug: "verantwortungsvolles-spielen",
    title: "Verantwortungsvolles Spielen",
    description: "Aurora Casino ist Unterhaltung. Hinweise, Werkzeuge und Hilfsangebote.",
    updatedAt: lastUpdated,
    intro: "Aurora Casino ist ein Spiel — kein Weg, Geld zu gewinnen. Wir moechten, dass es Unterhaltung bleibt.",
    sections: [
      { heading: "Was dieses Spiel ist — und was nicht", paragraphs: [
        "Alle Einsaetze und Gewinne bestehen aus virtuellem Spielgeld ohne Geldwert. Eine Auszahlung ist technisch und rechtlich ausgeschlossen.",
        "Erfolg in einem sozialen Casinospiel sagt nichts ueber Erfolg bei echtem Gluecksspiel aus. Die Wahrscheinlichkeiten unterscheiden sich, und echtes Gluecksspiel ist mit finanziellen Risiken verbunden.",
      ] },
      { heading: "Behalte die Kontrolle", paragraphs: [
        "Setze dir feste Zeiten fuer das Spielen und lege regelmaessig Pausen ein.",
        "Spiele nicht, um schlechte Stimmung zu verdraengen, und nicht, um Verluste im Spiel auszugleichen.",
        "Kaeufe virtueller Guthaben sind freiwillig. Gib nur Geld aus, das du fuer Unterhaltung entbehren kannst.",
        "Du kannst dein Konto jederzeit loeschen: Konto → Deine Daten → Konto loeschen.",
      ] },
      { heading: "Anzeichen fuer problematisches Verhalten", paragraphs: [
        "Du spielst laenger als geplant oder denkst haeufig ans Spielen.",
        "Du gibst mehr Geld aus, als du dir vorgenommen hast, oder verheimlichst deine Ausgaben.",
        "Das Spielen beeintraechtigt Schlaf, Arbeit, Ausbildung oder Beziehungen.",
      ] },
      { heading: "Wo es Hilfe gibt", paragraphs: [
        "Deutschland: Bundeszentrale fuer gesundheitliche Aufklaerung, Beratungstelefon zur Gluecksspielsucht 0800 1 37 27 00 (kostenfrei, anonym) sowie check-dein-spiel.de.",
        "Oesterreich: Spielsuchthilfe, spielsuchthilfe.at. Schweiz: sos-spielsucht.ch.",
        "Wenn du dir Sorgen um dich oder eine nahestehende Person machst, sprich mit einer Beratungsstelle oder deiner Aerztin bzw. deinem Arzt.",
      ] },
      { heading: "Jugendschutz", paragraphs: [
        "Das Angebot ist ab 18 Jahren. Wenn Kinder Zugriff auf dein Geraet haben, richte Geraetesperren und Kaufbeschraenkungen ein (iOS: Bildschirmzeit; Android: Google Play Elternaufsicht).",
      ] },
    ],
  },
] as const;

export function findLegalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments.find((document) => document.slug === slug);
}
