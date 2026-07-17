export const navigationGroups = [
  { label: "Übersicht", items: [{ id: "dashboard", label: "Dashboard", icon: "SquaresFour" }] },
  { label: "Content", items: [
    { id: "slots", label: "Slots", icon: "Cards" },
    { id: "remote-config", label: "Remote Config", icon: "SlidersHorizontal" },
    { id: "assets", label: "Assets", icon: "Images" },
  ] },
  { label: "LiveOps", items: [
    { id: "events", label: "Events", icon: "CalendarDots" },
    { id: "missions", label: "Missionen", icon: "Target" },
    { id: "tournaments", label: "Turniere & Ligen", icon: "Trophy" },
    { id: "experiments", label: "A/B Tests", icon: "Flask" },
  ] },
  { label: "Spieler & Social", items: [
    { id: "players", label: "Spieler", icon: "UsersThree" },
    { id: "clans", label: "Clans", icon: "ShieldChevron" },
    { id: "moderation", label: "Moderation", icon: "UserFocus" },
  ] },
  { label: "Engagement", items: [
    { id: "push", label: "Push Center", icon: "BellRinging" },
    { id: "inbox", label: "Inbox", icon: "EnvelopeSimple" },
  ] },
  { label: "Commerce", items: [
    { id: "shop", label: "Shop & Angebote", icon: "ShoppingBagOpen" },
    { id: "economy", label: "Spielökonomie", icon: "Coins" },
  ] },
  { label: "Analytics", items: [{ id: "analytics", label: "Berichte", icon: "ChartLineUp" }] },
  { label: "Plattform", items: [
    { id: "system", label: "Systemstatus", icon: "Pulse" },
    { id: "backups", label: "Backups", icon: "Database" },
  ] },
  { label: "Sicherheit", items: [
    { id: "audit", label: "Audit Log", icon: "FileSearch" },
    { id: "roles", label: "Berechtigungen", icon: "LockKey" },
  ] },
];

export const slots = [
  { id: "pharaoh-oasis", name: "Pharaoh Oasis", category: "Jackpot", status: "Veröffentlicht", version: "2.4.1", rtp: 96.18, volatility: "Hoch", maxWin: "5.000×", published: "17.07.2026 · 09:24", scheduled: "24.07. · 10:00", color: "#e4aa3a" },
  { id: "lucky-7-deluxe", name: "Lucky 7 Deluxe", category: "Classic", status: "Veröffentlicht", version: "2.1.0", rtp: 96.12, volatility: "Mittel", maxWin: "2.500×", published: "16.07.2026 · 16:45", scheduled: null, color: "#e34d3f" },
  { id: "pirates-legend", name: "Pirate's Legend", category: "Adventure", status: "Geplant", version: "1.0.0", rtp: 95.4, volatility: "Hoch", maxWin: "10.000×", published: "–", scheduled: "31.07. · 09:00", color: "#d77e22" },
  { id: "golden-oasis", name: "Golden Oasis", category: "Ways", status: "Veröffentlicht", version: "1.4.1", rtp: 96.05, volatility: "Niedrig", maxWin: "1.800×", published: "15.07.2026 · 11:12", scheduled: null, color: "#d3a11f" },
  { id: "mystic-wilds", name: "Mystic Wilds", category: "Cascades", status: "In Prüfung", version: "1.2.0", rtp: 95.88, volatility: "Mittel", maxWin: "7.500×", published: "–", scheduled: null, color: "#8269d8" },
  { id: "jungle-jackpot", name: "Jungle Jackpot", category: "Hold & Spin", status: "Veröffentlicht", version: "1.1.3", rtp: 96.44, volatility: "Hoch", maxWin: "12.500×", published: "14.07.2026 · 08:33", scheduled: null, color: "#5ca750" },
  { id: "diamond-strike", name: "Diamond Strike", category: "Megaways", status: "Entwurf", version: "0.8.1", rtp: 95.3, volatility: "Hoch", maxWin: "15.000×", published: "–", scheduled: "23.07. · 14:00", color: "#3597c8" },
  { id: "book-of-aurora", name: "Book of Aurora", category: "Free Spins", status: "Veröffentlicht", version: "2.0.2", rtp: 96.66, volatility: "Mittel", maxWin: "5.000×", published: "13.07.2026 · 19:05", scheduled: null, color: "#ad6e31" },
];

