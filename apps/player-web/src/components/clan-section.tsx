"use client";

import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { useCallback, useEffect, useState } from "react";
import { coinNumber } from "@/lib/format";

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
  INVALID_REQUEST: "Diese Aktion ist gerade nicht möglich.",
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
    try {
      const response = await fetch(url, { cache: "no-store" });
      return response.ok ? await response.json() as T : null;
    } catch {
      return null;
    }
  };

  const load = useCallback(async () => {
    const data = await readJson<Overview>("/api/player/social/overview");
    if (!data) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setOverview(data);
    if (data.currentClan) {
      const [memberBody, feedBody] = await Promise.all([
        readJson<{ members: readonly { player: SocialPlayer; role: string }[] }>("/api/player/clans/members"),
        readJson<{ messages: readonly ClanMessage[] }>("/api/player/clans/feed?limit=30"),
      ]);
      setMembers(memberBody?.members ?? []);
      setFeed(feedBody?.messages ?? []);
    } else {
      setMembers(null);
      setFeed(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(key: string, url: string, ok: string, body?: unknown) {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null) as { code?: string } | null;
        setNotice({ tone: "bad", text: errorText[responseBody?.code ?? ""] ?? "Das hat gerade nicht geklappt." });
        return;
      }
      setNotice({ tone: "good", text: ok });
      await load();
      onChanged();
    } catch {
      setNotice({ tone: "bad", text: "Verbindung unterbrochen." });
    } finally {
      setBusy(null);
    }
  }

  async function post() {
    const body = draft.trim();
    if (!body || busy) return;
    setDraft("");
    await act("post", "/api/player/clans/feed", "Gesendet.", { body });
  }

  const clan = overview?.currentClan ?? null;

  return <section className="fl-system-section fl-clan-system" id="clans" aria-labelledby="clans-title">
    <header className="fl-system-heading">
      <div><span><UsersThree weight="fill" /> Social</span><h2 id="clans-title">Friends &amp; Clans</h2></div>
      <strong>PLAY TOGETHER</strong>
    </header>

    {notice && <div className={`account-notice ${notice.tone}`} role="status">{notice.text}</div>}
    {failed && <p className="section-empty">Der soziale Dienst ist gerade nicht erreichbar. <button className="link-button" onClick={() => void load()}>Erneut versuchen</button></p>}
    {!failed && overview === null && <p className="section-empty">Wird geladen …</p>}

    {clan && <div className="clan-home fl-clan-home">
      <header className="clan-banner fl-clan-banner">
        <div className="clan-crest fl-clan-crest"><Crown weight="fill" /><strong>{clan.tag}</strong></div>
        <div className="clan-title">
          <small>YOUR CLAN</small>
          <strong>{clan.name}</strong>
          <span>{clan.memberCount} / {clan.memberLimit} Mitglieder · {coinNumber(clan.weeklyScore)} Wochenpunkte</span>
        </div>
        <button className="claim-button ghost fl-dark-action" disabled={busy !== null} onClick={() => void act("leave", "/api/player/clans/leave", "Clan verlassen.")}>
          {busy === "leave" ? "…" : "LEAVE"}
        </button>
      </header>

      <div className="clan-grid fl-clan-grid">
        <div className="clan-members fl-friends-panel">
          <div className="fl-social-tabs"><span className="active">MEMBERS</span><span>ONLINE</span><span>RANK</span></div>
          <ul>
            {members?.map(({ player, role }) => <li key={player.id}>
              <span className={player.online ? "member-dot online" : "member-dot"} aria-hidden="true" />
              <span className="fl-social-avatar">{player.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="member-name"><strong>{player.displayName}</strong><small>Level {player.level}</small></span>
              <span className="member-meta">{role === "owner" && <Crown weight="fill" />} {roleLabel[role] ?? role}</span>
            </li>)}
          </ul>
        </div>

        <div className="clan-feed fl-chat-panel">
          <div className="fl-social-tabs"><span>FRIENDS</span><span className="active">CHAT</span><span>LEADERBOARD</span></div>
          <div className="feed-compose fl-feed-compose">
            <input type="text" value={draft} maxLength={280} placeholder="Nachricht an den Clan …" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void post(); }} />
            <button className="claim-button fl-gold-action" disabled={busy !== null || draft.trim().length === 0} onClick={() => void post()} aria-label="Senden"><PaperPlaneRight weight="fill" /></button>
          </div>
          <ul className="feed-list fl-feed-list">
            {feed?.length === 0 && <li className="section-empty">Noch keine Nachrichten. Sag Hallo.</li>}
            {feed?.filter((message) => message.status === "active").map((message) => <li key={message.id}>
              <div className="feed-head"><strong>{message.author.displayName}</strong><small>{timeShort(message.createdAt)}</small></div>
              <p>{message.body}</p>
            </li>)}
          </ul>
        </div>
      </div>
    </div>}

    {overview && !clan && <div className="clan-discover fl-clan-discover">
      {overview.incomingClanInvitations.length > 0 && <div className="clan-invites fl-clan-list">
        <h3>INVITATIONS</h3>
        {overview.incomingClanInvitations.map((invitation) => <div className="clan-row fl-clan-row" key={invitation.id}>
          <span className="clan-crest small fl-clan-crest"><Crown weight="fill" /><strong>{invitation.clan.tag}</strong></span>
          <span className="clan-row-main"><strong>{invitation.clan.name}</strong><small>{invitation.clan.memberCount} / {invitation.clan.memberLimit} Mitglieder</small></span>
          <button className="claim-button fl-gold-action" disabled={busy !== null} onClick={() => void act(invitation.id, `/api/player/clans/invitations/${invitation.id}/accept`, "Beigetreten.")}>
            {busy === invitation.id ? "…" : "ACCEPT"}
          </button>
        </div>)}
      </div>}

      <div className="fl-clan-list">
        <h3>DISCOVER CLANS</h3>
        {overview.discoverClans.length === 0 && <p className="section-empty">Gerade keine offenen Clans. Schau später wieder vorbei.</p>}
        {overview.discoverClans.map((candidate) => <div className="clan-row fl-clan-row" key={candidate.id}>
          <span className="clan-crest small fl-clan-crest"><Crown weight="fill" /><strong>{candidate.tag}</strong></span>
          <span className="clan-row-main"><strong>{candidate.name}</strong><small>{candidate.memberCount} / {candidate.memberLimit} · {coinNumber(candidate.weeklyScore)} Pkt.</small></span>
          <button className="claim-button fl-gold-action" disabled={busy !== null || candidate.memberCount >= candidate.memberLimit} onClick={() => void act(candidate.id, `/api/player/clans/${candidate.id}/join`, "Beigetreten.")}>
            {busy === candidate.id ? "…" : candidate.memberCount >= candidate.memberLimit ? "FULL" : "JOIN"}
          </button>
        </div>)}
      </div>
    </div>}

    <p className="clan-note">Clans sind rein sozial — gemeinsamer Fortschritt mit virtuellem Spielgeld, kein Echtgeld.</p>
  </section>;
}
