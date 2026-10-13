"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, CalendarClock, Check, ChevronDown, Clock3, MessageSquareText, MoreHorizontal, Phone, Plus, Search, TrendingUp, UserRound, UsersRound, X } from "lucide-react";
import type { Lead, LeadDetail, LeadStatus } from "@/lib/types";
import { statuses } from "@/lib/types";
import { leadPriorityGroup, nextLeadToContact, sortLeadGroup, type LeadSort, type PriorityGroup, validTime } from "@/lib/lead-priority";

type Filter = "All" | LeadStatus;
type QueueFilter = "all" | "today" | "overdue" | "upcoming" | "unscheduled" | "active";
type LeadAction = "view" | "note" | "reschedule" | "status";

function isOverdue(date: string, today = new Date()) {
  return new Date(date).getTime() < today.getTime();
}

function relativeTime(date: string) {
  if (validTime(date) === null) return "date unavailable";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  if (validTime(date) === null) return "Date unavailable";
  return new Date(date).toLocaleString(undefined, options || { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function localDateTime(date: string) {
  if (validTime(date) === null) return "";
  const value = new Date(date);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

// Portraits belong to the fictional seed records only. New leads retain initials.
const demoPortraits: Record<string, number> = {
  "Sarah Connor": 0,
  "Maya Patel": 8,
  "Daniel Kim": 3,
  "Priya Shah": 2,
  "Oliver Bennett": 6,
  "Ava Brooks": 4,
  "Noah Williams": 7,
};

function LeadAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const portrait = demoPortraits[name];
  const position = ["0%", "50%", "100%"];
  return <span className={`avatar ${large ? "avatar-large" : ""} ${portrait === undefined ? "" : "avatar-photo"}`} aria-hidden="true" style={portrait === undefined ? undefined : { backgroundPosition: `${position[portrait % 3]} ${position[Math.floor(portrait / 3)]}` }}>
    {portrait === undefined ? initials(name) : null}
  </span>;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } }); }
  catch { throw new Error("Network error. Please check your connection."); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result as T;
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`status status-${status.toLowerCase().replaceAll(" ", "-")}`}><span className="status-dot" />{status}</span>;
}

