import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/leadflow.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company TEXT, phone TEXT, status TEXT NOT NULL DEFAULT 'New', follow_up_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS discussions (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE, note TEXT NOT NULL, created_at TEXT NOT NULL, follow_up_at TEXT);
CREATE INDEX IF NOT EXISTS idx_discussions_lead_date ON discussions(lead_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_at);`);

if (db.prepare("SELECT COUNT(*) AS count FROM leads").get().count > 0) {
  console.log("Seed skipped: the database already contains leads.");
  db.close();
  process.exit(0);
}

const daysAgo = (days, hour = 10) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const daysAhead = (days, hour = 14) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const leads = [
  { name: "Sarah Connor", company: "Acme Corp", phone: "+1 555 0199", status: "Proposal Sent", followUp: daysAhead(0, 14), discussions: [["Sent the pricing proposal. Sarah will review it with her team.", 2, daysAhead(0, 14)], ["Discovery call: looking for a better way to manage advisor follow-ups.", 6]] },
  { name: "Maya Patel", company: "Northstar Wealth", phone: "+1 555 0132", status: "Qualified", followUp: daysAhead(0, 16), discussions: [["Discussed onboarding needs and agreed to a product walkthrough.", 1, daysAhead(0, 16)], ["Inbound referral from a current client.", 5]] },
  { name: "Daniel Kim", company: "Aperture Finance", phone: "+1 555 0154", status: "Contacted", followUp: daysAgo(1, 11), discussions: [["Left a voicemail and sent an introduction email.", 3, daysAgo(1, 11)]] },
  { name: "Priya Shah", company: "Meridian Advisory", phone: "+1 555 0118", status: "New", followUp: null, discussions: [["Inbound enquiry from the website about client planning tools.", 1]] },
  { name: "Oliver Bennett", company: "Cedar Partners", phone: "+1 555 0173", status: "Contacted", followUp: daysAhead(3, 10), discussions: [["Had a short call; requested a detailed feature list.", 4, daysAhead(3, 10)]] },
  { name: "Ava Brooks", company: "Summit Group", phone: "+1 555 0127", status: "Won", followUp: null, discussions: [["Contract signed. Handed over to onboarding.", 8], ["Final proposal accepted by the team.", 11]] },
  { name: "Noah Williams", company: "Bluebird Capital", phone: "+1 555 0141", status: "Lost", followUp: null, discussions: [["Chose another provider after evaluation.", 12]] },
];

db.exec("BEGIN");
try {
  for (const lead of leads) {
    const createdAt = daysAgo(lead.discussions.at(-1)[1] + 1);
    const updatedAt = daysAgo(lead.discussions[0][1]);
    const result = db.prepare("INSERT INTO leads (name, company, phone, status, follow_up_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(lead.name, lead.company, lead.phone, lead.status, lead.followUp, createdAt, updatedAt);
    for (const [note, days, followUp] of lead.discussions) {
      db.prepare("INSERT INTO discussions (lead_id, note, created_at, follow_up_at) VALUES (?, ?, ?, ?)").run(Number(result.lastInsertRowid), note, daysAgo(days), followUp || null);
    }
  }
  db.exec("COMMIT");
  console.log(`Seeded ${leads.length} leads and ${leads.reduce((total, lead) => total + lead.discussions.length, 0)} discussions.`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
