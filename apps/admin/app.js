const state = { token: "", campaigns: [], moderationCases: [] };
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
  };
  return messages[error.message] ?? error.message;
}

async function api(path, options = {}) {
  if (!state.token) throw new Error("Connect an operator session first.");
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${state.token}`, ...options.headers },
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

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== `${name}-view`));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  if (name === "audit" && state.token) loadAudit();
  if (name === "moderation" && state.token) loadModeration();
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
byId("refresh-campaigns").addEventListener("click", loadCampaigns);
byId("refresh-audit").addEventListener("click", loadAudit);
byId("refresh-moderation").addEventListener("click", loadModeration);
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
