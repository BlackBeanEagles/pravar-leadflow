import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/leadflow.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
db.exec(`CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company TEXT, phone TEXT, status TEXT NOT NULL DEFAULT 'New', follow_up_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS discussions (id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE, note TEXT NOT NULL, created_at TEXT NOT NULL, follow_up_at TEXT);
CREATE INDEX IF NOT EXISTS idx_discussions_lead_date ON discussions(lead_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_at);
CREATE TABLE IF NOT EXISTS demo_seed_runs (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`);

const daysAgo = (days, hour = 10) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const daysAhead = (days, hour = 14) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const starterLeads = [
  { name: "Sarah Connor", company: "Acme Corp", phone: "+1 555 0199", status: "Proposal Sent", followUp: daysAhead(0, 14), discussions: [["Sent the pricing proposal. Sarah will review it with her team.", 2, daysAhead(0, 14)], ["Discovery call: looking for a better way to manage advisor follow-ups.", 6]] },
  { name: "Maya Patel", company: "Northstar Wealth", phone: "+1 555 0132", status: "Qualified", followUp: daysAhead(0, 16), discussions: [["Discussed onboarding needs and agreed to a product walkthrough.", 1, daysAhead(0, 16)], ["Inbound referral from a current client.", 5]] },
  { name: "Daniel Kim", company: "Aperture Finance", phone: "+1 555 0154", status: "Contacted", followUp: daysAgo(1, 11), discussions: [["Left a voicemail and sent an introduction email.", 3, daysAgo(1, 11)]] },
  { name: "Priya Shah", company: "Meridian Advisory", phone: "+1 555 0118", status: "New", followUp: null, discussions: [["Inbound enquiry from the website about client planning tools.", 1]] },
  { name: "Oliver Bennett", company: "Cedar Partners", phone: "+1 555 0173", status: "Contacted", followUp: daysAhead(3, 10), discussions: [["Had a short call; requested a detailed feature list.", 4, daysAhead(3, 10)]] },
  { name: "Ava Brooks", company: "Summit Group", phone: "+1 555 0127", status: "Won", followUp: null, discussions: [["Contract signed. Handed over to onboarding.", 8], ["Final proposal accepted by the team.", 11]] },
  { name: "Noah Williams", company: "Bluebird Capital", phone: "+1 555 0141", status: "Lost", followUp: null, discussions: [["Chose another provider after evaluation.", 12]] },
];

