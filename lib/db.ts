import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Discussion, Lead, LeadDetail, LeadStatus } from "./types";

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  const dbPath = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || "./data/leadflow.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const connection = new DatabaseSync(dbPath, { timeout: 5000 });
  connection.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  connection.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  follow_up_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  follow_up_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_discussions_lead_date ON discussions(lead_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_at);
`);
  db = connection;
  return connection;
}

type Row = Record<string, unknown>;
const summaryQuery = `SELECT l.*, (SELECT note FROM discussions d WHERE d.lead_id=l.id ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS last_note, (SELECT created_at FROM discussions d WHERE d.lead_id=l.id ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS last_discussion_at FROM leads l`;

function mapLead(row: Row): Lead {
  return {
    id: Number(row.id), name: String(row.name), company: row.company as string | null,
    phone: row.phone as string | null, status: row.status as LeadStatus,
    followUpAt: row.follow_up_at as string | null, createdAt: String(row.created_at),
    updatedAt: String(row.updated_at), lastNote: row.last_note as string | null,
    lastDiscussionAt: row.last_discussion_at as string | null,
  };
}

function mapDiscussion(row: Row): Discussion {
  return { id: Number(row.id), leadId: Number(row.lead_id), note: String(row.note), createdAt: String(row.created_at), followUpAt: row.follow_up_at as string | null };
}

export function listLeads(): Lead[] {
  return (getDb().prepare(`${summaryQuery} ORDER BY l.updated_at DESC, l.id DESC`).all() as Row[]).map(mapLead);
}

export function getLead(id: number): LeadDetail | null {
  const row = getDb().prepare(`${summaryQuery} WHERE l.id = ?`).get(id) as Row | undefined;
  if (!row) return null;
  const discussions = (getDb().prepare("SELECT * FROM discussions WHERE lead_id = ? ORDER BY created_at DESC, id DESC").all(id) as Row[]).map(mapDiscussion);
  return { ...mapLead(row), discussions };
}

export function createLead(input: { name: string; company?: string; phone?: string }): LeadDetail {
  const now = new Date().toISOString();
  const result = getDb().prepare("INSERT INTO leads (name, company, phone, status, created_at, updated_at) VALUES (?, ?, ?, 'New', ?, ?)").run(input.name, input.company || null, input.phone || null, now, now);
  return getLead(Number(result.lastInsertRowid))!;
}

export function updateStatus(id: number, status: LeadStatus): LeadDetail | null {
  const result = getDb().prepare("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  return result.changes ? getLead(id) : null;
}

export function addDiscussion(id: number, note: string, followUpAt: string | null): LeadDetail | null {
  if (!getLead(id)) return null;
  const now = new Date().toISOString();
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO discussions (lead_id, note, created_at, follow_up_at) VALUES (?, ?, ?, ?)").run(id, note, now, followUpAt);
    db.prepare("UPDATE leads SET follow_up_at = COALESCE(?, follow_up_at), updated_at = ? WHERE id = ?").run(followUpAt, now, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getLead(id);
}