function LeadCard({ lead, group, selected, onOpen }: { lead: Lead; group: PriorityGroup; selected?: boolean; onOpen: (action: LeadAction) => void }) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  function quickAction(action: LeadAction) { if (moreRef.current) moreRef.current.open = false; onOpen(action); }
  const dueToday = group === "today";
  const followUp = validTime(lead.followUpAt) !== null ? lead.followUpAt : null;
  const overdue = followUp !== null && isOverdue(followUp);
  return <div className={`lead-card ${dueToday ? "lead-card-today" : ""} ${overdue ? "lead-card-overdue" : ""} ${selected ? "lead-card-selected" : ""}`}>
    <button className="lead-card-open" onClick={() => onOpen("view")} type="button" aria-label={`Open ${lead.name}'s timeline`}>
    <LeadAvatar name={lead.name} />
    <span className="lead-main">
      <span className="lead-heading"><strong>{lead.name}</strong>{lead.company && <span className="company">{lead.company}</span>}</span>
      <span className="lead-note">{lead.lastNote || "No conversation recorded yet"}</span>
      <span className="lead-meta"><Clock3 size={13} />{lead.lastDiscussionAt ? `Last discussion ${relativeTime(lead.lastDiscussionAt)}` : "No discussions yet"}</span>
    </span>
    <span className="card-end"><StatusBadge status={lead.status} /><span className={`due-block ${overdue ? "due-block-overdue" : dueToday ? "due-block-today" : ""}`}>
      {followUp ? <><span>{overdue ? "Overdue" : dueToday ? "Due today" : "Next follow-up"}</span><strong><CalendarClock size={14} />{formatDate(followUp, { hour: "numeric", minute: "2-digit", ...(dueToday ? {} : { month: "short", day: "numeric" }) })}</strong></> : <><span>No follow-up</span><strong>Not scheduled</strong></>}
    </span></span></button>
    <div className="lead-quick-actions">{lead.phone && <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`}><Phone size={14} /> Call</a>}<details className="lead-more" ref={moreRef}><summary aria-label={`More actions for ${lead.name}`}><MoreHorizontal size={18} /></summary><div className="lead-more-menu"><button type="button" onClick={() => quickAction("note")}>Log discussion</button><button type="button" onClick={() => quickAction("reschedule")}>{followUp ? "Reschedule follow-up" : "Schedule follow-up"}</button><button type="button" onClick={() => quickAction("status")}>Change status</button></div></details></div>
  </div>;
}

function ModalShell({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    (dialogRef.current?.querySelector<HTMLElement>("input, textarea, select") || dialogRef.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} tabIndex={-1}>{children}</div>
  </div>;
}

function AddLeadDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (lead: LeadDetail) => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>("/api/leads", { method: "POST", body: JSON.stringify({ name, company, phone }) }); onCreated(data.lead); }
    catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  return <ModalShell title="Add a new lead" onClose={onClose}>
    <div className="modal-header"><div><span className="eyebrow">YOUR PIPELINE</span><h2>Add a new lead</h2><p>Start a new relationship in your pipeline.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={save} className="form-body">
      <label>Full name <span className="required">*</span><input autoFocus required maxLength={120} placeholder="e.g. Alex Morgan" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Company <span className="optional">Optional</span><input maxLength={120} placeholder="e.g. Acme Corporation" value={company} onChange={(event) => setCompany(event.target.value)} /></label>
      <label>Phone <span className="optional">Optional</span><input type="tel" maxLength={40} placeholder="e.g. +1 (555) 000-0000" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <div className="form-hint">New leads start with the <strong>New</strong> status. You can change it later.</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button disabled={saving} className="button button-primary" type="submit">{saving ? "Creating…" : "Create lead"}<ArrowUpRight size={16} /></button></div>
    </form>
  </ModalShell>;
}

function LeadDialog({ leadId, initialAction, onClose, onChanged, onNotice, inline = false }: { leadId: number; initialAction: LeadAction; onClose: () => void; onChanged: (lead: LeadDetail) => void; onNotice: (message: string) => void; inline?: boolean }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteTime, setNoteTime] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const [showSchedule, setShowSchedule] = useState(initialAction === "reschedule");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; requestJson<{ lead: LeadDetail }>(`/api/leads/${leadId}`).then((data) => { if (active) { setLead(data.lead); setScheduleAt(data.lead.followUpAt ? localDateTime(data.lead.followUpAt) : ""); } }).catch((error) => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [leadId]);
  useEffect(() => { if (!lead) return; if (initialAction === "note") noteRef.current?.focus(); if (initialAction === "reschedule") scheduleRef.current?.focus(); if (initialAction === "status") statusRef.current?.focus(); }, [lead?.id, initialAction]);
  async function changeStatus(status: LeadStatus) {
    if (!lead || status === lead.status) return;
    setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setLead(data.lead); onChanged(data.lead); onNotice(`Status changed to ${status}.`); }
    catch (error) { setError((error as Error).message); }
  }
  async function saveNote(event: React.FormEvent) {
    event.preventDefault(); if (!lead) return;
    setSaving(true); setError("");
    try {
      if (!!noteDate !== !!noteTime) { setError("Choose both a follow-up date and time, or leave both blank."); return; }
      const followUpAt = noteDate && noteTime ? new Date(`${noteDate}T${noteTime}`).toISOString() : null;
      const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}/discussions`, { method: "POST", body: JSON.stringify({ note, followUpAt }) });
      setLead(data.lead); onChanged(data.lead); onNotice("Discussion saved."); setNote(""); setNoteDate(""); setNoteTime("");
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  async function saveSchedule(event: React.FormEvent) {
    event.preventDefault(); if (!lead || !scheduleAt) return;
    setScheduleSaving(true); setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ followUpAt: new Date(scheduleAt).toISOString() }) }); setLead(data.lead); onChanged(data.lead); onNotice("Follow-up saved."); setShowSchedule(false); }
    catch (error) { setError((error as Error).message); }
    finally { setScheduleSaving(false); }
  }
  async function clearSchedule() {
    if (!lead) return;
    setScheduleSaving(true); setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ followUpAt: null }) }); setLead(data.lead); onChanged(data.lead); onNotice("Follow-up cleared."); setScheduleAt(""); setShowSchedule(false); }
    catch (error) { setError((error as Error).message); }
    finally { setScheduleSaving(false); }
  }
  const content = <div className="detail-layout"><aside className="detail-aside"><div className="detail-aside-top"><span className="eyebrow">LEAD PROFILE</span><button className="icon-button detail-close" aria-label="Close" onClick={onClose}><X size={19} /></button></div><LeadAvatar name={lead?.name || "…"} large /><h2>{lead?.name || (loading ? "Loading…" : "Lead unavailable")}</h2><p className="detail-company">{lead?.company || "No company added"}</p>
      {lead && <><div className="detail-field"><span className="field-caption">PHONE</span>{lead.phone ? <a href={`tel:${lead.phone}`}><Phone size={15} />{lead.phone}</a> : <span>Not added</span>}</div><div className="detail-field"><span className="field-caption">CURRENT STATUS</span><select ref={statusRef} aria-label="Lead status" value={lead.status} onChange={(event) => changeStatus(event.target.value as LeadStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div className="detail-field next-follow"><span className="field-caption">NEXT FOLLOW-UP</span><strong className={lead.followUpAt && isOverdue(lead.followUpAt) ? "due-red" : ""}>{lead.followUpAt ? formatDate(lead.followUpAt) : "Not scheduled"}</strong><button className="schedule-toggle" type="button" onClick={() => { setScheduleAt(lead.followUpAt ? localDateTime(lead.followUpAt) : ""); setShowSchedule((value) => !value); }}>{lead.followUpAt ? "Reschedule" : "Schedule a follow-up"}</button></div></>}
      <p className="aside-caption">Keep the context. Move the conversation forward.</p></aside>
    <div className="detail-main">{lead && <>
      {showSchedule && <form className="schedule-panel" onSubmit={saveSchedule}><div><strong>Next follow-up</strong><span>Change the reminder without adding a discussion.</span></div><label>DATE & TIME<input ref={scheduleRef} type="datetime-local" required value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label><div className="schedule-actions">{lead.followUpAt && <button type="button" className="button button-ghost" disabled={scheduleSaving} onClick={clearSchedule}>Clear</button>}<button type="submit" className="button button-primary" disabled={scheduleSaving || !scheduleAt}>{scheduleSaving ? "Saving…" : "Save reminder"}</button></div></form>}
      <div className="timeline-area" ref={timelineRef}><section className="conversation-memory" aria-label="Conversation memory"><div><span className="eyebrow">CONVERSATION MEMORY</span><span className="memory-source">From recorded notes</span></div>{lead.discussions.length ? <><p className="memory-quote">“{lead.discussions[0].note}”</p><div className="memory-footer"><span>Last discussed {relativeTime(lead.discussions[0].createdAt)}</span><button type="button" onClick={() => timelineRef.current?.querySelector('.timeline-item')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>View original note <ArrowUpRight size={13} /></button></div></> : <p className="memory-empty">No discussion recorded yet. Add the first note below to build this lead’s history.</p>}</section><div className="section-title"><MessageSquareText size={17} /><h3>Discussion history</h3><span className="count-pill">{lead.discussions.length}</span></div>
        {lead.discussions.length ? <div className="timeline">{lead.discussions.map((discussion) => <div className="timeline-item" key={discussion.id}><div className="timeline-marker" /><div className="timeline-content"><span className="timeline-date">{formatDate(discussion.createdAt)} <span>· {relativeTime(discussion.createdAt)}</span></span><p>{discussion.note}</p>{discussion.followUpAt && <span className="timeline-follow"><CalendarClock size={14} /> Follow-up set for {formatDate(discussion.followUpAt)}</span>}</div></div>)}</div> : <div className="empty-timeline"><MessageSquareText size={24} /><strong>No conversations yet</strong><span>Record the first interaction below.</span></div>}
      </div>
      <form className="discussion-form" onSubmit={saveNote}><label htmlFor="note">ADD A DISCUSSION</label><div className="note-prompts" aria-label="Quick note starters">{["No answer", "Interested", "Needs more information", "Meeting scheduled", "Proposal discussed"].map((prompt) => <button key={prompt} type="button" onClick={() => { setNote((current) => current ? `${prompt} — ${current}` : `${prompt} — `); noteRef.current?.focus(); }}>{prompt}</button>)}</div><textarea id="note" ref={noteRef} placeholder="What did you discuss? Add context for your next conversation…" required maxLength={5000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /><div className="discussion-bottom"><div className="composer-schedule"><span><CalendarClock size={15} /> Optional follow-up</span><label>Date<input aria-label="Follow-up date" type="date" value={noteDate} required={!!noteTime} onChange={(event) => setNoteDate(event.target.value)} /></label><label>Time<input aria-label="Follow-up time" type="time" value={noteTime} required={!!noteDate} onChange={(event) => setNoteTime(event.target.value)} /></label></div><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save discussion"}<ArrowUpRight size={16} /></button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
    </>}
    {!lead && error && <p className="form-error dialog-load-error" role="alert">{error}</p>}
    </div></div>;
  return inline ? <div className="inline-detail" aria-label="Selected lead details">{content}</div> : <ModalShell title="Lead discussion timeline" onClose={onClose} wide>{content}</ModalShell>;
}

export default function LeadFlow({ showLogout = false }: { showLogout?: boolean }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [sort, setSort] = useState<LeadSort>("follow-up");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<{ id: number; action: LeadAction } | null>(null);
  const [splitView, setSplitView] = useState(true);
  const [canSplit, setCanSplit] = useState(false);
  const [dateLabel, setDateLabel] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  const closeAdd = useCallback(() => setShowAdd(false), []);
  const closeSelected = useCallback(() => setSelected(null), []);
  const refresh = useCallback(async () => {
    try { const data = await requestJson<{ leads: Lead[] }>("/api/leads"); setLeads(data.leads); setLoadError(""); }
    catch (error) { setLoadError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setDateLabel(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const media = window.matchMedia("(min-width: 1050px)"); const update = () => setCanSplit(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || selected !== null || showAdd) return;
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key.toLowerCase() === "n") { event.preventDefault(); setShowAdd(true); }
    }
    document.addEventListener("keydown", shortcuts);
    return () => document.removeEventListener("keydown", shortcuts);
  }, [selected, showAdd]);
  function changed(lead: LeadDetail) { setLeads((previous) => { const rest = previous.filter((item) => item.id !== lead.id); return [lead, ...rest]; }); }
  const visible = useMemo(() => leads.filter((lead) => {
    const group = leadPriorityGroup(lead, now);
    const matchesText = [lead.name, lead.company, lead.phone].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()));
    const overdue = group !== "closed" && validTime(lead.followUpAt) !== null && isOverdue(lead.followUpAt!, now);
    return matchesText && (filter === "All" || lead.status === filter) && (queueFilter === "all" || (queueFilter === "active" ? group !== "closed" : queueFilter === "overdue" ? overdue : group === queueFilter));
  }), [leads, filter, search, queueFilter, now]);
  const groupOrder: { key: PriorityGroup; label: string }[] = [
    { key: "today", label: "TODAY'S FOLLOW-UPS" }, { key: "overdue", label: "OVERDUE" },
    { key: "upcoming", label: "UPCOMING" }, { key: "unscheduled", label: "NO FOLLOW-UP SCHEDULED" },
    { key: "closed", label: "CLOSED" },
  ];
  const groups = groupOrder.map((group) => ({ ...group, leads: sortLeadGroup(visible.filter((lead) => leadPriorityGroup(lead, now) === group.key), group.key, sort) }));
  const activeCount = leads.filter((lead) => leadPriorityGroup(lead, now) !== "closed").length;
  const todayCount = leads.filter((lead) => leadPriorityGroup(lead, now) === "today").length;
  const overdueCount = leads.filter((lead) => leadPriorityGroup(lead, now) !== "closed" && validTime(lead.followUpAt) !== null && isOverdue(lead.followUpAt!, now)).length;
  const recommendation = nextLeadToContact(leads, now);
  const hasFilters = filter !== "All" || queueFilter !== "all" || search.trim() !== "" || sort !== "follow-up";
  function clearFilters() { setFilter("All"); setQueueFilter("all"); setSearch(""); setSort("follow-up"); }
  function chooseQueue(next: QueueFilter) { setQueueFilter(next); }
  function openLead(id: number, action: LeadAction) { setSelected({ id, action }); }
  function moveThroughList(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "j" && event.key !== "k" && event.key !== "J" && event.key !== "K") return;
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(".lead-card-open") || []);
    if (!rows.length) return;
    event.preventDefault();
    const current = rows.findIndex((row) => row === document.activeElement);
    const next = event.key.toLowerCase() === "j" ? Math.min(current + 1, rows.length - 1) : Math.max(current < 0 ? rows.length - 1 : current - 1, 0);
    rows[next].focus();
  }
  const useSplit = canSplit && splitView;
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><a className="brand" href="/"><span className="brand-mark"><TrendingUp size={21} strokeWidth={2.7} /></span><span>Lead<span>Flow</span></span></a><span className="topbar-label">Your workspace</span>{showLogout && <button className="signout" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/login"; }}>Sign out</button>}<button className="button button-primary top-add" onClick={() => setShowAdd(true)}><Plus size={17} /> Add new lead</button></div></header>
    <main className="main-content">
      <div className="welcome"><div><div className="welcome-kicker"><span className="live-dot" /> PRAVARAI / SALES WORKSPACE {dateLabel && <><span className="kicker-separator">·</span> {dateLabel}</>}</div><h1>Your follow-up worklist<span className="heading-period">.</span></h1><p>The right conversation, at the right time.</p></div></div>
      <div className="stats-grid"><button type="button" aria-pressed={queueFilter === "today"} onClick={() => chooseQueue("today")} className={`stat-card stat-priority ${queueFilter === "today" ? "stat-selected" : ""}`}><span className="stat-icon stat-orange"><Bell size={19} /></span><span className="stat-content"><span className="stat-label">Due today</span><strong>{todayCount}</strong></span></button><button type="button" aria-pressed={queueFilter === "overdue"} onClick={() => chooseQueue("overdue")} className={`stat-card stat-priority stat-alert ${queueFilter === "overdue" ? "stat-selected" : ""}`}><span className="stat-icon stat-red"><Clock3 size={19} /></span><span className="stat-content"><span className="stat-label">Overdue</span><strong>{overdueCount}</strong></span></button><button type="button" aria-pressed={queueFilter === "all"} onClick={() => chooseQueue("all")} className={`stat-card ${queueFilter === "all" ? "stat-selected" : ""}`}><span className="stat-icon stat-blue"><UsersRound size={19} /></span><span className="stat-content"><span className="stat-label">Total leads</span><strong>{leads.length}</strong></span></button><button type="button" aria-pressed={queueFilter === "active"} onClick={() => chooseQueue("active")} className={`stat-card ${queueFilter === "active" ? "stat-selected" : ""}`}><span className="stat-icon stat-purple"><TrendingUp size={19} /></span><span className="stat-content"><span className="stat-label">Active leads</span><strong>{activeCount}</strong></span></button></div>
      <section className="next-action" aria-label="Next best action"><div className="next-action-label"><span className="eyebrow">NEXT BEST ACTION</span><span>Based on follow-up dates and activity</span></div>{loading ? <p className="next-action-empty">Finding your next follow-up…</p> : recommendation ? <div className="next-action-body"><LeadAvatar name={recommendation.lead.name} large /><div className="next-action-copy"><div className="next-action-identity"><strong>{recommendation.lead.name}</strong>{recommendation.lead.company && <span>{recommendation.lead.company}</span>}<StatusBadge status={recommendation.lead.status} /></div><p>{recommendation.lead.lastNote || "No conversation recorded yet."}</p><div className="next-action-context"><span><CalendarClock size={14} />{recommendation.lead.followUpAt && validTime(recommendation.lead.followUpAt) !== null ? formatDate(recommendation.lead.followUpAt) : "No follow-up scheduled"}</span><span>{recommendation.group === "overdue" ? "Oldest missed follow-up in your active pipeline." : recommendation.group === "today" ? "Next follow-up due today." : recommendation.group === "upcoming" ? "Earliest upcoming follow-up." : "No follow-up is scheduled; review this relationship."}</span></div></div><div className="next-action-buttons"><button type="button" className="button button-primary" onClick={() => openLead(recommendation.lead.id, "view")}>Open lead <ArrowUpRight size={15} /></button><button type="button" className="button button-ghost" onClick={() => openLead(recommendation.lead.id, "reschedule")}>Reschedule</button></div></div> : <p className="next-action-empty">No active leads need attention. New leads will appear here.</p>}</section>
      <section className="leads-panel"><div className="panel-top"><div><span className="eyebrow">YOUR WORKLIST</span><h2>Leads <span className="heading-count">{visible.length}</span></h2><p className="panel-intro">Today’s follow-ups first, then missed reminders and what is coming next.</p></div><div className="panel-actions"><label className="search-box"><Search size={18} /><input ref={searchRef} placeholder="Search name, company or phone" aria-label="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</label><button className="button button-primary mobile-add" onClick={() => setShowAdd(true)}><Plus size={17} /> Add lead</button></div></div>
        <div className="filters" aria-label="Filter leads by status">{(["All", ...statuses] as Filter[]).map((item) => <button key={item} type="button" aria-pressed={filter === item} className={`filter ${filter === item ? "filter-active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <div className="worklist-controls"><label>Priority <span className="select-wrap"><select aria-label="Filter by follow-up priority" value={queueFilter} onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}><option value="all">All priorities</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="upcoming">Upcoming</option><option value="unscheduled">No follow-up</option><option value="active">Active leads</option></select><ChevronDown size={14} /></span></label><label>Sort <span className="select-wrap"><select aria-label="Sort leads" value={sort} onChange={(event) => setSort(event.target.value as LeadSort)}><option value="follow-up">Next follow-up</option><option value="discussion">Latest discussion</option><option value="added">Recently added</option></select><ChevronDown size={14} /></span></label>{hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}<button type="button" className="view-toggle" aria-pressed={splitView} onClick={() => setSplitView((value) => !value)}>{splitView ? "Split view on" : "Split view off"}</button><span className="keyboard-hint">J / K to move · Enter to open</span></div>
        {notice && <div className="notice" role="status"><Check size={15} />{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></div>}
        {loadError && <div className="load-error" role="alert">{loadError} <button onClick={refresh}>Retry</button></div>}
        <div className={useSplit ? "workspace-grid workspace-grid-split" : "workspace-grid"}><div className="worklist-column">{loading ? <div className="loading-list"><div /><div /><div /></div> : <div className="lead-sections" ref={listRef} onKeyDown={moveThroughList}>
          {groups.filter((group) => group.leads.length > 0).map((group) => <section className="lead-group" key={group.key}><div className={`group-label group-${group.key}`}><span>{group.key === "overdue" ? <Clock3 size={15} /> : group.key === "today" ? <Bell size={15} /> : group.key === "upcoming" ? <CalendarClock size={15} /> : <UserRound size={15} />}{group.label}</span><span className="group-count">{group.leads.length}</span></div><div className="cards">{group.leads.map((lead) => <LeadCard key={lead.id} lead={lead} group={group.key} selected={useSplit && selected?.id === lead.id} onOpen={(action) => openLead(lead.id, action)} />)}</div></section>)}
          {visible.length === 0 && <div className="empty-list"><span className="empty-icon"><Search size={25} /></span><h3>{leads.length ? "No leads match these filters" : "Your pipeline starts here"}</h3><p>{leads.length ? "Try a different search or clear the filters." : "Add your first lead and keep the conversation moving."}</p>{leads.length ? <button className="button button-ghost" onClick={clearFilters}>Clear filters</button> : <button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add a lead</button>}</div>}
        </div>}</div>{useSplit && <div className="detail-column">{selected ? <LeadDialog key={`${selected.id}-${selected.action}`} leadId={selected.id} initialAction={selected.action} onClose={closeSelected} onChanged={changed} onNotice={setNotice} inline /> : <div className="split-empty"><MessageSquareText size={22} /><strong>Pick a conversation</strong><p>Select a lead to see its latest note, full history, and next follow-up here.</p><span>The worklist stays in place while you move between leads.</span></div>}</div>}</div>
      </section>
      <footer className="footer"><span className="brand-footer"><TrendingUp size={16} /> LeadFlow</span><span>Built to keep the next conversation moving.</span><span>Made for PravarAI <Check size={14} /></span></footer>
    </main>
    {showAdd && <AddLeadDialog onClose={closeAdd} onCreated={(lead) => { changed(lead); setNotice(`${lead.name} added to the pipeline.`); closeAdd(); }} />}
    {selected !== null && !useSplit && <LeadDialog key={`${selected.id}-${selected.action}`} leadId={selected.id} initialAction={selected.action} onClose={closeSelected} onChanged={changed} onNotice={setNotice} />}
  </div>;
}
