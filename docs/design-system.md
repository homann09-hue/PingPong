# Aurora Casino — Designsystem

Dieses Dokument beschreibt die **einheitliche visuelle Identität** von Aurora Casino
(Abschnitt 6 des Produkt-Briefs). Es dokumentiert das *bereits vorhandene* Token-System —
es erfindet keine neuen Werte, sondern hält die tatsächliche Quelle der Wahrheit fest.

> Repo-Pfad: `docs/design-system.md` · Token-Quelle: `packages/design-tokens/src/tokens.css`
> (`@aurora/design-tokens`) · zuerst importiert in `apps/player-web/src/app/layout.tsx`,
> damit die Variablen in jeder Komponente verfügbar sind.

---

## 1. Grundprinzip: eine Quelle der Wahrheit

Alle Marken-Werte leben als CSS-Custom-Properties im Paket **`@aurora/design-tokens`**.
Die Benennung folgt strikt dem Schema:

```
--aurora-<kategorie>-<name>
```

Beispiele: `--aurora-color-gold`, `--aurora-space-4`, `--aurora-radius-md`.

**Regel:** Neuer oder überarbeiteter Code referenziert Tokens über `var(--aurora-…)`
statt roher Hex- oder px-Werte. Bestehende, historisch fest kodierte Werte in
`globals.css` u. a. werden schrittweise auf Tokens migriert (siehe §8).

---

## 2. Farb-Tokens

Die Kernidentität ist **Violett + Pink + Gold + Cyan auf tiefviolettem Canvas** —
ein Nacht-Vegas-Look, bewusst eigenständig (keine Marken-Nachbildung).

| Token | Wert | Rolle |
|---|---|---|
| `--aurora-color-ink` | `#f8f6ff` | Primäre Textfarbe (fast weiß) |
| `--aurora-color-muted` | `#aaa4c2` | Sekundärtext, Hinweise |
| `--aurora-color-canvas` | `#120b2b` | App-Hintergrund |
| `--aurora-color-canvas-deep` | `#070617` | Tiefster Hintergrund, Overlays |
| `--aurora-color-panel` | `#201247` | Panel-Fläche |
| `--aurora-color-panel-raised` | `#2a175c` | Erhöhtes Panel, Karten |
| `--aurora-color-panel-glass` | `rgb(23 13 53 / 86%)` | Glas-/Blur-Panels |
| `--aurora-color-purple` | `#7b43ff` | Primär-Marke |
| `--aurora-color-purple-bright` | `#a676ff` | Heller Verlaufspol, Fokus |
| `--aurora-color-pink` | `#ff4ccf` | Zweit-Marke, Akzente |
| `--aurora-color-gold` | `#ffc72c` | Gewinn, primäre Aktion, Coins |
| `--aurora-color-gold-soft` | `#ffe793` | Gold-Verlauf, Glanzlichter |
| `--aurora-color-cyan` | `#54e5ff` | Info, kühler Akzent |
| `--aurora-color-success` | `#64e8a4` | Erfolg, positives Feedback |
| `--aurora-color-danger` | `#ff6689` | Fehler, Warnung |

### Ränder & Schatten

| Token | Wert | Rolle |
|---|---|---|
| `--aurora-border-soft` | `rgb(255 255 255 / 12%)` | Dezente Trennlinien |
| `--aurora-border-gold` | `rgb(255 199 44 / 58%)` | Hervorgehobene, „premium" Ränder |
| `--aurora-shadow-panel` | `0 18px 52px rgb(4 2 17 / 44%)` | Panel-Tiefe |
| `--aurora-shadow-glow` | `0 0 30px rgb(123 67 255 / 32%)` | Violettes Leuchten (Fokus/Aktiv) |

---

## 3. Abstände (4px-Basis)

| Token | Wert | | Token | Wert |
|---|---|---|---|---|
| `--aurora-space-1` | `4px` | | `--aurora-space-6` | `24px` |
| `--aurora-space-2` | `8px` | | `--aurora-space-8` | `32px` |
| `--aurora-space-3` | `12px` | | `--aurora-space-10` | `40px` |
| `--aurora-space-4` | `16px` | | `--aurora-space-12` | `48px` |
| `--aurora-space-5` | `20px` | | | |

---

## 4. Radien

| Token | Wert | Rolle |
|---|---|---|
| `--aurora-radius-sm` | `10px` | Kleine Chips, Eingabefelder |
| `--aurora-radius-md` | `16px` | Karten, Panels, Buttons |
| `--aurora-radius-lg` | `24px` | Große Flächen, Modals |
| `--aurora-radius-pill` | `999px` | Pillen-Buttons, Badges, Fortschrittsbalken |

---

## 5. Bewegung & Barrierefreiheit

| Token | Wert | Rolle |
|---|---|---|
| `--aurora-motion-fast` | `140ms` | Hover, Tap-Feedback, kleine Übergänge |
| `--aurora-motion-normal` | `240ms` | Panel-/Modal-Übergänge |
| `--aurora-motion-reel` | `700ms` | Walzen-Dreh-Timing |
| `--aurora-ease-out` | `cubic-bezier(.22, 1, .36, 1)` | Standard-Ausklang |

