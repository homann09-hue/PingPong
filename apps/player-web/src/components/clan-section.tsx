"use client";

import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { useCallback, useEffect, useState } from "react";
import { coinNumber } from "@/lib/format";

/**
 * Clan-Oberflaeche. Bis hierher stand in der Lobby nur "Clans kommen ins Web" —
 * dabei war das Backend mit 13 Routen vollstaendig. Das war das letzte echte
 * UI-Loch aus dem BFF-Routenabgleich.
 *
 * Zwei Zustaende: Mitglied eines Clans (Mitglieder, Feed, Verlassen) oder noch
 * keiner (Einladungen annehmen, Clans entdecken und beitreten). Alle Daten fuer
 * den Einstieg liefert social/overview in einem Aufruf; der Feed wird nur bei
 * Mitgliedschaft nachgeladen.
 */

interface SocialPlayer { readonly id: string; readonly displayName: string; readonly level: number; readonly online: boolean }
interface ClanView { readonly id: string; readonly name: string; readonly tag: string; readonly memberCount: number; readonly memberLimit: number; readonly weeklyScore: number; readonly role?: "owner" | "officer" | "member" }
interface ClanInvitation { readonly id: string; readonly clan: ClanView }
interface Overview {
  readonly currentClan: ClanView | null;
  readonly discoverClans: readonly ClanView[];
  readonly incomingClanInvitations: readonly ClanInvitation[];
}
interface ClanMessage { readonly id: string; readonly author: SocialPlayer; readonly body: string | null; readonly status: "active" | "removed"; readonly createdAt: string }

const errorText: Readonly<Record<string, string>> = {
  SOCIAL_UNAVAILABLE: "Der soziale Dienst ist gerade nicht erreichbar.",
  CLAN_MEMBERSHIP_CONFLICT: "Das geht in deinem aktuellen Clan-Status nicht.",
  INVALID_REQUEST: "Diese Aktion ist gerade nicht moeglich.",
  RATE_LIMITED: "Kurz durchatmen und noch einmal versuchen.",
};

const roleLabel: Readonly<Record<string, string>> = { owner: "Leitung", officer: "Offizier", member: "Mitglied" };