export const moduleCatalog = {
  events: { title: "Events", description: "Kampagnen, Zeitpläne, Zielgruppen und Belohnungen steuern.", metric: "12", metricLabel: "laufende Events", action: "Event erstellen" },
  missions: { title: "Missionen", description: "Tägliche, Pro-, Super- und Crazy-Missionen konfigurieren.", metric: "38", metricLabel: "aktive Missionen", action: "Mission bauen" },
  tournaments: { title: "Turniere & Ligen", description: "Regeln, Divisionen, Saisons und Belohnungspools verwalten.", metric: "7", metricLabel: "aktive Wettbewerbe", action: "Turnier erstellen" },
  experiments: { title: "A/B Tests", description: "Varianten sicher ausrollen und Ergebnisse auswerten.", metric: "5", metricLabel: "laufende Tests", action: "Experiment erstellen" },
  players: { title: "Spieler", description: "Profile, Wallets, Käufe, Geräte und Supportaktionen prüfen.", metric: "1,84 Mio.", metricLabel: "monatlich aktiv", action: "Spieler suchen" },
  clans: { title: "Clans", description: "Mitglieder, Punkte, Belohnungen und Ligen moderieren.", metric: "24.891", metricLabel: "aktive Clans", action: "Clan suchen" },
  moderation: { title: "Moderation", description: "Meldungen priorisieren und revisionssicher bearbeiten.", metric: "18", metricLabel: "offene Fälle", action: "Queue öffnen" },
  push: { title: "Push Center", description: "Zielgruppen, Zeitplanung und A/B Varianten für Push-Nachrichten.", metric: "6", metricLabel: "geplante Sends", action: "Push erstellen" },
  inbox: { title: "Inbox", description: "Nachrichten, Anhänge, Belohnungen und Ablaufzeiten verwalten.", metric: "9", metricLabel: "aktive Vorlagen", action: "Nachricht erstellen" },
  shop: { title: "Shop & Angebote", description: "Produkte, Bundles, Preise, Rabatte und Timer steuern.", metric: "42", metricLabel: "aktive Angebote", action: "Angebot erstellen" },
  economy: { title: "Spielökonomie", description: "Währungen, Quellen, Senken und Wallet-Freigaben überwachen.", metric: "8,42 Bio.", metricLabel: "Coins im Umlauf", action: "Ökonomie öffnen" },
  analytics: { title: "Analytics", description: "Retention, Käufe, Slots, Missionen und Events analysieren.", metric: "248.231", metricLabel: "DAU heute", action: "Bericht erstellen" },
  assets: { title: "Asset Library", description: "Grafiken, Sounds, Videos und Animationen versionieren.", metric: "18.420", metricLabel: "versionierte Assets", action: "Assets hochladen" },
  system: { title: "System", description: "Server, Cache, Cronjobs, Versionen und Wartungsmodus steuern.", metric: "99,99 %", metricLabel: "Verfügbarkeit", action: "System prüfen" },
  backups: { title: "Backups", description: "Backups, Wiederherstellung, Export und Import kontrollieren.", metric: "vor 18 Min.", metricLabel: "letztes Backup", action: "Backup erstellen" },
  audit: { title: "Audit Log", description: "Admin-, Wallet-, Security- und Konfigurationsänderungen prüfen.", metric: "1.284", metricLabel: "Aktionen heute", action: "Export erstellen" },
  roles: { title: "Berechtigungen", description: "Rollen, granulare Rechte, 2FA und IP-Listen verwalten.", metric: "46", metricLabel: "Workforce Accounts", action: "Rolle erstellen" },
};
