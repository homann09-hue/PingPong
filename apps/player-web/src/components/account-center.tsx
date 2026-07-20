"use client";

import { useCallback, useEffect, useState } from "react";
import { AppleLogo } from "@phosphor-icons/react/dist/csr/AppleLogo";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CloudArrowUp } from "@phosphor-icons/react/dist/csr/CloudArrowUp";
import { DeviceMobile } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { GoogleLogo } from "@phosphor-icons/react/dist/csr/GoogleLogo";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { AppShell } from "./app-shell";
import { usePlayer } from "@/hooks/use-player";
import { createSupabaseBrowserClient, isSupabaseAuthConfigured } from "@/lib/supabase/browser";

type Provider = "apple" | "google" | "email";
interface Account { playerId: string; status: string; createdAt: string; providers: string[]; isGuest: boolean; cloudSaveVersion: number }
interface Session { id: string; deviceId: string; platform: string; createdAt: string; lastUsedAt: string; expiresAt: string }
interface Device { id: string; platform: string; createdAt: string; lastSeenAt: string; activeSessions: number }
interface CloudSave { version: number; updatedAt: string; data: Record<string, unknown> }

const oauthErrorMessages: Readonly<Record<string, string>> = {
  missing_code: "Der Login wurde abgebrochen, bevor er abgeschlossen war. Bitte versuch es noch einmal.",
  oauth_failed: "Der Login konnte nicht bestätigt werden. Bitte versuch es noch einmal.",
  auth_unavailable: "Der Login-Dienst ist gerade nicht erreichbar. Bitte versuch es später erneut.",
};

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null) as { code?: string } | null)?.code ?? "REQUEST_FAILED");
  return response.json() as Promise<T>;
}