**Barrierefreiheit:** Unter `@media (prefers-reduced-motion: reduce)` kollabieren die
Motion-Tokens auf `1ms` — Animationen laufen effektiv sofort durch, ohne die Logik zu
verändern. Neue Animationen (z. B. der Slot-Ladebildschirm) respektieren diese Regel.

---

## 6. Slot-Theming pro Spiel

Jeder Slot bringt seine eigenen zwei Leitfarben mit, die als Inline-Variablen auf die
`.slot-stage` gesetzt werden (`themeStyle` in `slot-game.tsx`):

```
--slot-primary   /* Grund-/Rahmenfarbe des jeweiligen Slots */
--slot-secondary /* Akzent-/Gewinnfarbe des jeweiligen Slots */
```

So teilt sich jeder Slot dasselbe Grundgerüst (Tokens oben), erhält aber eine eigene
Stimmung — ohne Duplikation von Layout-Code. Der Ladebildschirm, die Walzen-Rahmen und
die Gewinn-Inszenierung lesen diese beiden Slot-Variablen.

---

## 7. Bausteine (Abschnitt-6-Katalog)

Jeder Baustein wohnt in einer eigenen CSS-Datei unter `apps/player-web/src/app/`
und konsumiert die Tokens. Übersicht:

| Baustein | Datei(en) | Kernklassen / Hinweise |
|---|---|---|
| **Typografie** | `globals.css` | System-Schrift, Gewichte 400/600/800; Größen über `clamp()` für Mobile-Skalierung |
| **Buttons** | `fixes.css` | Pillen-Form (`--aurora-radius-pill`); Primär in Gold, Zustände Hover/Aktiv/Disabled; z. B. `.auto-button`, `.auto-button.running` |
| **Panels** | `globals.css`, `slot-theme.css` | `.slot-stage`, `.slot-header`; Glas-Panels über `--aurora-color-panel-glass` |
| **Karten** | `globals.css`, `shop.css` | Erhöhte Fläche `--aurora-color-panel-raised`, Radius `md`, Schatten `panel` |
| **Modals / Dialoge** | `globals.css` | Paytable-/Info-Dialog; Overlay `--aurora-color-canvas-deep`, Z-Ebene über Slot-Inhalt |
| **Badges** | `globals.css`, `arcade.css` | Pillen-Badges, Akzentfarben je Kontext (Gold/Cyan/Success) |
| **Fortschrittsanzeigen** | `jackpots.css`, `boost.css`, `slot-intro.css` | Pillen-Balken; Jackpot-Leiter `.jackpot-strip`; Ladebalken `.slot-intro-bar` |
| **Tooltips / Hinweise** | `globals.css` | Sekundärtext `--aurora-color-muted` |
| **Navigation / Lobby** | `globals.css`, `mobile.css` | Tippziele ≥ 44px (Apple-HIG), Safe-Area-aware |
| **Slot-Rahmen / Kabinett** | `reels.css`, `slot-theme.css` | Walzen-Kabinett, Tiefe, Dreh-Timing über `--aurora-motion-reel` |
| **Belohnungen** | `wheel.css`, `win.css` | Vollbild-Bonusrad; Gewinn-Inszenierung, Hochzähl-Animation |
| **Shop** | `shop.css` | Angebots-Karten, keine Platzhalter |
| **Events / Ambiente** | `slot-ambience.css` | Bewegter Slot-Hintergrund, atmosphärische Ebenen |
| **Wallet / Verlauf** | `wallet-history.css` | Ledger-Darstellung im Konto |
| **Clans / Sozial** | `clans-ui.css` | Mitglieds- und Nicht-Mitglieds-Zustand |
| **Ladebildschirm** | `slot-intro.css` | Themed Intro pro Slot, an echten Ladezustand gekoppelt (`!paytable`) |
| **Recht / Age-Gate** | `legal.css` | Age-Gate, Legal-Footer, Social-Casino-Hinweise |

---

## 8. Migrations-Stand (ehrlich)

- **Vorhanden & aktiv:** `@aurora/design-tokens` mit 36 Tokens, global importiert; alle
  oben genannten Bausteine sind implementiert und spielbar.
- **Offen:** In `globals.css` u. a. existieren noch historisch fest kodierte Farb- und
  Abstandswerte, die parallel zu den Tokens laufen. Sie funktionieren, sollten aber
  schrittweise auf `var(--aurora-…)` umgestellt werden, damit die Palette an genau einer
  Stelle änderbar bleibt. Das ist eine reine Aufräum-Aufgabe ohne Funktionsrisiko.

---

## 9. Regeln (Do / Don't)

**Do**
- Farbe, Abstand, Radius, Motion immer über `var(--aurora-…)` beziehen.
- Neue Slot-Stimmung ausschließlich über `--slot-primary` / `--slot-secondary` erzeugen.
- Jede Animation unter `prefers-reduced-motion` degradieren.

**Don't**
- Keine neuen rohen Hex-/px-Werte, wenn ein Token existiert.
- Keine geschützten Grafiken, Namen, Logos, Figuren, Sounds oder pixelgenauen Layouts
  fremder Apps übernehmen — die Identität bleibt eigenständig.
- Keine Marken-Verwechslung erzeugen.
