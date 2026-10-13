"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Bell, CalendarClock, Check, ChevronRight, Clock3, Command, MessageSquareText, Plus, Search, TrendingUp, UserRound, UsersRound, X } from "lucide-react";
import type { Lead, LeadDetail, LeadStatus } from "@/lib/types";
import { statuses } from "@/lib/types";

type Filter = "All" | LeadStatus;

function sameLocalDay(date: string, today = new Date()) {
  const value = new Date(date);
  return value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
}

function isOverdue(date: string, today = new Date()) {
  const value = new Date(date);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return value < startOfToday;
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

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
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

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const dueToday = !!lead.followUpAt && sameLocalDay(lead.followUpAt);
  const overdue = !!lead.followUpAt && isOverdue(lead.followUpAt);
  return <button className={`lead-card ${dueToday ? "lead-card-today" : ""} ${overdue ? "lead-card-overdue" : ""}`} onClick={onClick} type="button">
    <span className="avatar">{initials(lead.name)}</span>
    <span className="lead-main">
      <span className="lead-heading"><strong>{lead.name}</strong>{lead.company && <span className="company">{lead.company}</span>}</span>
      <span className="lead-note">{lead.lastNote || "No discussions yet. Open to add the first note."}</span>
      <span className="lead-meta"><Clock3 size={13} />{lead.lastDiscussionAt ? `Last discussion ${relativeTime(lead.lastDiscussionAt)}` : "No discussions yet"}
        {lead.followUpAt && <span className={`follow-inline ${overdue ? "overdue" : ""}`}><span className="meta-separator">·</span><CalendarClock size={13} />{overdue ? "Overdue" : dueToday ? "Today" : "Follow-up"} {formatDate(lead.followUpAt, { hour: "numeric", minute: "2-digit", ...(dueToday ? {} : { month: "short", day: "numeric" }) })}</span>}
      </span>
    </span>
    <span className="card-end"><StatusBadge status={lead.status} /><ChevronRight size={18} className="card-chevron" /></span>
  </button>;
}

