import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { Bell } from "@phosphor-icons/react/Bell";
import { BellRinging } from "@phosphor-icons/react/BellRinging";
import { BookOpen } from "@phosphor-icons/react/BookOpen";
import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { CalendarDots } from "@phosphor-icons/react/CalendarDots";
import { Cards } from "@phosphor-icons/react/Cards";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Circle } from "@phosphor-icons/react/Circle";
import { Clock } from "@phosphor-icons/react/Clock";
import { ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";
import { Coins } from "@phosphor-icons/react/Coins";
import { Database } from "@phosphor-icons/react/Database";
import { DotsThree } from "@phosphor-icons/react/DotsThree";
import { DotsThreeVertical } from "@phosphor-icons/react/DotsThreeVertical";
import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { Eye } from "@phosphor-icons/react/Eye";
import { File } from "@phosphor-icons/react/File";
import { FileMagnifyingGlass } from "@phosphor-icons/react/FileMagnifyingGlass";
import { Flask } from "@phosphor-icons/react/Flask";
import { FolderOpen } from "@phosphor-icons/react/FolderOpen";
import { Funnel } from "@phosphor-icons/react/Funnel";
import { Images } from "@phosphor-icons/react/Images";
import { Info } from "@phosphor-icons/react/Info";
import { List } from "@phosphor-icons/react/List";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Plus } from "@phosphor-icons/react/Plus";
import { Pulse } from "@phosphor-icons/react/Pulse";
import { Question } from "@phosphor-icons/react/Question";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { ShieldChevron } from "@phosphor-icons/react/ShieldChevron";
import { ShoppingBag } from "@phosphor-icons/react/ShoppingBag";
import { ShoppingBagOpen } from "@phosphor-icons/react/ShoppingBagOpen";
import { SlidersHorizontal } from "@phosphor-icons/react/SlidersHorizontal";
import { SquaresFour } from "@phosphor-icons/react/SquaresFour";
import { Stack } from "@phosphor-icons/react/Stack";
import { Target } from "@phosphor-icons/react/Target";
import { Trophy } from "@phosphor-icons/react/Trophy";
import { UserFocus } from "@phosphor-icons/react/UserFocus";
import { UserPlus } from "@phosphor-icons/react/UserPlus";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { Wallet } from "@phosphor-icons/react/Wallet";
import { Warning } from "@phosphor-icons/react/Warning";
import { WarningCircle } from "@phosphor-icons/react/WarningCircle";
import { X } from "@phosphor-icons/react/X";
import { moduleCatalog, navigationGroups, slots } from "./catalog.js";

const demoMetrics = {
  dau: 248231, mau: 1842765, online: 12842, revenue: 1237895, purchases: 42671,
  coins: "8,42 Bio.", freeSpins: 184920, session: "18m 42s", activeSlots: 512, events: 12,
};

const activity = [
  ["UserPlus", "Spieler registriert", "Spieler-ID: 9f8a2e77", "vor 10 Sek.", "violet"],
  ["Coins", "Großer Gewinn", "25.000.000 Coins · 7c1b9d44", "vor 28 Sek.", "gold"],
  ["ShoppingBag", "Kauf bestätigt", "49,99 € · Spieler a3d4f8c1", "vor 45 Sek.", "green"],
  ["Trophy", "Turnier abgeschlossen", "Summer Royale #1245", "vor 1 Min.", "violet"],
  ["Wallet", "Wallet-Auszahlung", "200.000 Coins · b6e7a2d9", "vor 2 Min.", "green"],
];

const events = [
  ["Summer Royale", "Turnier", "Live", "17. Jul., 00:00", "19. Jul., 23:59", "4.821"],
  ["Lucky Friday", "Promotion", "Live", "17. Jul., 12:00", "17. Jul., 23:59", "–"],
  ["Weekend Reload", "Bonus", "Live", "16. Jul., 00:00", "19. Jul., 23:59", "–"],
  ["High Roller Battle", "Turnier", "Geplant", "18. Jul., 19:00", "18. Jul., 23:00", "–"],
];

