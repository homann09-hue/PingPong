import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor-Konfiguration fuer iOS und Android.
 *
 * Wichtiger Hintergrund: die Web-App laeuft als `output: "standalone"`, also
 * als Node-Server. Das Player-BFF unter /api/player/[...path] ist serverseitig
 * und haelt die httpOnly-Cookies mit den Zugangsdaten. Ein statischer Export
 * wuerde genau diese Schicht ersatzlos entfernen.
 *
 * Deshalb zwei Stufen (ausfuehrlich in docs/mobile-capacitor.md):
 *
 * Stufe 1 — jetzt: AURORA_MOBILE_SERVER_URL zeigt auf die gehostete Web-App.
 *   Die native Huelle laedt sie, BFF und Sitzungen funktionieren unveraendert.
 *   Das ist der schnelle Weg zu einem Geraetebuild und zu TestFlight.
 *
 * Stufe 2 — vor Veroeffentlichung: Anmeldung von httpOnly-Cookies auf sicheren
 *   nativen Speicher umstellen, damit die App eigenstaendig ausgeliefert werden
 *   kann. Ohne das ist die App eine reine Webansicht — mit dem bekannten
 *   Ablehnungsrisiko nach Apple-Richtlinie 4.2.
 */

const serverUrl = process.env.AURORA_MOBILE_SERVER_URL;

const config: CapacitorConfig = {
  // Gleiche Kennung wie die bisherige Flutter-App: die Store-Eintraege und das
  // Deep-Link-Schema com.aurora.socialcasino:// bleiben damit nutzbar.
  appId: "com.aurora.socialcasino",
  appName: "Aurora Casino",

  // Wird in Stufe 1 nicht verwendet (server.url hat Vorrang), muss aber gesetzt
  // sein. In Stufe 2 landet hier der statische Export.
  webDir: "public",

  server: {
    androidScheme: "https",
    // Nur gesetzt, wenn die Variable vorhanden ist — sonst wuerde ein leerer
    // Wert den Start der App verhindern.
    ...(serverUrl ? { url: serverUrl, cleartext: false } : {}),
  },

  ios: {
    // Der Inhalt reicht bis unter Notch und Home-Indikator; die Abstaende
    // regelt mobile.css ueber env(safe-area-inset-*). Doppelte Abstaende
    // sonst die Folge.
    contentInset: "never",
    backgroundColor: "#120b2b",
  },

  android: {
    backgroundColor: "#120b2b",
    // Kein Debug-Zugriff in Auslieferungsbuilds.
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#120b2bff",
      showSpinner: false,
      // Nicht automatisch ausblenden: die App blendet selbst aus, sobald die
      // Lobby steht. Sonst blitzt kurz eine leere Seite auf.
      launchAutoHide: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#120b2b",
      overlaysWebView: true,
    },
  },
};

export default config;