function ModalShell({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    (dialogRef.current?.querySelector<HTMLElement>("input, textarea, select") || dialogRef.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>{children}</div>
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

function LeadDialog({ leadId, onClose, onChanged }: { leadId: number; onClose: () => void; onChanged: (lead: LeadDetail) => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const followUpRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; requestJson<{ lead: LeadDetail }>(`/api/leads/${leadId}`).then((data) => { if (active) setLead(data.lead); }).catch((error) => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [leadId]);
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
  return <ModalShell title="Lead discussion timeline" onClose={onClose} wide>
    <div className="modal-header detail-header"><div className="detail-identity"><span className="avatar avatar-large">{lead ? initials(lead.name) : "…"}</span><div><span className="eyebrow">LEAD PROFILE</span><h2>{lead?.name || (loading ? "Loading…" : "Lead unavailable")}</h2><p>{[lead?.company, lead?.phone].filter(Boolean).join(" · ") || "Keep every conversation in one place"}</p></div></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>
    {lead && <><div className="detail-toolbar"><div><span className="field-caption">CURRENT STATUS</span><select aria-label="Lead status" value={lead.status} onChange={(event) => changeStatus(event.target.value as LeadStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div className="next-follow"><span className="field-caption">NEXT FOLLOW-UP</span><span className={lead.followUpAt && isOverdue(lead.followUpAt) ? "due-red" : ""}>{lead.followUpAt ? formatDate(lead.followUpAt) : "Not scheduled"}</span></div></div>
      <div className="timeline-area"><div className="section-title"><MessageSquareText size={17} /><h3>Discussion history</h3><span className="count-pill">{lead.discussions.length}</span></div>
        {lead.discussions.length ? <div className="timeline">{lead.discussions.map((discussion) => <div className="timeline-item" key={discussion.id}><div className="timeline-marker" /><div className="timeline-content"><span className="timeline-date">{formatDate(discussion.createdAt)} <span>· {relativeTime(discussion.createdAt)}</span></span><p>{discussion.note}</p>{discussion.followUpAt && <span className="timeline-follow"><CalendarClock size={14} /> Follow-up set for {formatDate(discussion.followUpAt)}</span>}</div></div>)}</div> : <div className="empty-timeline"><MessageSquareText size={24} /><strong>No discussions yet</strong><span>Write the first note below to get started.</span></div>}
      </div>
      <form className="discussion-form" onSubmit={saveNote}><label htmlFor="note">ADD A DISCUSSION</label><textarea id="note" placeholder="What did you discuss? Add context for your next conversation…" required maxLength={5000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /><div className="discussion-bottom"><label className="date-field"><CalendarClock size={16} /><span>Follow-up</span><input aria-label="Follow-up date and time" type="datetime-local" ref={followUpRef} /></label><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save discussion"}<ArrowUpRight size={16} /></button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
    </>}
    {!lead && error && <p className="form-error dialog-load-error" role="alert">{error}</p>}
  </ModalShell>;
}

export default function LeadFlow({ showLogout = false }: { showLogout?: boolean }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
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
  function changed(lead: LeadDetail) { setLeads((previous) => { const rest = previous.filter((item) => item.id !== lead.id); return [lead, ...rest]; }); }
  const visible = useMemo(() => leads.filter((lead) => (filter === "All" || lead.status === filter) && lead.name.toLowerCase().includes(search.trim().toLowerCase())), [leads, filter, search]);
  const today = visible.filter((lead) => lead.followUpAt && sameLocalDay(lead.followUpAt));
  const overdue = visible.filter((lead) => lead.followUpAt && isOverdue(lead.followUpAt));
  const rest = visible.filter((lead) => !lead.followUpAt || (!sameLocalDay(lead.followUpAt) && !isOverdue(lead.followUpAt)));
  const open = leads.filter((lead) => lead.status !== "Won" && lead.status !== "Lost").length;
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><a className="brand" href="/"><span className="brand-mark"><TrendingUp size={21} strokeWidth={2.7} /></span><span>Lead<span>Flow</span></span></a><span className="topbar-label">Your workspace</span>{showLogout && <button className="signout" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/login"; }}>Sign out</button>}<button className="button button-primary top-add" onClick={() => setShowAdd(true)}><Plus size={17} /> Add new lead</button></div></header>
    <main className="main-content">
      <div className="welcome"><div><div className="welcome-kicker"><span className="live-dot" /> SALES WORKSPACE {dateLabel && <><span className="kicker-separator">/</span> {dateLabel}</>}</div><h1>Your lead desk<span className="heading-period">.</span></h1><p>Conversations, statuses, and follow-ups in one clear view.</p></div><div className="welcome-decoration"><span className="decoration-ring" /><TrendingUp size={63} strokeWidth={1.1} /></div></div>
      <div className="stats-grid"><div className="stat-card"><span className="stat-icon stat-blue"><UsersRound size={19} /></span><div><span className="stat-label">Total leads</span><strong>{leads.length}</strong></div><ArrowUpRight size={16} className="stat-arrow" /></div><div className="stat-card"><span className="stat-icon stat-purple"><Command size={19} /></span><div><span className="stat-label">Active pipeline</span><strong>{open}</strong></div><ArrowUpRight size={16} className="stat-arrow" /></div><div className="stat-card"><span className="stat-icon stat-orange"><Bell size={19} /></span><div><span className="stat-label">Due today</span><strong>{leads.filter((lead) => lead.followUpAt && sameLocalDay(lead.followUpAt)).length}</strong></div><ArrowDownRight size={16} className="stat-arrow" /></div><div className="stat-card"><span className="stat-icon stat-red"><Clock3 size={19} /></span><div><span className="stat-label">Overdue</span><strong>{leads.filter((lead) => lead.followUpAt && isOverdue(lead.followUpAt)).length}</strong></div><ArrowUpRight size={16} className="stat-arrow" /></div></div>
      <section className="leads-panel"><div className="panel-top"><div><span className="eyebrow">YOUR PIPELINE</span><h2>Leads <span className="heading-count">{visible.length}</span></h2></div><div className="panel-actions"><label className="search-box"><Search size={18} /><input placeholder="Search by name..." aria-label="Search leads by name" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</label><button className="button button-primary mobile-add" onClick={() => setShowAdd(true)}><Plus size={17} /> Add lead</button></div></div>
        <div className="filters" aria-label="Filter leads by status">{(["All", ...statuses] as Filter[]).map((item) => <button key={item} type="button" className={`filter ${filter === item ? "filter-active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
        {loadError && <div className="load-error" role="alert">{loadError} <button onClick={refresh}>Retry</button></div>}
        {loading ? <div className="loading-list"><div /><div /><div /></div> : <div className="lead-sections">
          {today.length > 0 && <section className="lead-group"><div className="group-label group-today"><span><Bell size={15} /> TODAY’S FOLLOW-UPS</span><span className="group-count">{today.length}</span></div><div className="cards">{today.map((lead) => <LeadCard key={lead.id} lead={lead} onClick={() => setSelected(lead.id)} />)}</div></section>}
          {overdue.length > 0 && <section className="lead-group"><div className="group-label group-overdue"><span><Clock3 size={15} /> OVERDUE FOLLOW-UPS</span><span className="group-count">{overdue.length}</span></div><div className="cards">{overdue.map((lead) => <LeadCard key={lead.id} lead={lead} onClick={() => setSelected(lead.id)} />)}</div></section>}
          {rest.length > 0 && <section className="lead-group"><div className="group-label"><span><UserRound size={15} /> ALL LEADS</span><span className="group-count">{rest.length}</span></div><div className="cards">{rest.map((lead) => <LeadCard key={lead.id} lead={lead} onClick={() => setSelected(lead.id)} />)}</div></section>}
          {visible.length === 0 && <div className="empty-list"><span className="empty-icon"><Search size={25} /></span><h3>{leads.length ? "No matching leads" : "Your pipeline starts here"}</h3><p>{leads.length ? "Try another search or status filter." : "Add your first lead and keep the conversation moving."}</p>{!leads.length && <button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add a lead</button>}</div>}
        </div>}
      </section>
      <footer className="footer"><span className="brand-footer"><TrendingUp size={16} /> LeadFlow</span><span>Built to keep the next conversation moving.</span><span>Made for PravarAI <Check size={14} /></span></footer>
    </main>
    {showAdd && <AddLeadDialog onClose={closeAdd} onCreated={(lead) => { changed(lead); closeAdd(); }} />}
    {selected !== null && <LeadDialog leadId={selected} onClose={closeSelected} onChanged={changed} />}
  </div>;
}
