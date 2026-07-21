# iOS und Android via Capacitor

Stand: 21.07.2026

## Warum die Web-App und nicht Flutter

Frueher lautete die Empfehlung: Flutter bleibt die Store-App. Das war zu dem
Zeitpunkt richtig — die Web-App hatte einen spielbaren Slot und viele tote
Schaltflaechen.

Inzwischen steckt die **gesamte** Funktionalitaet in der Web-App: Boost-Center,
Shop, Gluecksrad, alle acht Slots, Walzenanimation, Gewinn-Inszenierung,
Jackpot-Leiter, Slot-Verfuegbarkeit, Event-Meilensteine. Die Flutter-App hat
nichts davon. Sie zur Store-App zu machen hiesse, all das ein zweites Mal zu
bauen und kuenftig jede Funktion doppelt zu pflegen.

## Das Kernproblem: die App ist kein statischer Export

`apps/player-web` laeuft als `output: "standalone"`, also als Node-Server.
Das ist keine Nebensache, sondern der Angelpunkt der ganzen Architektur:

Das **Player-BFF** unter `/api/player/[...path]` ist serverseitig. Es haelt die
Zugangsdaten in httpOnly-Cookies, haengt den Bearer-Token an und laesst nur
Pfade aus der Allowlist durch. Genau deshalb sieht Browser-JavaScript die
Token nie.

Capacitor buendelt **statische Dateien**. Ein `next export` wuerde das BFF
ersatzlos entfernen — und mit ihm den Grund, warum die Anmeldung sicher ist.

## Zwei Stufen

### Stufe 1 — jetzt: native Huelle auf die gehostete App

`AURORA_MOBILE_SERVER_URL` zeigt auf die gehostete Web-App. Die native Huelle
laedt sie; BFF, Cookies und Sitzungen funktionieren unveraendert.

**Dafuer:** schnellster Weg zu einem Geraetebuild und zu TestFlight. Keine
Aenderung an der Anmeldung noetig. Aktualisierungen ohne Store-Review.

**Dagegen, und das ist ernst zu nehmen:** die App ist damit im Kern eine
Webansicht. Apple lehnt so etwas nach Richtlinie 4.2 ("Minimum Functionality")
regelmaessig ab. Ausserdem braucht die App durchgehend Netz und startet
langsamer als eine gebuendelte.

Fuer interne Tests und TestFlight ist das tragbar. **Fuer die oeffentliche
Veroeffentlichung ist es das nicht.**

### Stufe 2 — vor Veroeffentlichung: eigenstaendige App

Die Oberflaeche wird gebuendelt ausgeliefert, die App spricht direkt mit der
API. Dafuer muss die Anmeldung umziehen:

- Token nicht mehr in httpOnly-Cookies, sondern im **sicheren nativen Speicher**
  (Keychain auf iOS, Keystore auf Android).
- Grund: eine Capacitor-Webansicht laeuft unter `capacitor://localhost`. Cookies
  zur API-Domain waeren Drittanbieter-Cookies und werden von ITP blockiert —
  die heutige Cookie-Anmeldung funktioniert dort schlicht nicht.
- Die Allowlist-Logik des BFF wandert in einen duennen Client-Adapter. Sie
  bleibt sinnvoll als Selbstbeschraenkung, ist aber keine Sicherheitsgrenze
  mehr — die liegt dann vollstaendig in der API. Das ist vertretbar, weil die
  API ohnehin jede Anfrage authentifiziert und autorisiert.

Aufwand: schaetzungsweise mehrere Tage, kein Nachmittag. Es ist der Punkt, an
dem die Store-Reife tatsaechlich entschieden wird.

## Einrichtung (Stufe 1)

Die Befehle muessen auf einem Rechner mit npm-Zugang laufen.

```bash
cd ~/Documents/GitHub/PingPong/apps/player-web

npm install --save @capacitor/core @capacitor/ios @capacitor/android \
  @capacitor/splash-screen @capacitor/status-bar @capacitor/haptics \
  @capacitor/app @capacitor/network
npm install --save-dev @capacitor/cli

# Zielsystem eintragen, sonst startet die Huelle ins Leere
export AURORA_MOBILE_SERVER_URL="https://aurora-player-web.vercel.app"

npx cap add ios
npx cap add android
npx cap sync
```

Danach:

```bash
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

## Was danach noch fehlt

| Punkt | Warum er nicht warten kann |
|---|---|
| App-Icons und Splash in allen Groessen | Ohne sie kein Store-Upload |
| Signierung, Bundle-Kennung, Provisioning | Braucht deinen Apple-Developer-Zugang |
| In-App-Kaeufe (StoreKit / Play Billing) | Der Shop tauscht heute nur Gems gegen Coins — echte Kaeufe fehlen |
| Rewarded Ads | Belohnung erst nach bestaetigtem Completion-Callback, serverseitig geprueft |
| Push-Berechtigung | Die Messaging-Routen sind freigeschaltet, die native Seite fehlt |
| Datenschutzangaben | App Privacy bei Apple, Data Safety bei Google |
| Altersfreigabe | Social Casino: 18+, in mehreren Maerkten gesondert geregelt |

**Rechtlicher Hinweis:** Die Einstufung als Social Casino, die Altersfreigabe
und die Gluecksspiel-Abgrenzung muessen vor Veroeffentlichung von einem
qualifizierten Rechtsberater geprueft werden. Die Punkte in
`docs/legal-compliance.md` sind dafuer die Grundlage, ersetzen die Pruefung
aber nicht.
