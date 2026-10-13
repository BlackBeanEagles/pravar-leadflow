"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, CalendarClock, Check, ChevronRight, Clock3, MessageSquareText, Phone, Plus, Search, TrendingUp, UserRound, UsersRound, X } from "lucide-react";
import type { Lead, LeadDetail, LeadStatus } from "@/lib/types";
import { statuses } from "@/lib/types";

type Filter = "All" | LeadStatus;
type QueueFilter = "all" | "today" | "overdue" | "active";
type LeadAction = "view" | "note" | "reschedule";

function sameLocalDay(date: string, today = new Date()) {
  const value = new Date(date);
  return value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
}

function isOverdue(date: string, today = new Date()) {
  return new Date(date).getTime() < today.getTime();
}

function relativeTime(date: string) {
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
  return new Date(date).toLocaleString(undefined, options || { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function localDateTime(date: string) {
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

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (action: LeadAction) => void }) {
  const dueToday = !!lead.followUpAt && sameLocalDay(lead.followUpAt);
  const overdue = !!lead.followUpAt && isOverdue(lead.followUpAt);
  return <div className={`lead-card ${dueToday ? "lead-card-today" : ""} ${overdue ? "lead-card-overdue" : ""}`}>
    <button className="lead-card-open" onClick={() => onOpen("view")} type="button" aria-label={`Open ${lead.name}'s timeline`}>
    <LeadAvatar name={lead.name} />
    <span className="lead-main">
      <span className="lead-heading"><strong>{lead.name}</strong>{lead.company && <span className="company">{lead.company}</span>}</span>
      <span className="lead-note">{lead.lastNote || "No discussions yet. Open to add the first note."}</span>
      <span className="lead-meta"><Clock3 size={13} />{lead.lastDiscussionAt ? `Last discussion ${relativeTime(lead.lastDiscussionAt)}` : "No discussions yet"}</span>
    </span>
    <span className="card-end"><StatusBadge status={lead.status} /><span className={`due-block ${overdue ? "due-block-overdue" : dueToday ? "due-block-today" : ""}`}>
      {lead.followUpAt ? <><span>{overdue ? "Needs follow-up" : dueToday ? "Call today" : "Next follow-up"}</span><strong><CalendarClock size={14} />{formatDate(lead.followUpAt, { hour: "numeric", minute: "2-digit", ...(dueToday ? {} : { month: "short", day: "numeric" }) })}</strong></> : <><span>No follow-up</span><strong>—</strong></>}
    </span><ChevronRight size={18} className="card-chevron" /></span></button>
    <div className="lead-quick-actions">{lead.phone && <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`}><Phone size={13} /> Call</a>}<button type="button" onClick={() => onOpen("note")}><MessageSquareText size={13} /> Log note</button><button type="button" onClick={() => onOpen("reschedule")}><CalendarClock size={13} /> {lead.followUpAt ? "Reschedule" : "Schedule"}</button></div>
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

function LeadDialog({ leadId, initialAction, onClose, onChanged }: { leadId: number; initialAction: LeadAction; onClose: () => void; onChanged: (lead: LeadDetail) => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const followUpRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const scheduleRef = useRef<HTMLInputElement>(null);
  const [showSchedule, setShowSchedule] = useState(initialAction === "reschedule");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; requestJson<{ lead: LeadDetail }>(`/api/leads/${leadId}`).then((data) => { if (active) { setLead(data.lead); setScheduleAt(data.lead.followUpAt ? localDateTime(data.lead.followUpAt) : ""); } }).catch((error) => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [leadId]);
  useEffect(() => { if (!lead) return; if (initialAction === "note") noteRef.current?.focus(); if (initialAction === "reschedule") scheduleRef.current?.focus(); }, [lead?.id, initialAction]);
  async function changeStatus(status: LeadStatus) {
    if (!lead || status === lead.status) return;
    setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setLead(data.lead); onChanged(data.lead); }
    catch (error) { setError((error as Error).message); }
  }
  async function saveNote(event: React.FormEvent) {
    event.preventDefault(); if (!lead) return;
    setSaving(true); setError("");
    try {
      const followUpValue = followUpRef.current?.value || "";
      const followUpAt = followUpValue ? new Date(followUpValue).toISOString() : null;
      const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}/discussions`, { method: "POST", body: JSON.stringify({ note, followUpAt }) });
      setLead(data.lead); onChanged(data.lead); setNote(""); if (followUpRef.current) followUpRef.current.value = "";
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  async function saveSchedule(event: React.FormEvent) {
    event.preventDefault(); if (!lead || !scheduleAt) return;
    setScheduleSaving(true); setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ followUpAt: new Date(scheduleAt).toISOString() }) }); setLead(data.lead); onChanged(data.lead); setShowSchedule(false); }
    catch (error) { setError((error as Error).message); }
    finally { setScheduleSaving(false); }
  }
  async function clearSchedule() {
    if (!lead) return;
    setScheduleSaving(true); setError("");
    try { const data = await requestJson<{ lead: LeadDetail }>(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ followUpAt: null }) }); setLead(data.lead); onChanged(data.lead); setScheduleAt(""); setShowSchedule(false); }
    catch (error) { setError((error as Error).message); }
    finally { setScheduleSaving(false); }
  }
  return <ModalShell title="Lead discussion timeline" onClose={onClose} wide>
    <div className="detail-layout"><aside className="detail-aside"><div className="detail-aside-top"><span className="eyebrow">LEAD PROFILE</span><button className="icon-button detail-close" aria-label="Close" onClick={onClose}><X size={19} /></button></div><LeadAvatar name={lead?.name || "…"} large /><h2>{lead?.name || (loading ? "Loading…" : "Lead unavailable")}</h2><p className="detail-company">{lead?.company || "No company added"}</p>
      {lead && <><div className="detail-field"><span className="field-caption">PHONE</span>{lead.phone ? <a href={`tel:${lead.phone}`}><Phone size={15} />{lead.phone}</a> : <span>Not added</span>}</div><div className="detail-field"><span className="field-caption">CURRENT STATUS</span><select aria-label="Lead status" value={lead.status} onChange={(event) => changeStatus(event.target.value as LeadStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div className="detail-field next-follow"><span className="field-caption">NEXT FOLLOW-UP</span><strong className={lead.followUpAt && isOverdue(lead.followUpAt) ? "due-red" : ""}>{lead.followUpAt ? formatDate(lead.followUpAt) : "Not scheduled"}</strong><button className="schedule-toggle" type="button" onClick={() => { setScheduleAt(lead.followUpAt ? localDateTime(lead.followUpAt) : ""); setShowSchedule((value) => !value); }}>{lead.followUpAt ? "Reschedule" : "Schedule a follow-up"}</button></div></>}
      <p className="aside-caption">Keep the context. Move the conversation forward.</p></aside>
    <div className="detail-main">{lead && <>
      {showSchedule && <form className="schedule-panel" onSubmit={saveSchedule}><div><strong>Next follow-up</strong><span>Change the reminder without adding a discussion.</span></div><label>DATE & TIME<input ref={scheduleRef} type="datetime-local" required value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label><div className="schedule-actions">{lead.followUpAt && <button type="button" className="button button-ghost" disabled={scheduleSaving} onClick={clearSchedule}>Clear</button>}<button type="submit" className="button button-primary" disabled={scheduleSaving || !scheduleAt}>{scheduleSaving ? "Saving…" : "Save reminder"}</button></div></form>}
      <div className="timeline-area"><div className="section-title"><MessageSquareText size={17} /><h3>Discussion history</h3><span className="count-pill">{lead.discussions.length}</span></div>
        {lead.discussions.length ? <div className="timeline">{lead.discussions.map((discussion) => <div className="timeline-item" key={discussion.id}><div className="timeline-marker" /><div className="timeline-content"><span className="timeline-date">{formatDate(discussion.createdAt)} <span>· {relativeTime(discussion.createdAt)}</span></span><p>{discussion.note}</p>{discussion.followUpAt && <span className="timeline-follow"><CalendarClock size={14} /> Follow-up set for {formatDate(discussion.followUpAt)}</span>}</div></div>)}</div> : <div className="empty-timeline"><MessageSquareText size={24} /><strong>No discussions yet</strong><span>Write the first note below to get started.</span></div>}
      </div>
      <form className="discussion-form" onSubmit={saveNote}><label htmlFor="note">ADD A DISCUSSION</label><textarea id="note" ref={noteRef} placeholder="What did you discuss? Add context for your next conversation…" required maxLength={5000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /><div className="discussion-bottom"><label className="date-field"><CalendarClock size={16} /><span>Follow-up</span><input aria-label="Follow-up date and time" type="datetime-local" ref={followUpRef} /></label><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save discussion"}<ArrowUpRight size={16} /></button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
    </>}
    {!lead && error && <p className="form-error dialog-load-error" role="alert">{error}</p>}
    </div></div>
  </ModalShell>;
}

export default function LeadFlow({ showLogout = false }: { showLogout?: boolean }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<{ id: number; action: LeadAction } | null>(null);
  const [dateLabel, setDateLabel] = useState("");
  const closeAdd = useCallback(() => setShowAdd(false), []);
  const closeSelected = useCallback(() => setSelected(null), []);
  const refresh = useCallback(async () => {
    try { const data = await requestJson<{ leads: Lead[] }>("/api/leads"); setLeads(data.leads); setLoadError(""); }
    catch (error) { setLoadError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setDateLabel(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })); }, []);
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
  const visible = useMemo(() => leads.filter((lead) => (filter === "All" || lead.status === filter) && [lead.name, lead.company, lead.phone].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())) && (queueFilter === "all" || (queueFilter === "today" && !!lead.followUpAt && sameLocalDay(lead.followUpAt)) || (queueFilter === "overdue" && !!lead.followUpAt && isOverdue(lead.followUpAt)) || (queueFilter === "active" && lead.status !== "Won" && lead.status !== "Lost"))), [leads, filter, search, queueFilter]);
  const today = visible.filter((lead) => queueFilter !== "overdue" && lead.followUpAt && sameLocalDay(lead.followUpAt));
  const overdue = visible.filter((lead) => lead.followUpAt && (queueFilter === "overdue" || !sameLocalDay(lead.followUpAt)) && isOverdue(lead.followUpAt));
  const rest = visible.filter((lead) => !today.includes(lead) && !overdue.includes(lead));
  const open = leads.filter((lead) => lead.status !== "Won" && lead.status !== "Lost").length;
  function chooseQueue(next: QueueFilter) { setQueueFilter(next); if (next === "all") { setFilter("All"); setSearch(""); } }
  function openLead(id: number, action: LeadAction) { setSelected({ id, action }); }
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><a className="brand" href="/"><span className="brand-mark"><TrendingUp size={21} strokeWidth={2.7} /></span><span>Lead<span>Flow</span></span></a><span className="topbar-label">Your workspace</span>{showLogout && <button className="signout" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/login"; }}>Sign out</button>}<button className="button button-primary top-add" onClick={() => setShowAdd(true)}><Plus size={17} /> Add new lead</button></div></header>
    <main className="main-content">
      <div className="welcome"><div><div className="welcome-kicker"><span className="live-dot" /> PRAVARAI / SALES WORKSPACE {dateLabel && <><span className="kicker-separator">·</span> {dateLabel}</>}</div><h1>Keep the next conversation moving<span className="heading-period">.</span></h1><p>Start with the people waiting to hear from you.</p></div></div>
      <div className="stats-grid"><button type="button" aria-pressed={queueFilter === "today"} onClick={() => chooseQueue("today")} className={`stat-card stat-priority ${queueFilter === "today" ? "stat-selected" : ""}`}><span className="stat-icon stat-orange"><Bell size={19} /></span><span className="stat-content"><span className="stat-label">Due today</span><strong>{leads.filter((lead) => lead.followUpAt && sameLocalDay(lead.followUpAt)).length}</strong></span></button><button type="button" aria-pressed={queueFilter === "overdue"} onClick={() => chooseQueue("overdue")} className={`stat-card stat-priority stat-alert ${queueFilter === "overdue" ? "stat-selected" : ""}`}><span className="stat-icon stat-red"><Clock3 size={19} /></span><span className="stat-content"><span className="stat-label">Overdue</span><strong>{leads.filter((lead) => lead.followUpAt && isOverdue(lead.followUpAt)).length}</strong></span></button><button type="button" aria-pressed={queueFilter === "all"} onClick={() => chooseQueue("all")} className={`stat-card ${queueFilter === "all" ? "stat-selected" : ""}`}><span className="stat-icon stat-blue"><UsersRound size={19} /></span><span className="stat-content"><span className="stat-label">All leads</span><strong>{leads.length}</strong></span></button><button type="button" aria-pressed={queueFilter === "active"} onClick={() => chooseQueue("active")} className={`stat-card ${queueFilter === "active" ? "stat-selected" : ""}`}><span className="stat-icon stat-purple"><TrendingUp size={19} /></span><span className="stat-content"><span className="stat-label">In progress</span><strong>{open}</strong></span></button></div>
      <section className="leads-panel"><div className="panel-top"><div><span className="eyebrow">YOUR WORKLIST</span><h2>Follow-up queue <span className="heading-count">{visible.length}</span></h2><p className="panel-intro">Today’s conversations first, with every lead one click away.</p></div><div className="panel-actions"><label className="search-box"><Search size={18} /><input ref={searchRef} placeholder="Search name, company or phone" aria-label="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</label><button className="button button-primary mobile-add" onClick={() => setShowAdd(true)}><Plus size={17} /> Add lead</button></div></div>
        <div className="filters" aria-label="Filter leads by status">{(["All", ...statuses] as Filter[]).map((item) => <button key={item} type="button" className={`filter ${filter === item ? "filter-active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
        {loadError && <div className="load-error" role="alert">{loadError} <button onClick={refresh}>Retry</button></div>}
        {loading ? <div className="loading-list"><div /><div /><div /></div> : <div className="lead-sections">
          {today.length > 0 && <section className="lead-group"><div className="group-label group-today"><span><Bell size={15} /> TODAY’S FOLLOW-UPS</span><span className="group-count">{today.length}</span></div><div className="cards">{today.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={(action) => openLead(lead.id, action)} />)}</div></section>}
          {overdue.length > 0 && <section className="lead-group"><div className="group-label group-overdue"><span><Clock3 size={15} /> OVERDUE FOLLOW-UPS</span><span className="group-count">{overdue.length}</span></div><div className="cards">{overdue.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={(action) => openLead(lead.id, action)} />)}</div></section>}
          {rest.length > 0 && <section className="lead-group"><div className="group-label"><span><UserRound size={15} /> ALL LEADS</span><span className="group-count">{rest.length}</span></div><div className="cards">{rest.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={(action) => openLead(lead.id, action)} />)}</div></section>}
          {visible.length === 0 && <div className="empty-list"><span className="empty-icon"><Search size={25} /></span><h3>{leads.length ? "No matching leads" : "Your pipeline starts here"}</h3><p>{leads.length ? "Try another search or status filter." : "Add your first lead and keep the conversation moving."}</p>{!leads.length && <button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add a lead</button>}</div>}
        </div>}
      </section>
      <footer className="footer"><span className="brand-footer"><TrendingUp size={16} /> LeadFlow</span><span>Built to keep the next conversation moving.</span><span>Made for PravarAI <Check size={14} /></span></footer>
    </main>
    {showAdd && <AddLeadDialog onClose={closeAdd} onCreated={(lead) => { changed(lead); closeAdd(); }} />}
    {selected !== null && <LeadDialog leadId={selected.id} initialAction={selected.action} onClose={closeSelected} onChanged={changed} />}
  </div>;
}