function timeShort(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ClanSection({ onChanged }: Readonly<{ onChanged: () => void }>) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<readonly { player: SocialPlayer; role: string }[] | null>(null);
  const [feed, setFeed] = useState<readonly ClanMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const readJson = async <T,>(url: string): Promise<T | null> => {
    try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() as T : null; }
    catch { return null; }
  };

  const load = useCallback(async () => {
    const data = await readJson<Overview>("/api/player/social/overview");
    if (!data) { setFailed(true); return; }
    setFailed(false);
    setOverview(data);
    if (data.currentClan) {
      const [m, f] = await Promise.all([
        readJson<{ members: readonly { player: SocialPlayer; role: string }[] }>("/api/player/clans/members"),
        readJson<{ messages: readonly ClanMessage[] }>("/api/player/clans/feed?limit=30"),
      ]);
      setMembers(m?.members ?? []);
      setFeed(f?.messages ?? []);
    } else {
      setMembers(null); setFeed(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(key: string, url: string, ok: string, body?: unknown) {
    if (busy) return;
    setBusy(key); setNotice(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(body ?? {}),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null) as { code?: string } | null;
        setNotice({ tone: "bad", text: errorText[b?.code ?? ""] ?? "Das hat gerade nicht geklappt." });
        return;
      }
      setNotice({ tone: "good", text: ok });
      await load();
      onChanged();
    } catch {
      setNotice({ tone: "bad", text: "Verbindung unterbrochen." });
    } finally { setBusy(null); }
  }

  async function post() {
    const body = draft.trim();
    if (!body || busy) return;
    setDraft("");
    await act("post", "/api/player/clans/feed", "Gesendet.", { body });
  }

  const clan = overview?.currentClan ?? null;

  return <section className="lobby-section" id="clans" aria-labelledby="clans-title">
    <div className="section-heading">
      <div><span className="eyebrow"><UsersThree weight="fill" /> Gemeinsam gewinnen</span><h2 id="clans-title">Clans</h2></div>
    </div>

    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}
    {failed && <p className="section-empty">Der soziale Dienst ist gerade nicht erreichbar. <button className="link-button" onClick={() => void load()}>Erneut versuchen</button></p>}

    {!failed && overview === null && <p className="section-empty">Wird geladen …</p>}

    {clan && <div className="clan-home">
      <header className="clan-banner">
        <div className="clan-crest">{clan.tag}</div>
        <div className="clan-title">
          <strong>{clan.name}</strong>
          <small>{clan.memberCount} / {clan.memberLimit} Mitglieder · {coinNumber(clan.weeklyScore)} Punkte diese Woche</small>
        </div>
        <button className="claim-button ghost" disabled={busy !== null}
          onClick={() => void act("leave", "/api/player/clans/leave", "Clan verlassen.")}>
          {busy === "leave" ? "…" : "Verlassen"}
        </button>
      </header>

      <div className="clan-grid">
        <div className="clan-members">
          <h3 className="subheading">Mitglieder</h3>
          <ul>
            {members?.map(({ player, role }) => <li key={player.id}>
              <span className={player.online ? "member-dot online" : "member-dot"} aria-hidden="true" />
              <span className="member-name">{player.displayName}</span>
              <span className="member-meta">{role === "owner" && <Crown weight="fill" />} {roleLabel[role] ?? role} · Lvl {player.level}</span>
            </li>)}
          </ul>
        </div>

        <div className="clan-feed">
          <h3 className="subheading">Clan-Feed</h3>
          <div className="feed-compose">
            <input type="text" value={draft} maxLength={280} placeholder="Nachricht an den Clan …"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void post(); }} />
            <button className="claim-button" disabled={busy !== null || draft.trim().length === 0}
              onClick={() => void post()} aria-label="Senden"><PaperPlaneRight weight="fill" /></button>
          </div>
          <ul className="feed-list">
            {feed?.length === 0 && <li className="section-empty">Noch keine Nachrichten. Sag Hallo.</li>}
            {feed?.filter((m) => m.status === "active").map((m) => <li key={m.id}>
              <div className="feed-head"><strong>{m.author.displayName}</strong><small>{timeShort(m.createdAt)}</small></div>
              <p>{m.body}</p>
            </li>)}
          </ul>
        </div>
      </div>
    </div>}

    {overview && !clan && <div className="clan-discover">
      {overview.incomingClanInvitations.length > 0 && <div className="clan-invites">
        <h3 className="subheading">Einladungen</h3>
        {overview.incomingClanInvitations.map((inv) => <div className="clan-row" key={inv.id}>
          <span className="clan-crest small">{inv.clan.tag}</span>
          <span className="clan-row-main"><strong>{inv.clan.name}</strong><small>{inv.clan.memberCount} / {inv.clan.memberLimit}</small></span>
          <button className="claim-button" disabled={busy !== null}
            onClick={() => void act(inv.id, `/api/player/clans/invitations/${inv.id}/accept`, "Beigetreten.")}>
            {busy === inv.id ? "…" : "Annehmen"}
          </button>
        </div>)}
      </div>}

      <h3 className="subheading">Clans entdecken</h3>
      {overview.discoverClans.length === 0 && <p className="section-empty">Gerade keine offenen Clans. Schau spaeter wieder vorbei.</p>}
      {overview.discoverClans.map((c) => <div className="clan-row" key={c.id}>
        <span className="clan-crest small">{c.tag}</span>
        <span className="clan-row-main"><strong>{c.name}</strong><small>{c.memberCount} / {c.memberLimit} · {coinNumber(c.weeklyScore)} Pkt.</small></span>
        <button className="claim-button" disabled={busy !== null || c.memberCount >= c.memberLimit}
          onClick={() => void act(c.id, `/api/player/clans/${c.id}/join`, "Beigetreten.")}>
          {busy === c.id ? "…" : c.memberCount >= c.memberLimit ? "Voll" : "Beitreten"}
        </button>
      </div>)}
    </div>}

    <p className="clan-note">Clans sind rein sozial — gemeinsamer Fortschritt mit virtuellem Spielgeld, kein Echtgeld.</p>
  </section>;
}
