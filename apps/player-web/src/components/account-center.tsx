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
    setNotice({ tone: "good", text: "Account connected. Your progress is now protected across devices." });
    await load();
  }, [load]);

  useEffect(() => { setRecovering(new URLSearchParams(window.location.search).get("recovery") === "1"); void load().catch(() => setNotice({ tone: "bad", text: "Account service is temporarily unavailable." })); }, [load]);
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
      } catch { setNotice({ tone: "bad", text: "The login could not be completed. Please try again." }); }
      finally { setBusy(null); }
    })();
  }, [exchange]);

  async function oauth(provider: "apple" | "google") {
    if (!supabaseReady) return setNotice({ tone: "bad", text: "Supabase Auth is not configured for this build." });
    setBusy(provider); setNotice(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({ provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch { setBusy(null); setNotice({ tone: "bad", text: `${provider === "apple" ? "Apple" : "Google"} login is not available yet.` }); }
  }

  async function emailAction(action: "signin" | "signup" | "reset") {
    if (!supabaseReady) return setNotice({ tone: "bad", text: "Supabase Auth is not configured for this build." });
    setBusy(action); setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (action === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account?recovery=1")}` });
        if (error) throw error;
        setNotice({ tone: "good", text: "Password reset link sent. Check your inbox." });
      } else {
        const result = action === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (result.error) throw result.error;
        if (result.data.session) await exchange("email", result.data.session.access_token);
        else setNotice({ tone: "good", text: "Confirm the email we sent you, then return here to finish linking." });
      }
    } catch { setNotice({ tone: "bad", text: "Email or password was rejected. Check the details and try again." }); }
    finally { setBusy(null); }
  }

  async function changePassword() {
    setBusy("password");
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
    setBusy(null); setNotice(error ? { tone: "bad", text: "Password could not be changed." } : { tone: "good", text: "Password updated." });
  }

  async function syncCloud() {
    if (!cloudSave) return;
    setBusy("cloud");
    try {
      const result = await jsonRequest<{ cloudSave: CloudSave }>("/api/player/auth/cloud-save", { method: "PUT",
        body: JSON.stringify({ expectedVersion: cloudSave.version, data: { ...cloudSave.data, locale: navigator.language,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, lastWebSyncAt: new Date().toISOString() } }) });
      setCloudSave(result.cloudSave); setNotice({ tone: "good", text: "Cloud Save is current on every device." });
    } catch (error) { setNotice({ tone: "bad", text: error instanceof Error && error.message === "CLOUD_SAVE_VERSION_CONFLICT" ? "Newer cloud data exists. Reload before syncing." : "Cloud sync failed." }); }
    finally { setBusy(null); }
  }

  async function revokeSession(id: string) {
    await fetch(`/api/player/auth/sessions/${id}`, { method: "DELETE" });
    setSessions((current) => current.filter((session) => session.id !== id));
  }

  async function accountAction(action: "logout" | "logoutAll" | "delete") {
    if (action === "delete" && !window.confirm("Permanently delete this account and revoke every session? This cannot be undone.")) return;
    setBusy(action);
    const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!response.ok) {
      setBusy(null);
      setNotice({ tone: "bad", text: "Account action failed. Please try again." });
      return;
    }
    if (supabaseReady) await createSupabaseBrowserClient().auth.signOut().catch(() => undefined);
    window.location.assign("/");
  }

  async function downloadExport() {
    const response = await fetch("/api/player/auth/privacy-export");
    if (!response.ok) return setNotice({ tone: "bad", text: "Data export failed." });
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `aurora-data-${account?.playerId ?? "account"}.json`; link.click(); URL.revokeObjectURL(url);
  }

  const providers = new Set(account?.providers ?? []);
  return <AppShell profile={profile}>
    <section className="account-hero"><div><span className="eyebrow"><LockKey weight="fill" /> Account protection</span><h1>Your Aurora account</h1><p>One secure identity, every device, all worlds and rewards.</p></div>
      <div className={account?.isGuest ? "account-state guest" : "account-state protected"}>{account?.isGuest ? <WarningCircle weight="fill" /> : <CheckCircle weight="fill" />}<span><small>{account?.isGuest ? "Guest account" : "Cloud protected"}</small><strong>{account?.isGuest ? "Link now to protect progress" : "Progress follows you everywhere"}</strong></span></div></section>
    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}

    <div className="account-grid">
      <section className="account-card account-connect"><header><div><span className="account-kicker">Login & recovery</span><h2>Connected identities</h2></div><span>{providers.size} linked</span></header>
        {!supabaseReady && <div className="account-config-warning">Connect Supabase Auth env vars to enable Apple, Google and email login.</div>}
        <div className="provider-row"><button onClick={() => void oauth("apple")} disabled={!supabaseReady || busy !== null || providers.has("apple")}><AppleLogo weight="fill" />{providers.has("apple") ? "Apple connected" : "Continue with Apple"}</button>
          <button onClick={() => void oauth("google")} disabled={!supabaseReady || busy !== null || providers.has("google")}><GoogleLogo weight="bold" />{providers.has("google") ? "Google connected" : "Continue with Google"}</button></div>
        <div className="email-login"><label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          <div><button className="primary-action" onClick={() => void emailAction("signin")} disabled={!supabaseReady || !email || !password || busy !== null}><EnvelopeSimple weight="bold" /> Sign in</button><button onClick={() => void emailAction("signup")} disabled={!supabaseReady || !email || password.length < 8 || busy !== null}>Create account</button><button className="text-action" onClick={() => void emailAction("reset")} disabled={!supabaseReady || !email || busy !== null}>Forgot password?</button></div></div>
        {recovering && <div className="password-reset"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" /><button onClick={() => void changePassword()} disabled={newPassword.length < 8}>Set new password</button></div>}
      </section>

      <section className="account-card cloud-card"><header><div><span className="account-kicker">Cross-device state</span><h2>Cloud Save</h2></div><CloudArrowUp weight="fill" /></header><div className="cloud-version"><strong>Version {cloudSave?.version ?? 0}</strong><span>{cloudSave?.version ? `Updated ${new Date(cloudSave.updatedAt).toLocaleString()}` : "Ready for first sync"}</span></div><p>Coins, gems, XP and gameplay progress are always server-authoritative. Preferences use conflict-safe versioning.</p><button className="primary-action" onClick={() => void syncCloud()} disabled={busy !== null}><CloudArrowUp weight="bold" /> {busy === "cloud" ? "Syncing…" : "Sync this device"}</button></section>

      <section className="account-card device-card"><header><div><span className="account-kicker">Security</span><h2>Devices & sessions</h2></div><span>{devices.length} devices</span></header><div className="device-list">{sessions.map((session) => <article key={session.id}><DeviceMobile weight="fill" /><div><strong>{session.platform === "web" ? "Web browser" : session.platform === "ios" ? "iPhone / iPad" : "Android device"}</strong><span>Active {new Date(session.lastUsedAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleDateString()}</span></div><button onClick={() => void revokeSession(session.id)}>Sign out</button></article>)}</div><button className="danger-outline" onClick={() => void accountAction("logoutAll")}><SignOut weight="bold" /> Log out on all devices</button></section>

      <section className="account-card privacy-card"><header><div><span className="account-kicker">Privacy controls</span><h2>Your data</h2></div></header><button onClick={() => void downloadExport()}><DownloadSimple weight="bold" /><span><strong>Download data export</strong><small>Account, wallet history, sessions and game activity as JSON</small></span></button><button className="delete-account" onClick={() => void accountAction("delete")}><Trash weight="bold" /><span><strong>Delete account</strong><small>Permanently removes access and revokes every device</small></span></button><button className="text-action logout-current" onClick={() => void accountAction("logout")}><SignOut /> Log out on this device</button></section>
    </div>
  </AppShell>;
}