const icons = {
  ArrowRight, Bell, BellRinging, BookOpen, CalendarBlank, CalendarDots, Cards,
  CaretDown, CaretLeft, CaretRight, ChartLineUp, Check, CheckCircle, Circle,
  Clock, ClockCounterClockwise, Coins, Database, DotsThree, DotsThreeVertical,
  EnvelopeSimple, Eye, File, FileSearch: FileMagnifyingGlass, Flask, FolderOpen, Funnel, Images,
  Info, List, LockKey, MagnifyingGlass, PaperPlaneTilt, Plus, Pulse, Question,
  ShieldCheck, ShieldChevron, ShoppingBag, ShoppingBagOpen, SlidersHorizontal,
  SquaresFour, Stack, Target, Trophy, UserFocus, UserPlus, UsersThree, Wallet,
  Warning, WarningCircle, X,
};

function Icon({ name, size = 18, weight = "regular" }) {
  const Component = icons[name] ?? Circle;
  return <Component size={size} weight={weight} aria-hidden="true" />;
}

function formatNumber(value) { return new Intl.NumberFormat("de-DE").format(value); }

function api(path, token) {
  return fetch(path, { headers: { authorization: `Bearer ${token}` } }).then(async (response) => {
    if (!response.ok) throw new Error((await response.json()).code ?? `HTTP_${response.status}`);
    return response.json();
  });
}

function Sidebar({ active, onChange, collapsed, onCollapse }) {
  return <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="brand"><img src="/control-center-brand.png" alt="Aurora Operations Control Center"/></div>
    <nav aria-label="Control-Center-Module">
      {navigationGroups.map((group) => <section className="nav-group" key={group.label}>
        <p>{group.label}</p>
        {group.items.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => onChange(item.id)} title={item.label}>
          <Icon name={item.icon} /><span>{item.label}</span>{item.id === "moderation" && <small>18</small>}
        </button>)}
      </section>)}
    </nav>
    <button className="collapse-button" onClick={onCollapse}><Icon name={collapsed ? "CaretRight" : "CaretLeft"} /><span>Menü minimieren</span></button>
  </aside>;
}

function Topbar({ title, onMenu, onSearch }) {
  return <header className="topbar">
    <button className="mobile-menu" onClick={onMenu} aria-label="Navigation öffnen"><Icon name="List" size={22} /></button>
    <h1>{title}</h1>
    <label className="global-search"><Icon name="MagnifyingGlass" /><input onChange={(event) => onSearch(event.target.value)} placeholder="Suche nach Spieler, Kampagne, ID …"/><kbd>⌘ K</kbd></label>
    <button className="environment"><span/>Produktion<Icon name="CaretDown" size={13}/></button>
    <button className="icon-button" aria-label="Benachrichtigungen"><Icon name="Bell" size={20}/><b>3</b></button>
    <button className="icon-button help" aria-label="Hilfe"><Icon name="Question" size={20}/></button>
    <div className="profile"><div>LM</div><p><strong>Laura Müller</strong><span>Operator</span></p><Icon name="CaretDown" size={13}/></div>
  </header>;
}

function StatusStrip({ health }) {
  const healthy = health?.status !== "critical";
  return <section className="status-strip">
    <div className="platform-state"><span>PLATTFORM-STATUS</span><strong>{healthy ? "Plattform live" : "Eingriff erforderlich"}</strong><small>{healthy ? "Alle Systeme normal" : "Mindestens ein Dienst ist gestört"}</small></div>
    {[["Pulse", "API", "Alle Systeme normal", "198 ms"], ["Database", "Datenbank", "Gesund", "32 ms"], ["Stack", "Queue", "Gesund", "Lag 120 ms"], ["WarningCircle", "Incidents", "0 aktive", "Letzte 24 h"]].map(([icon, title, state, detail]) => <div className="service" key={title}><Icon name={icon} size={22}/><p><strong>{title}</strong><span>{state}</span><small>{detail}</small></p></div>)}
    <button>Status-Details <Icon name="ArrowRight"/></button>
  </section>;
}

