import type { Lead } from "./types";

export type PriorityGroup = "overdue" | "today" | "upcoming" | "unscheduled" | "closed";
export type LeadSort = "follow-up" | "discussion" | "added";

export function validTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function leadPriorityGroup(lead: Lead, now = new Date()): PriorityGroup {
  if (lead.status === "Won" || lead.status === "Lost") return "closed";
  const time = validTime(lead.followUpAt);
  if (time === null) return "unscheduled";
  const due = new Date(time);
  if (due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate()) return "today";
  if (time < now.getTime()) return "overdue";
  return "upcoming";
}

export function sortLeadGroup(leads: Lead[], group: PriorityGroup, sort: LeadSort = "follow-up"): Lead[] {
  return [...leads].sort((a, b) => {
    const aFollow = validTime(a.followUpAt) ?? Number.MAX_SAFE_INTEGER;
    const bFollow = validTime(b.followUpAt) ?? Number.MAX_SAFE_INTEGER;
    const aDiscussion = validTime(a.lastDiscussionAt) ?? validTime(a.createdAt) ?? 0;
    const bDiscussion = validTime(b.lastDiscussionAt) ?? validTime(b.createdAt) ?? 0;
    const aAdded = validTime(a.createdAt) ?? 0;
    const bAdded = validTime(b.createdAt) ?? 0;
    let difference = 0;
    if (sort === "discussion") difference = bDiscussion - aDiscussion;
    else if (sort === "added") difference = bAdded - aAdded;
    else if (group === "unscheduled") difference = aDiscussion - bDiscussion;
    else if (group === "closed") difference = bAdded - aAdded;
    else difference = aFollow - bFollow;
    return difference || a.id - b.id;
  });
}

export function nextLeadToContact(leads: Lead[], now = new Date()): { lead: Lead; group: PriorityGroup } | null {
  const active = leads.filter((lead) => leadPriorityGroup(lead, now) !== "closed");
  for (const group of ["overdue", "today", "upcoming", "unscheduled"] as const) {
    const matching = sortLeadGroup(active.filter((lead) => leadPriorityGroup(lead, now) === group), group);
    if (matching.length) return { lead: matching[0], group };
  }
  return null;
}
