const state = { token: "", campaigns: [], moderationCases: [], players: [], economyGrants: [], operations: null, slots: [] };
const byId = (id) => document.getElementById(id);

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

function operatorError(error) {
  const messages = {
    UNAUTHORIZED: "The workforce token is invalid or expired.",
    FORBIDDEN: "This action requires a different operator role.",
    FOUR_EYES_REQUIRED: "A different publisher must approve this draft.",
    CAMPAIGN_NOT_PUBLISHED: "Only published campaigns can be dispatched.",
    MODERATION_CASE_ALREADY_RESOLVED: "This report was already resolved.",
    ECONOMY_GRANT_ALREADY_RESOLVED: "This grant was already resolved.",
    PLAYER_NOT_ACTIVE: "The player is no longer active.",
    OPERATIONS_UNAVAILABLE: "Operational health data is not available on this environment.",
    SLOT_NOT_FOUND: "This slot is not configured on this environment.",
  };
  return messages[error.message] ?? error.message;
}

async function api(path, options = {}) {
  if (!state.token) throw new Error("Connect an operator session first.");
  const headers = { authorization: `Bearer ${state.token}`, ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.code ?? `HTTP ${response.status}`);
  return body;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

async function loadCampaigns() {
  const container = byId("campaigns");
  container.innerHTML = '<p class="empty">Loading campaigns…</p>';
  try {
    const body = await api("/admin/v1/liveops/campaigns");
    state.campaigns = body.campaigns;
    renderCampaigns();
    setStatus(byId("session-status"), `Connected · ${state.campaigns.length} campaign(s) loaded`, "success");
  } catch (error) {
    container.innerHTML = `<p class="empty">${escapeHtml(operatorError(error))}</p>`;
    setStatus(byId("session-status"), operatorError(error), "error");
  }
}

function renderCampaigns() {
  const container = byId("campaigns");
  if (state.campaigns.length === 0) {
    container.innerHTML = '<p class="empty">No campaigns exist yet.</p>';
    return;
  }
  container.innerHTML = state.campaigns.map((campaign) => `
    <article class="campaign">
      <header><div><p class="eyebrow">${escapeHtml(campaign.name)}</p><h3>${escapeHtml(campaign.creative.title)}</h3></div><span class="badge ${campaign.status}">${escapeHtml(campaign.status)}</span></header>
      <p class="subtitle">${escapeHtml(campaign.creative.subtitle)}</p>
      <div class="meta"><span>${formatDate(campaign.startsAt)} — ${formatDate(campaign.endsAt)}</span><span>Audience: level ${campaign.audience.minLevel}+ · VIP ${campaign.audience.minVipPoints}+</span><span>Created by ${escapeHtml(campaign.createdBy)}</span></div>
      <footer><strong>${escapeHtml(campaign.creative.ctaLabel)}</strong>${campaign.status === "draft" ? `<button data-publish="${campaign.id}" type="button">Publish</button>` : `<span>Approved by ${escapeHtml(campaign.publishedBy ?? "—")}</span><button data-push="${campaign.id}" type="button">Queue push</button>`}</footer>
    </article>`).join("");
  container.querySelectorAll("[data-publish]").forEach((button) => button.addEventListener("click", () => publishCampaign(button.dataset.publish)));
  container.querySelectorAll("[data-push]").forEach((button) => button.addEventListener("click", () => dispatchPush(button.dataset.push)));
}

async function dispatchPush(id) {
  if (!window.confirm("Queue this campaign for every eligible, opted-in installation? This action is audited and idempotent.")) return;
  try {
    const result = await api(`/admin/v1/liveops/campaigns/${encodeURIComponent(id)}/push-dispatch`, { method: "POST" });
    setStatus(byId("session-status"), result.duplicate ? "Push was already queued for this campaign version." : `${result.queued} push delivery job(s) queued.`, "success");
  } catch (error) {
    setStatus(byId("session-status"), operatorError(error), "error");
  }
}

async function publishCampaign(id) {
  try {
    await api(`/admin/v1/liveops/campaigns/${encodeURIComponent(id)}/publish`, { method: "POST" });
    await loadCampaigns();
  } catch (error) {
    setStatus(byId("session-status"), operatorError(error), "error");
  }
}

async function loadAudit() {
  const target = byId("audit");
  try {
    const body = await api("/admin/v1/audit?limit=100");
    target.innerHTML = body.entries.length ? body.entries.map((entry) => `<tr><td>${formatDate(entry.createdAt)}</td><td>${escapeHtml(entry.actor)}</td><td>${escapeHtml(entry.action)}</td><td>${escapeHtml(entry.entityType)} · ${escapeHtml(entry.entityId)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty">No audit entries.</td></tr>';
  } catch (error) {
    target.innerHTML = `<tr><td colspan="4" class="empty">${escapeHtml(operatorError(error))}</td></tr>`;
  }
}

async function loadModeration() {
  const container = byId("moderation-cases");
  container.innerHTML = '<p class="empty">Loading reports…</p>';
  try {
    const body = await api("/admin/v1/moderation/cases?status=open&limit=50");
    state.moderationCases = body.cases;
    if (!body.cases.length) {
      container.innerHTML = '<p class="empty">The moderation queue is clear.</p>';
      return;
    }
    container.innerHTML = body.cases.map((item) => `
      <article class="campaign">
        <header><div><p class="eyebrow">${escapeHtml(item.author.displayName)} · ${formatDate(item.lastReportedAt)}</p><h3>${item.reportCount} report${item.reportCount === 1 ? "" : "s"}</h3></div><span class="badge draft">OPEN</span></header>
        <p class="subtitle">${escapeHtml(item.messageBody)}</p>
        <div class="meta"><span>${Object.entries(item.reasons).filter(([, count]) => count).map(([reason, count]) => `${escapeHtml(reason)}: ${count}`).join(" · ")}</span><span>Clan ${escapeHtml(item.clanId)}</span></div>
        <footer><button data-moderate="dismiss" data-case="${item.id}" type="button">Dismiss</button><button class="primary" data-moderate="remove_message" data-case="${item.id}" type="button">Remove message</button></footer>
      </article>`).join("");
    container.querySelectorAll("[data-moderate]").forEach((button) => button.addEventListener("click", () => resolveModeration(button.dataset.case, button.dataset.moderate)));
  } catch (error) {
    container.innerHTML = `<p class="empty">${escapeHtml(operatorError(error))}</p>`;
  }
}

async function resolveModeration(caseId, decision) {
  const note = window.prompt(decision === "remove_message" ? "Reason for removing this message:" : "Reason for dismissing this report:");
  if (!note || note.trim().length < 3) return;
  try {
    await api(`/admin/v1/moderation/cases/${encodeURIComponent(caseId)}/resolve`, { method: "POST", body: JSON.stringify({ decision, note: note.trim() }) });
    setStatus(byId("session-status"), "Moderation decision saved to the immutable audit trail.", "success");
    await loadModeration();
  } catch (error) { setStatus(byId("session-status"), operatorError(error), "error"); }
}

async function searchPlayers(query = "") {
  const container = byId("players");
  container.innerHTML = '<p class="empty">Searching…</p>';
  try {
    const body = await api(`/admin/v1/players?query=${encodeURIComponent(query)}&limit=25`);
    state.players = body.players;
    container.innerHTML = body.players.length ? body.players.map((player) => `
      <article class="campaign"><header><div><p class="eyebrow">${escapeHtml(player.id)}</p><h3>${escapeHtml(player.displayName)}</h3></div><span class="badge published">${escapeHtml(player.status)}</span></header>
      <div class="meta"><span>Level ${player.level} · XP ${player.xp} · VIP ${player.vipPoints}</span><span>${player.coinBalance.toLocaleString("de-DE")} coins · ${player.gemBalance.toLocaleString("de-DE")} gems</span></div>
      <footer><button class="primary" data-grant-player="${player.id}" type="button">Request grant</button></footer></article>`).join("") : '<p class="empty">No matching players.</p>';
    container.querySelectorAll("[data-grant-player]").forEach((button) => button.addEventListener("click", () => requestGrant(button.dataset.grantPlayer)));
  } catch (error) { container.innerHTML = `<p class="empty">${escapeHtml(operatorError(error))}</p>`; }
}

function requestGrant(playerId) {
  const form = byId("grant-form");
  form.reset(); form.elements.playerId.value = playerId; form.classList.remove("hidden");
  form.elements.amount.focus();
}

async function submitGrant(event) {
  event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
  try {
    await api("/admin/v1/economy/grants", { method: "POST", body: JSON.stringify({
      playerId: values.get("playerId"), currency: values.get("currency"), amount: Number(values.get("amount")), reason: values.get("reason"),
    }) });
    form.classList.add("hidden"); form.reset();
    setStatus(byId("session-status"), "Grant requested. A different approver must resolve it.", "success");
    await loadEconomyGrants();
  } catch (error) { setStatus(byId("session-status"), operatorError(error), "error"); }
}

async function loadEconomyGrants() {
  const container = byId("economy-grants");
  container.innerHTML = '<p class="empty">Loading queue…</p>';
  try {
    const body = await api("/admin/v1/economy/grants?limit=50"); state.economyGrants = body.grants;
    container.innerHTML = body.grants.length ? body.grants.map((grant) => `
      <article class="campaign"><header><div><p class="eyebrow">${escapeHtml(grant.currency)} GRANT</p><h3>${grant.amount.toLocaleString("de-DE")}</h3></div><span class="badge ${grant.status === 'approved' ? 'published' : 'draft'}">${escapeHtml(grant.status)}</span></header>
      <p class="subtitle">${escapeHtml(grant.reason)}</p><div class="meta"><span>Player ${escapeHtml(grant.playerId)}</span><span>Requested by ${escapeHtml(grant.requestedBy)} · ${formatDate(grant.requestedAt)}</span></div>
      <footer>${grant.status === 'pending' ? `<button data-grant-action="reject" data-grant-id="${grant.id}" type="button">Reject</button><button class="primary" data-grant-action="approve" data-grant-id="${grant.id}" type="button">Approve</button>` : `<span>Resolved by ${escapeHtml(grant.resolvedBy ?? '—')}</span>`}</footer></article>`).join("") : '<p class="empty">The grant queue is empty.</p>';
    container.querySelectorAll("[data-grant-action]").forEach((button) => button.addEventListener("click", () => resolveGrant(button.dataset.grantId, button.dataset.grantAction)));
  } catch (error) { container.innerHTML = `<p class="empty">${escapeHtml(operatorError(error))}</p>`; }
}

async function resolveGrant(grantId, action) {
  try { await api(`/admin/v1/economy/grants/${encodeURIComponent(grantId)}/${action}`, { method: "POST" }); await loadEconomyGrants(); }
  catch (error) { setStatus(byId("session-status"), operatorError(error), "error"); }
}

async function loadOperations() {
  const summary = byId("operations-summary"); const metrics = byId("operations-metrics");
  summary.innerHTML = '<p class="empty">Loading operational snapshot…</p>'; metrics.innerHTML = "";
  try {
    const health = await api("/admin/v1/operations/health"); state.operations = health;
    const issueText = health.issues.length ? health.issues.map((issue) => issue.replaceAll("_", " ")).join(" · ") : "No active operational warnings";
    summary.innerHTML = `<div class="health-state ${escapeHtml(health.status)}"><div><p class="eyebrow">${escapeHtml(health.status)}</p><strong>${escapeHtml(issueText)}</strong></div><p>${formatDate(health.generatedAt)}</p></div>`;
    const cards = [
      ["Readiness", Object.entries(health.readiness.checks).map(([name, value]) => [name, value])],
      ["HTTP since start", [["requests", health.runtime.requests.total], ["server errors", health.runtime.requests.serverErrors], ["average latency", `${health.runtime.requests.averageDurationMilliseconds.toFixed(1)} ms`]]],
      ["Authoritative spins", [["returned", health.runtime.spins.returned], ["rejected", health.runtime.spins.rejected], ["last 15 minutes", health.durable.spinsLast15Minutes]]],
      ["Players", [["active", health.durable.activePlayers], ["suspended", health.durable.suspendedPlayers]]],
      ["Work queues", [["economy approvals", health.durable.pendingEconomyGrants], ["moderation cases", health.durable.openModerationCases], ["admin actions / 24h", health.durable.adminActionsLast24Hours]]],
      ["Push delivery", [["pending", health.durable.pushPending], ["processing", health.durable.pushProcessing], ["stale leases", health.durable.pushStale], ["failed / 24h", health.durable.pushFailedLast24Hours]]],
      ["Client ingestion", [["analytics / 24h", health.durable.analyticsEventsLast24Hours], ["accepted since start", health.runtime.analytics.accepted], ["duplicates since start", health.runtime.analytics.duplicates]]],
      ["Runtime", [["uptime", formatDuration(health.runtime.runtime.uptimeSeconds)], ["resident memory", formatBytes(health.runtime.runtime.residentMemoryBytes)], ["heap used", formatBytes(health.runtime.runtime.heapUsedBytes)]]],
    ];
    metrics.innerHTML = cards.map(([title, entries]) => `<article class="health-card"><h3>${escapeHtml(title)}</h3><dl>${entries.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(typeof value === "number" ? value.toLocaleString("de-DE") : value)}</dd>`).join("")}</dl></article>`).join("");
  } catch (error) { summary.innerHTML = `<p class="empty">${escapeHtml(operatorError(error))}</p>`; }
}

function formatBytes(value) { return `${(value / 1024 / 1024).toFixed(1)} MiB`; }
function formatDuration(value) {
  const seconds = Math.max(0, Math.floor(value)); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

const slotStatusBadge = { live: "published", maintenance: "draft", disabled: "draft" };

/** Betriebsstatus aller konfigurierten Slots laden und darstellen. */
async function loadSlotAvailability() {
  const container = byId("slot-availability");
  container.innerHTML = `<p class="empty">Loading slots…</p>`;
  try {
    const body = await api("/admin/v1/slots/availability");
    state.slots = body.entries;
    if (!state.slots.length) {
      container.innerHTML = `<p class="empty">No slots are configured.</p>`;
      return;
    }
    const labels = { live: "LIVE", maintenance: "MAINTENANCE", disabled: "DISABLED" };
    container.innerHTML = state.slots.map((slot) => `
      <article class="campaign">
        <header><div><p class="eyebrow">SLOT</p><h3>${escapeHtml(slot.slotId)}</h3></div><span class="badge ${slotStatusBadge[slot.status] ?? "draft"}">${escapeHtml(labels[slot.status] ?? slot.status)}</span></header>
        ${slot.message ? `<p class="subtitle">${escapeHtml(slot.message)}</p>` : ""}
        <div class="meta"><span>${slot.updatedBy ? `Last change by ${escapeHtml(slot.updatedBy)}` : "Never changed"}</span><span>${slot.updatedAt ? formatDate(slot.updatedAt) : "—"}</span></div>
        <footer>
          ${slot.status === "live"
            ? `<button data-slot-status="maintenance" data-slot="${escapeHtml(slot.slotId)}" type="button">Maintenance</button><button data-slot-status="disabled" data-slot="${escapeHtml(slot.slotId)}" type="button">Disable</button>`
            : `<button class="primary" data-slot-status="live" data-slot="${escapeHtml(slot.slotId)}" type="button">Bring back online</button>`}
        </footer>
      </article>`).join("");
    container.querySelectorAll("[data-slot-status]").forEach((button) =>
      button.addEventListener("click", () => setSlotStatus(button.dataset.slot, button.dataset.slotStatus)));
  } catch (error) {
    container.innerHTML = `<p class="empty">${escapeHtml(operatorError(error))}</p>`;
  }
}

/** Status aendern. Sperren verlangen eine Bestaetigung und einen Spielerhinweis. */
async function setSlotStatus(slotId, status) {
  let message = null;
  if (status !== "live") {
    const verb = status === "maintenance" ? "put into maintenance" : "disable";
    if (!window.confirm(`Really ${verb} "${slotId}"? Players can no longer place bets on it.`)) return;
    const note = window.prompt("Optional note shown to players (max. 160 characters):", status === "maintenance" ? "Wartung laeuft, wir sind gleich zurueck." : "");
    if (note === null) return;
    message = note.trim().slice(0, 160) || null;
  }
  try {
    await api(`/admin/v1/slots/${encodeURIComponent(slotId)}/availability`, {
      method: "PUT", body: JSON.stringify({ status, message }),
    });
    setStatus(byId("session-status"), `Slot "${slotId}" is now ${status}.`, "success");
    await loadSlotAvailability();
  } catch (error) {
    setStatus(byId("session-status"), operatorError(error), "error");
  }
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== `${name}-view`));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  if (name === "audit" && state.token) loadAudit();
  if (name === "moderation" && state.token) loadModeration();
  if (name === "economy" && state.token) loadEconomyGrants();
  if (name === "operations" && state.token) loadOperations();
  if (name === "slots" && state.token) loadSlotAvailability();
}