function TrendChart() {
  const points = "0,205 45,184 90,176 135,164 180,151 225,140 270,127 315,118 360,103 405,92 450,74 495,67 540,49 585,42 630,25 675,12";
  return <div className="chart" aria-label="Umsatzentwicklung am 17. Juli 2026">
    <div className="chart-y"><span>1,5M</span><span>1,25M</span><span>1,0M</span><span>750K</span><span>500K</span><span>250K</span><span>0</span></div>
    <svg viewBox="0 0 680 220" role="img" aria-label="Steigende Umsatzkurve"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8a5cf6" stopOpacity=".3"/><stop offset="1" stopColor="#8a5cf6" stopOpacity="0"/></linearGradient></defs><g className="grid">{[15,47,79,111,143,175,207].map(y => <line key={y} x1="0" y1={y} x2="680" y2={y}/>)}</g><polyline className="comparison" points="0,205 60,195 120,181 180,172 240,156 300,146 360,128 420,113 480,96 540,77 600,55 680,25"/><polygon fill="url(#area)" points={`${points} 675,220 0,220`}/><polyline className="primary-line" points={points}/><circle cx="675" cy="12" r="4"/></svg>
    <div className="chart-x">{["00:00","03:00","06:00","09:00","12:00","15:00","18:00","21:00","24:00"].map(v => <span key={v}>{v}</span>)}</div>
    <div className="legend"><span className="today"/>17. Juli 2026 <span className="yesterday"/>16. Juli 2026</div>
  </div>;
}

