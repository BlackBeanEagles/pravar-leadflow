export const statuses = ["New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"] as const;
export type LeadStatus = (typeof statuses)[number];

export type Discussion = {
  id: number;
  leadId: number;
  note: string;
  createdAt: string;
  followUpAt: string | null;
};

export type Lead = {
  id: number;
  name: string;
  company: string | null;
  phone: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  followUpAt: string | null;
  lastNote: string | null;
  lastDiscussionAt: string | null;
};

export type LeadDetail = Lead & { discussions: Discussion[] };