export function AccountCenter() {
  const { profile } = usePlayer();
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [cloudSave, setCloudSave] = useState<CloudSave | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const supabaseReady = isSupabaseAuthConfigured();

  const load = useCallback(async () => {
    const [accountResult, sessionsResult, devicesResult, saveResult] = await Promise.all([
      jsonRequest<{ account: Account }>("/api/player/auth/account"),
      jsonRequest<{ sessions: Session[] }>("/api/player/auth/sessions"),
      jsonRequest<{ devices: Device[] }>("/api/player/auth/devices"),
      jsonRequest<{ cloudSave: CloudSave }>("/api/player/auth/cloud-save"),
    ]);
    setAccount(accountResult.account); setSessions(sessionsResult.sessions); setDevices(devicesResult.devices); setCloudSave(saveResult.cloudSave);
  }, []);

  const exchange = useCallback(async (provider: Provider, accessToken: string) => {
    await jsonRequest("/api/account", { method: "POST", body: JSON.stringify({ action: "exchange", provider, providerAccessToken: accessToken }) });
    setNotice({ tone: "good", text: "Konto verbunden. Dein Fortschritt ist jetzt auf allen Geraeten geschuetzt." });
    await load();
  }, [load]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setRecovering(query.get("recovery") === "1");
    const oauthError = query.get("error");
    if (oauthError) {
      setNotice({ tone: "bad", text: oauthErrorMessages[oauthError] ?? "Der Login ist fehlgeschlagen. Bitte versuch es noch einmal." });
      window.history.replaceState({}, "", "/account");
    }
    void load().catch(() => setNotice({ tone: "bad", text: "Der Konto-Dienst ist gerade nicht erreichbar." }));
  }, [load]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connected") !== "1") return;
    void (async () => {
      try {
        setBusy("oauth");
        const { data } = await createSupabaseBrowserClient().auth.getSession();
        const provider = data.session?.user.app_metadata.provider as Provider | undefined;
        if (!data.session || !["apple", "google", "email"].includes(String(provider))) throw new Error("OAUTH_SESSION_MISSING");
        await exchange(provider!, data.session.access_token);
        window.history.replaceState({}, "", "/account");
      } catch { setNotice({ tone: "bad", text: "Der Login konnte nicht abgeschlossen werden. Bitte versuch es noch einmal." }); }
      finally { setBusy(null); }
    })();
  }, [exchange]);

  async function oauth(provider: "apple" | "google") {
    if (!supabaseReady) return setNotice({ tone: "bad", text: "Supabase Auth ist fuer diesen Build nicht konfiguriert." });
    setBusy(provider); setNotice(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({ provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch { setBusy(null); setNotice({ tone: "bad", text: `Der Login mit ${provider === "apple" ? "Apple" : "Google"} ist gerade nicht verfuegbar.` }); }
  }

  async function emailAction(action: "signin" | "signup" | "reset") {
    if (!supabaseReady) return setNotice({ tone: "bad", text: "Supabase Auth ist fuer diesen Build nicht konfiguriert." });
    setBusy(action); setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (action === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account?recovery=1")}` });
        if (error) throw error;
        setNotice({ tone: "good", text: "Link zum Zuruecksetzen verschickt. Schau in dein Postfach." });
      } else {
        const result = action === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (result.error) throw result.error;
        if (result.data.session) await exchange("email", result.data.session.access_token);
        else setNotice({ tone: "good", text: "Bestaetige die E-Mail, die wir dir geschickt haben, und komm dann hierher zurueck." });
      }
    } catch { setNotice({ tone: "bad", text: "E-Mail oder Passwort wurde abgelehnt. Pruefe die Angaben und versuch es erneut." }); }
    finally { setBusy(null); }
  }

  async function changePassword() {
    setBusy("password");
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
    setBusy(null); setNotice(error ? { tone: "bad", text: "Das Passwort konnte nicht geaendert werden." } : { tone: "good", text: "Passwort aktualisiert." });
  }

  async function syncCloud() {
    if (!cloudSave) return;
    setBusy("cloud");
    try {
      const result = await jsonRequest<{ cloudSave: CloudSave }>("/api/player/auth/cloud-save", { method: "PUT",
        body: JSON.stringify({ expectedVersion: cloudSave.version, data: { ...cloudSave.data, locale: navigator.language,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, lastWebSyncAt: new Date().toISOString() } }) });
      setCloudSave(result.cloudSave); setNotice({ tone: "good", text: "Cloud Save ist auf allen Geraeten aktuell." });
    } catch (error) { setNotice({ tone: "bad", text: error instanceof Error && error.message === "CLOUD_SAVE_VERSION_CONFLICT" ? "Es gibt neuere Cloud-Daten. Lade die Seite neu, bevor du synchronisierst." : "Die Cloud-Synchronisierung ist fehlgeschlagen." }); }
    finally { setBusy(null); }
  }

  async function revokeSession(id: string) {
    await fetch(`/api/player/auth/sessions/${id}`, { method: "DELETE" });
    setSessions((current) => current.filter((session) => session.id !== id));
  }

  async function accountAction(action: "logout" | "logoutAll" | "delete") {
    if (action === "delete" && !window.confirm("Dieses Konto endgueltig loeschen und alle Sitzungen beenden? Das kann nicht rueckgaengig gemacht werden.")) return;
    setBusy(action);
    const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!response.ok) {
      setBusy(null);
      setNotice({ tone: "bad", text: "Die Konto-Aktion ist fehlgeschlagen. Bitte versuch es erneut." });
      return;
    }
    if (supabaseReady) await createSupabaseBrowserClient().auth.signOut().catch(() => undefined);
    window.location.assign("/");
  }

  async function downloadExport() {
    const response = await fetch("/api/player/auth/privacy-export");
    if (!response.ok) return setNotice({ tone: "bad", text: "Der Datenexport ist fehlgeschlagen." });
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `aurora-daten-${account?.playerId ?? "konto"}.json`; link.click(); URL.revokeObjectURL(url);
  }

  const providers = new Set(account?.providers ?? []);
  return <AppShell profile={profile}>
    <section className="account-hero"><div><span className="eyebrow"><LockKey weight="fill" /> Kontoschutz</span><h1>Dein Aurora-Konto</h1><p>Eine sichere Identitaet, jedes Geraet, alle Welten und Belohnungen.</p></div>
      <div className={account?.isGuest ? "account-state guest" : "account-state protected"}>{account?.isGuest ? <WarningCircle weight="fill" /> : <CheckCircle weight="fill" />}<span><small>{account?.isGuest ? "Gastkonto" : "Cloud-geschuetzt"}</small><strong>{account?.isGuest ? "Jetzt verknuepfen und Fortschritt sichern" : "Dein Fortschritt begleitet dich ueberall"}</strong></span></div></section>
    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}

    <div className="account-grid">
      <section className="account-card account-connect"><header><div><span className="account-kicker">Login & Wiederherstellung</span><h2>Verbundene Identitaeten</h2></div><span>{providers.size} verknuepft</span></header>
        {!supabaseReady && <div className="account-config-warning">Hinterlege die Supabase-Auth-Umgebungsvariablen, um Apple-, Google- und E-Mail-Login zu aktivieren.</div>}
        <div className="provider-row"><button onClick={() => void oauth("apple")} disabled={!supabaseReady || busy !== null || providers.has("apple")}><AppleLogo weight="fill" />{providers.has("apple") ? "Apple verbunden" : "Mit Apple fortfahren"}</button>
          <button onClick={() => void oauth("google")} disabled={!supabaseReady || busy !== null || providers.has("google")}><GoogleLogo weight="bold" />{providers.has("google") ? "Google verbunden" : "Mit Google fortfahren"}</button></div>
        <div className="email-login"><label><span>E-Mail</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="du@beispiel.de" /></label>
          <label><span>Passwort</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" /></label>
          <div><button className="primary-action" onClick={() => void emailAction("signin")} disabled={!supabaseReady || !email || !password || busy !== null}><EnvelopeSimple weight="bold" /> Anmelden</button><button onClick={() => void emailAction("signup")} disabled={!supabaseReady || !email || password.length < 8 || busy !== null}>Konto erstellen</button><button className="text-action" onClick={() => void emailAction("reset")} disabled={!supabaseReady || !email || busy !== null}>Passwort vergessen?</button></div></div>
        {recovering && <div className="password-reset"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Neues Passwort" /><button onClick={() => void changePassword()} disabled={newPassword.length < 8}>Neues Passwort setzen</button></div>}
      </section>

      <section className="account-card cloud-card"><header><div><span className="account-kicker">Geraeteuebergreifend</span><h2>Cloud Save</h2></div><CloudArrowUp weight="fill" /></header><div className="cloud-version"><strong>Version {cloudSave?.version ?? 0}</strong><span>{cloudSave?.version ? `Aktualisiert ${new Date(cloudSave.updatedAt).toLocaleString("de-DE")}` : "Bereit fuer die erste Synchronisierung"}</span></div><p>Coins, Gems, XP und Spielfortschritt sind immer server-autoritativ. Einstellungen nutzen konfliktsichere Versionierung.</p><button className="primary-action" onClick={() => void syncCloud()} disabled={busy !== null}><CloudArrowUp weight="bold" /> {busy === "cloud" ? "Synchronisiert …" : "Dieses Geraet synchronisieren"}</button></section>

      <section className="account-card device-card"><header><div><span className="account-kicker">Sicherheit</span><h2>Geraete & Sitzungen</h2></div><span>{devices.length} Geraete</span></header><div className="device-list">{sessions.map((session) => <article key={session.id}><DeviceMobile weight="fill" /><div><strong>{session.platform === "web" ? "Webbrowser" : session.platform === "ios" ? "iPhone / iPad" : "Android-Geraet"}</strong><span>Aktiv {new Date(session.lastUsedAt).toLocaleString("de-DE")} · laeuft ab {new Date(session.expiresAt).toLocaleDateString("de-DE")}</span></div><button onClick={() => void revokeSession(session.id)}>Abmelden</button></article>)}</div><button className="danger-outline" onClick={() => void accountAction("logoutAll")}><SignOut weight="bold" /> Auf allen Geraeten abmelden</button></section>

      <section className="account-card privacy-card"><header><div><span className="account-kicker">Datenschutz</span><h2>Deine Daten</h2></div></header><button onClick={() => void downloadExport()}><DownloadSimple weight="bold" /><span><strong>Datenexport herunterladen</strong><small>Konto, Wallet-Verlauf, Sitzungen und Spielaktivitaet als JSON</small></span></button><button className="delete-account" onClick={() => void accountAction("delete")}><Trash weight="bold" /><span><strong>Konto loeschen</strong><small>Entfernt den Zugang endgueltig und meldet alle Geraete ab</small></span></button><button className="text-action logout-current" onClick={() => void accountAction("logout")}><SignOut /> Auf diesem Geraet abmelden</button></section>
    </div>
  </AppShell>;
}