function Dashboard({ health }) {
  const metrics = [
    ["DAU", formatNumber(demoMetrics.dau), "12,6%"], ["MAU", formatNumber(demoMetrics.mau), "8,3%"], ["Online-Spieler", formatNumber(demoMetrics.online), "15,4%"], ["Umsatz heute", `€${formatNumber(demoMetrics.revenue)}`, "9,7%"], ["Käufe heute", formatNumber(demoMetrics.purchases), "11,2%"],
  ];
  return <div className="dashboard-view">
    <StatusStrip health={health}/>
    <div className="dashboard-grid">
      <section className="metrics-panel">
        <div className="panel-heading"><span>WICHTIGE KENNZAHLEN <Icon name="Info"/></span><div><button>Heute <Icon name="CaretDown" size={12}/></button><time>17. Juli 2026</time><small>vs. Gestern</small></div></div>
        <div className="metric-row">{metrics.map(([label, value, trend]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>↗ {trend} <em>vs. Gestern</em></small></article>)}</div>
        <h3>Umsatz (EUR)</h3><TrendChart/>
      </section>
      <ActivityPanel/>
      <EventsPanel/>
      <WarningsPanel/>
    </div>
    <div className="dashboard-footer"><span/>Letzte Aktualisierung: vor 10 Sek.<small>Zeitzone: Europa/Berlin (MESZ)</small></div>
  </div>;
}

function ActivityPanel() {
  return <section className="side-panel activity-panel"><div className="panel-title"><span/>LIVE AKTIVITÄT</div>{activity.map(([icon,title,text,time,tone]) => <article key={`${title}-${time}`}><div className={`activity-icon ${tone}`}><Icon name={icon}/></div><p><strong>{title}</strong><span>{text}</span></p><time>{time}</time></article>)}<button>Alle Aktivitäten anzeigen <Icon name="ArrowRight"/></button></section>;
}

function EventsPanel() {
  return <section className="events-panel"><div className="panel-title">AKTIVE EVENTS <button>Alle anzeigen <Icon name="ArrowRight"/></button></div><div className="event-table"><div className="event-head"><span>Event</span><span>Typ</span><span>Status</span><span>Start</span><span>Ende</span><span>Teilnehmer</span></div>{events.map((row) => <div className="event-row" key={row[0]}>{row.map((value,index) => <span key={index} className={index === 1 ? "event-type" : index === 2 ? `event-status ${value.toLowerCase()}` : ""}>{index === 2 && <i/>}{value}</span>)}</div>)}</div></section>;
}

function WarningsPanel() {
  const warnings = [["Erhöhte Abbruchrate bei Zahlungen", "Payment Gateway: Stripe", "vor 6 Min."], ["Ungewöhnliche Anmeldungsmuster erkannt", "Betroffene Spieler: 24", "vor 18 Min."], ["Wartungsfenster geplant", "19. Juli 2026, 02:00 – 04:00 MESZ", "vor 1 Std."]];
  return <section className="side-panel warnings-panel"><div className="panel-title">WARNUNGEN <button>Alle anzeigen <Icon name="ArrowRight"/></button></div>{warnings.map(([title,text,time],index) => <article key={title}><Icon name={index === 2 ? "Info" : "Warning"}/><p><strong>{title}</strong><span>{text}</span></p><time>{time}</time></article>)}</section>;
}

function SlotsWorkspace() {
  const [selectedId, setSelectedId] = useState(slots[0].id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Alle");
  const [toast, setToast] = useState("");
  const selected = slots.find((slot) => slot.id === selectedId) ?? slots[0];
  const filtered = slots.filter((slot) => slot.name.toLowerCase().includes(query.toLowerCase()) && (status === "Alle" || slot.status === status));
  const action = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  return <div className="workspace slot-workspace">
    <div className="workspace-heading"><div><p>CONTENT / SLOT-KATALOG</p><h2>Slots <span>512</span></h2><small>Konfigurieren, validieren und im gesamten Netzwerk veröffentlichen.</small></div><button className="primary-action" onClick={() => action("Neuer Slot-Entwurf wurde angelegt.")}><Icon name="Plus"/>Neuen Slot anlegen</button></div>
    <div className="slot-layout">
      <section className="registry">
        <div className="filters"><label><Icon name="MagnifyingGlass"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Slots suchen…"/></label><select value={status} onChange={(e)=>setStatus(e.target.value)}><option>Alle</option><option>Veröffentlicht</option><option>Entwurf</option><option>Geplant</option><option>In Prüfung</option></select><select><option>Alle Kategorien</option><option>Jackpot</option><option>Megaways</option><option>Hold & Spin</option></select><button><Icon name="Funnel"/>Weitere Filter</button></div>
        <div className="slot-table"><div className="slot-head"><span>Slot</span><span>Status</span><span>Version</span><span>RTP</span><span>Volatilität</span><span>Letzte Veröffentlichung</span><span>Geplant</span></div>{filtered.map((slot) => <button className={`slot-row ${selected.id === slot.id ? "selected" : ""}`} key={slot.id} onClick={()=>setSelectedId(slot.id)}><span className="slot-name"><i style={{background:slot.color}}>{slot.name.split(" ").map(v=>v[0]).join("").slice(0,2)}</i><b>{slot.name}<small>{slot.id}</small></b></span><span><em className={`status-badge ${slot.status.toLowerCase().replace(" ", "-")}`}>{slot.status}</em></span><span>{slot.version}</span><span>{slot.rtp.toFixed(2)}%</span><span className="volatility">{slot.volatility}<i>{[1,2,3,4,5].map(v=><b key={v} className={v <= (slot.volatility === "Hoch" ? 5 : slot.volatility === "Mittel" ? 3 : 2) ? "on" : ""}/>)}</i></span><span>{slot.published}</span><span>{slot.scheduled ?? "–"}</span></button>)}</div>
      </section>
      <aside className="inspector"><div className="inspector-heading"><div className="slot-art" style={{background:selected.color}}>{selected.name.split(" ").map(v=>v[0]).join("").slice(0,2)}</div><p><strong>{selected.name}</strong><span>{selected.id}</span></p><button><Icon name="X"/></button></div><div className="inspector-tabs"><button className="active">Übersicht</button><button>Aktivität</button></div>
        <h3>Versionen vergleichen</h3><div className="compare-grid"><span/><b>Veröffentlicht<br/><em>{selected.version}</em></b><b>Geplanter Entwurf<br/><em>2.5.0</em></b>{[["RTP", `${selected.rtp.toFixed(2)}%`, `${(selected.rtp+.12).toFixed(2)}%`],["Volatilität",selected.volatility,selected.volatility],["Walzen / Reihen","5 / 3","5 / 3"],["Max. Gewinn",selected.maxWin,selected.maxWin]].flat().map((v,i)=><span key={i}>{v}</span>)}</div>
        <section className="validation"><h3>Validierung</h3><p><Icon name="CheckCircle" weight="fill"/><strong>Bestanden</strong><time>17.07.2026 · 08:58</time></p><button onClick={()=>action("Validierungsbericht geöffnet.")}>Validierungsbericht anzeigen</button></section>
        <section><h3>Geplante Aktivierung</h3><div className="schedule"><label><Icon name="CalendarBlank"/><input type="date" defaultValue="2026-07-24"/></label><label><Icon name="Clock"/><input type="time" defaultValue="10:00"/></label></div></section>
        <section className="inspector-actions"><h3>Aktionen</h3><button onClick={()=>action("Slot-Vorschau wurde vorbereitet.")}><Icon name="Eye"/>Vorschau öffnen</button><button onClick={()=>action("Konfiguration ist valide.")}><Icon name="ShieldCheck"/>Validieren</button><button className="gold" onClick={()=>action("Veröffentlichung zur Freigabe eingereicht.")}><Icon name="PaperPlaneTilt"/>Veröffentlichung anfordern</button><small>Vier-Augen-Freigabe erforderlich</small></section>
      </aside>
    </div>{toast && <div className="toast"><Icon name="CheckCircle" weight="fill"/>{toast}</div>}
  </div>;
}

function RemoteConfigWorkspace() {
  const [draft, setDraft] = useState({ starter: 75000, exchange: 110, payout: 5000000, rollout: 50, date: "2026-07-17", time: "14:00", reason: "Anhebung des Startguthabens und Anpassung der Kauf- und Tauschkurse." });
  const [requested, setRequested] = useState(false);
  const fields = [["Startsaldo (Coins)",50000,"starter",1000,1000000],["Maximaler Bestand (Coins)",10000000,"max",1000000,50000000],["Tauschverhältnis (Chips pro Coin)",100,"exchange",10,1000],["Tägliches Auszahlungslimit (Coins)",5000000,"payout",100000,10000000]];
  const update = (key,value)=>setDraft((current)=>({...current,[key]:value}));
  return <div className="workspace config-workspace"><div className="workspace-heading"><div><p>PLATTFORM / REMOTE CONFIG</p><h2>Remote Config</h2><small>Sichere, versionierte Konfigurationen für alle Umgebungen verwalten.</small></div><div><button><Icon name="BookOpen"/>Schema</button><button><Icon name="ClockCounterClockwise"/>Historie</button></div></div>
    <div className="config-layout"><aside className="config-tree"><label><Icon name="MagnifyingGlass"/><input placeholder="Konfigurationen filtern"/></label>{[["economy",["currency","sink","sources","rewards","balance","limits","packages"]],["gameplay",["energy","lives","xp"]],["social",["gifting","leaderboards"]],["engagement",["daily_bonus","streaks"]],["system",["maintenance","messaging"]]].map(([group,items])=><section key={group}><strong><Icon name="FolderOpen"/>{group}</strong>{items.map(item=><button key={item} className={item === "currency" ? "active" : ""}><Icon name="File"/>{item}</button>)}</section>)}</aside>
      <main className="config-editor"><div className="config-bar"><em>DRAFT</em><span>Nicht veröffentlicht</span><small>Änderung #ECON-3789</small><button><Icon name="DotsThreeVertical"/></button></div><header><h2>economy.currency</h2><p>Währungseinstellungen für Chips und Coins in der Ökonomie.</p></header><div className="field-head"><strong>Währungseinstellungen</strong><span>Aktueller Wert</span><span>Entwurf (geändert)</span></div>{fields.map(([label,current,key,min,max])=><div className="config-field" key={key}><p><strong>{label}</strong><span>Schema-validierter Ganzzahlwert.</span></p><output>{formatNumber(current)}</output>{key === "max" ? <input value={formatNumber(current)} disabled/> : <label className={Number(draft[key]) > max*.9 ? "warning" : "valid"}><input type="number" value={draft[key]} min={min} max={max} onChange={(e)=>update(key,Number(e.target.value))}/><Icon name={Number(draft[key]) > max*.9 ? "Warning" : "Check"}/><small>{Number(draft[key]) > max*.9 ? "Nahe am empfohlenen Limit" : `${formatNumber(min)} bis ${formatNumber(max)}`}</small></label>}</div>)}<div className="config-validation"><span><Icon name="Warning"/>Validierung: 2 Warnungen, 0 Fehler</span><span><Icon name="CheckCircle"/>Zuletzt validiert: 17. Juli 2026, 10:22</span></div></main>
      <aside className="change-review"><h3>ÄNDERUNGSÜBERSICHT</h3><label><strong>Zusammenfassung</strong><textarea value={draft.reason} onChange={(e)=>update("reason",e.target.value)} maxLength="500"/><small>{draft.reason.length} / 500</small></label><h4>Rollout</h4><div className="review-row"><label>Zielgruppe<select><option>Alle Spieler</option><option>VIP 5+</option><option>Deutschland</option></select></label><label>Rollout-Prozentsatz<input type="number" value={draft.rollout} min="1" max="100" onChange={(e)=>update("rollout",Number(e.target.value))}/></label></div><input className="range" type="range" value={draft.rollout} min="1" max="100" onChange={(e)=>update("rollout",Number(e.target.value))}/><h4>Wirksamkeit</h4><label className="radio"><input type="radio" checked readOnly/>Geplant</label><div className="review-row"><label>Datum<input type="date" value={draft.date} onChange={(e)=>update("date",e.target.value)}/></label><label>Uhrzeit<input type="time" value={draft.time} onChange={(e)=>update("time",e.target.value)}/></label></div><h4>Genehmigungen (Vier-Augen-Prinzip)</h4><div className="approver"><i>LM</i><p><strong>Laura Müller</strong><span>Entwurf erstellt</span></p><time>10:20</time></div><div className="approver"><i>MK</i><p><strong>Markus Klein</strong><span>Senior Operator</span></p><em>Ausstehend</em></div><div className="impact"><p><strong>Abhängigkeiten & Auswirkungen</strong><span>2 abhängige Konfigurationen · geringes Risiko</span></p><em>Rollback möglich</em></div><button className="publish-request" onClick={()=>setRequested(true)}><Icon name={requested ? "CheckCircle" : "LockKey"}/>{requested ? "Freigabe angefordert" : "Veröffentlichung anfordern"}</button></aside>
    </div>
  </div>;
}

function ModuleWorkspace({ moduleId, campaigns }) {
  const module = moduleCatalog[moduleId] ?? moduleCatalog.analytics;
  return <div className="workspace module-workspace"><div className="workspace-heading"><div><p>CONTROL-CENTER-MODUL</p><h2>{module.title}</h2><small>{module.description}</small></div><button className="primary-action"><Icon name="Plus"/>{module.action}</button></div><section className="module-hero"><div><span>LIVE ÜBERSICHT</span><strong>{module.metric}</strong><small>{module.metricLabel}</small></div><div className="module-bars">{[62,78,54,88,69,93,74,84,96,82,91,98].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div></section><section className="module-table"><div className="panel-title">AKTUELLE AKTIVITÄT <button>Alle anzeigen <Icon name="ArrowRight"/></button></div>{(moduleId === "events" && campaigns?.length ? campaigns.slice(0,5).map(c=>[c.creative?.title ?? c.name,c.status,c.startsAt,c.createdBy]) : [["Konfiguration aktualisiert","Veröffentlicht","17.07.2026 · 10:22","Laura Müller"],["Freigabe angefordert","In Prüfung","17.07.2026 · 09:58","Markus Klein"],["Zeitplan angepasst","Geplant","17.07.2026 · 09:41","Anna Petersen"],["Export abgeschlossen","Erfolgreich","17.07.2026 · 08:12","System"]]).map((row,index)=><article key={index}><Icon name="ClockCounterClockwise"/><p><strong>{row[0]}</strong><span>{row[1]}</span></p><time>{String(row[2]).replace("T"," ").slice(0,16)}</time><small>{row[3]}</small><button><Icon name="DotsThree"/></button></article>)}</section></div>;
}

export function App() {
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    api("/admin/v1/operations/health", "local-admin-operations").then(setHealth).catch(()=>setHealth({status:"healthy"}));
    api("/admin/v1/liveops/campaigns", "local-admin-editor").then((body)=>setCampaigns(body.campaigns)).catch(()=>setCampaigns([]));
  }, []);
  const title = active === "dashboard" ? "Dashboard" : active === "slots" ? "Slots" : active === "remote-config" ? "Remote Config" : moduleCatalog[active]?.title ?? "Control Center";
  const content = useMemo(() => active === "dashboard" ? <Dashboard health={health}/> : active === "slots" ? <SlotsWorkspace/> : active === "remote-config" ? <RemoteConfigWorkspace/> : <ModuleWorkspace moduleId={active} campaigns={campaigns}/>, [active, health, campaigns]);
  const navigate = (id) => { setActive(id); setMobileOpen(false); };
  useEffect(() => { if (!search.trim()) return; const target = navigationGroups.flatMap(g=>g.items).find(item=>item.label.toLowerCase().includes(search.toLowerCase())); if (target && search.length > 2) setActive(target.id); }, [search]);
  return <div className={`app-shell ${collapsed ? "nav-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
    <Sidebar active={active} onChange={navigate} collapsed={collapsed} onCollapse={()=>setCollapsed(v=>!v)}/><div className="mobile-scrim" onClick={()=>setMobileOpen(false)}/>
    <Topbar title={title} onMenu={()=>setMobileOpen(true)} onSearch={setSearch}/>
    <main className="content">{content}</main>
  </div>;
}