function connect(token) {
  state.token = token.trim().replace(/^Bearer\s+/i, "");
  byId("token").value = "";
  if (!state.token) return setStatus(byId("session-status"), "A workforce token is required.", "error");
  loadCampaigns();
}

byId("connect").addEventListener("click", () => connect(byId("token").value));
byId("demo-editor").addEventListener("click", () => connect("local-admin-editor"));
byId("demo-publisher").addEventListener("click", () => connect("local-admin-publisher"));
byId("demo-moderator").addEventListener("click", () => {
  state.token = "local-admin-moderator";
  setStatus(byId("session-status"), "Connected · social moderator", "success");
  showView("moderation");
});
byId("demo-support").addEventListener("click", () => { state.token = "local-admin-support"; setStatus(byId("session-status"), "Connected · economy support", "success"); showView("economy"); searchPlayers(); });
byId("demo-approver").addEventListener("click", () => { state.token = "local-admin-economy-approver"; setStatus(byId("session-status"), "Connected · economy approver", "success"); showView("economy"); });
byId("demo-operations").addEventListener("click", () => { state.token = "local-admin-operations"; setStatus(byId("session-status"), "Connected · operations viewer", "success"); showView("operations"); });
byId("refresh-campaigns").addEventListener("click", loadCampaigns);
byId("refresh-audit").addEventListener("click", loadAudit);
byId("refresh-moderation").addEventListener("click", loadModeration);
byId("refresh-grants").addEventListener("click", loadEconomyGrants);
byId("refresh-operations").addEventListener("click", loadOperations);
byId("refresh-slots").addEventListener("click", loadSlotAvailability);
byId("player-search").addEventListener("submit", (event) => { event.preventDefault(); searchPlayers(new FormData(event.currentTarget).get("query")); });
byId("grant-form").addEventListener("submit", submitGrant);
byId("cancel-grant").addEventListener("click", () => byId("grant-form").classList.add("hidden"));
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));

const form = byId("campaign-form");
byId("environment-name").textContent = window.location.host;
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
form.elements.startsAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
form.elements.endsAt.value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(form);
  try {
    await api("/admin/v1/liveops/campaigns", { method: "POST", body: JSON.stringify({
      name: values.get("name"), startsAt: new Date(values.get("startsAt")).toISOString(), endsAt: new Date(values.get("endsAt")).toISOString(),
      audience: { minLevel: Number(values.get("minLevel")), minVipPoints: Number(values.get("minVipPoints")) },
      creative: { title: values.get("title"), subtitle: values.get("subtitle"), ctaLabel: values.get("ctaLabel") },
    }) });
    setStatus(byId("form-status"), "Draft saved. Switch to a publisher for approval.", "success");
    await loadCampaigns();
    showView("campaigns");
  } catch (error) { setStatus(byId("form-status"), operatorError(error), "error"); }
});