const moreLeads = [
  { name: "Rohan Mehta", company: "Banyan Advisory", phone: "+91 90000 0101", status: "New", followUp: null, discussions: [["Asked for a short overview of how advisors schedule annual reviews.", 1]] },
  { name: "Grace Park", company: "Clearview Private", phone: "+1 555 0204", status: "New", followUp: null, discussions: [["Downloaded the planning workflow guide and requested a callback.", 2]] },
  { name: "Leena Thomas", company: "Atlas Family Office", phone: "+91 90000 0103", status: "New", followUp: null, discussions: [["Met at the advisor forum; wants to compare client note tools.", 4]] },
  { name: "Arjun Desai", company: "Riverstone Wealth", phone: "+91 90000 0104", status: "Contacted", followUp: daysAhead(0, 11), discussions: [["Spoke briefly; Arjun is free to review the workflow today.", 1, daysAhead(0, 11)], ["First outreach after a referral from Meridian Advisory.", 5]] },
  { name: "Sofia Martinez", company: "Beacon Planning", phone: "+1 555 0205", status: "Contacted", followUp: daysAhead(1, 10), discussions: [["Confirmed a discovery call for tomorrow morning.", 1, daysAhead(1, 10)], ["Sent an introduction with a two-minute product overview.", 4]] },
  { name: "Marcus Reed", company: "Harbor Point", phone: "+1 555 0206", status: "Contacted", followUp: daysAgo(2, 15), discussions: [["No answer on the follow-up call. Left a voicemail.", 3, daysAgo(2, 15)], ["Asked us to reconnect after the monthly review.", 8]] },
  { name: "Nikhil Jain", company: "Sterling Financial", phone: "+91 90000 0107", status: "Contacted", followUp: daysAhead(5, 11), discussions: [["Shared an overview with the operations team; check back next week.", 2, daysAhead(5, 11)]] },
  { name: "Anika Rao", company: "Lattice Advisors", phone: "+91 90000 0108", status: "Qualified", followUp: daysAhead(0, 13), discussions: [["Walkthrough covered household records and reminders. Needs a security summary.", 1, daysAhead(0, 13)], ["Planning team has twelve advisors across two offices.", 5]] },
  { name: "Kabir Sethi", company: "Eastgate Capital", phone: "+91 90000 0109", status: "Qualified", followUp: daysAhead(2, 12), discussions: [["Shared sandbox access for two advisors to test recurring reminders.", 2, daysAhead(2, 12)], ["Asked whether past client notes can be searched quickly.", 6]] },
  { name: "Hana Okafor", company: "Oakline Wealth", phone: "+1 555 0210", status: "Qualified", followUp: daysAgo(1, 10), discussions: [["Missed the planned check-in; waiting for revised availability.", 2, daysAgo(1, 10)], ["Their current follow-up list lives in a shared spreadsheet.", 7]] },
  { name: "Evelyn Price", company: "Compass Partners", phone: "+1 555 0211", status: "Qualified", followUp: daysAhead(4, 14), discussions: [["Operations lead joined the call and will review the workflow with partners.", 2, daysAhead(4, 14)], ["Initial discussion covered handoffs between advisors.", 9]] },
  { name: "Meera Menon", company: "Cedarleaf Financial", phone: "+91 90000 0112", status: "Proposal Sent", followUp: daysAhead(0, 15), discussions: [["Sent a revised proposal with seat count and onboarding scope.", 1, daysAhead(0, 15)], ["Agreed on a pilot with eight advisors.", 6]] },
  { name: "David Chen", company: "Crestline Advisors", phone: "+1 555 0213", status: "Proposal Sent", followUp: daysAhead(2, 15), discussions: [["Pricing sheet is with procurement; expecting questions this week.", 2, daysAhead(2, 15)], ["Discovery call covered their current spreadsheet process.", 5]] },
  { name: "Farah Ali", company: "Blue Ridge Family Office", phone: "+1 555 0214", status: "Proposal Sent", followUp: daysAgo(3, 14), discussions: [["Proposal is with the leadership team; our check-in slipped while Farah travelled.", 4, daysAgo(3, 14)], ["Reviewed the conversation timeline and reminder workflow.", 8]] },
  { name: "Aditi Bose", company: "TrueNorth Planning", phone: "+91 90000 0115", status: "Won", followUp: null, discussions: [["Pilot approved and onboarding date confirmed.", 6], ["Final review with the managing partner went well.", 10]] },
  { name: "James Walker", company: "Alderbridge", phone: "+1 555 0216", status: "Won", followUp: null, discussions: [["Signed agreement received; introduced the onboarding contact.", 7]] },
  { name: "Vikram Shah", company: "Skyline Capital", phone: "+91 90000 0117", status: "Lost", followUp: null, discussions: [["Budget moved to next quarter. Closed after the final check-in.", 9]] },
  { name: "Clara Fischer", company: "Redfern Advisory", phone: "+1 555 0218", status: "Lost", followUp: null, discussions: [["They chose to extend their existing CRM rather than switch tools.", 11]] },
];

const seedVersion = "expanded-demo-v2";
const alreadyApplied = db.prepare("SELECT 1 FROM demo_seed_runs WHERE version = ?").get(seedVersion);
const existingCount = db.prepare("SELECT COUNT(*) AS count FROM leads").get().count;
const matchesStarterData = starterLeads.every((lead) => db.prepare("SELECT 1 FROM leads WHERE name = ? AND company = ?").get(lead.name, lead.company));
if (alreadyApplied || (existingCount > 0 && !matchesStarterData)) {
  console.log("Seed skipped: demo data is already current or this is a different database.");
  db.close();
  process.exit(0);
}

const leads = existingCount === 0 ? [...starterLeads, ...moreLeads] : moreLeads;
const findLead = db.prepare("SELECT 1 FROM leads WHERE name = ? AND company = ?");
const insertLead = db.prepare("INSERT INTO leads (name, company, phone, status, follow_up_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
const insertDiscussion = db.prepare("INSERT INTO discussions (lead_id, note, created_at, follow_up_at) VALUES (?, ?, ?, ?)");
let addedLeads = 0;
let addedDiscussions = 0;

db.exec("BEGIN");
try {
  for (const lead of leads) {
    if (findLead.get(lead.name, lead.company)) continue;
    const createdAt = daysAgo(lead.discussions.at(-1)[1] + 1);
    const updatedAt = daysAgo(lead.discussions[0][1]);
    const result = insertLead.run(lead.name, lead.company, lead.phone, lead.status, lead.followUp, createdAt, updatedAt);
    addedLeads += 1;
    for (const [note, days, followUp] of lead.discussions) {
      insertDiscussion.run(Number(result.lastInsertRowid), note, daysAgo(days), followUp || null);
      addedDiscussions += 1;
    }
  }
  db.prepare("INSERT INTO demo_seed_runs (version, applied_at) VALUES (?, ?)").run(seedVersion, new Date().toISOString());
  db.exec("COMMIT");
  console.log(`Seeded ${addedLeads} leads and ${addedDiscussions} discussions.`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
