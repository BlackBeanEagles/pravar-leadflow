import test from "node:test";
import assert from "node:assert/strict";
import { leadPriorityGroup, nextLeadToContact, sortLeadGroup } from "../lib/lead-priority.ts";

const now = new Date(2026, 9, 14, 12, 0);
const date = (day, hour) => new Date(2026, 9, day, hour, 0).toISOString();
const lead = (id, status, followUpAt, lastDiscussionAt = null) => ({
  id, name: `Lead ${id}`, company: null, phone: null, status, followUpAt,
  createdAt: date(1, 9), updatedAt: date(1, 9), lastDiscussionAt, lastNote: null,
});

test("priority separates missed reminders from later today and excludes closed leads", () => {
  const records = [
    lead(1, "Qualified", date(13, 10)),
    lead(2, "Contacted", date(14, 10)),
    lead(3, "New", date(14, 16)),
    lead(4, "New", date(16, 10)),
    lead(5, "New", null),
    lead(6, "Won", date(12, 10)),
    lead(7, "Lost", null),
    lead(8, "New", "invalid"),
  ];
  assert.deepEqual(records.map((record) => leadPriorityGroup(record, now)), ["overdue", "today", "today", "upcoming", "unscheduled", "closed", "closed", "unscheduled"]);
  assert.deepEqual(sortLeadGroup(records.slice(1, 3), "today").map((record) => record.id), [2, 3]);
  assert.equal(nextLeadToContact(records, now)?.lead.id, 1);
});

test("earliest missed follow-up wins; sort controls reorder within a group", () => {
  const records = [lead(1, "New", date(13, 15), date(13, 11)), lead(2, "New", date(12, 9), date(13, 8))];
  assert.deepEqual(sortLeadGroup(records, "overdue").map((item) => item.id), [2, 1]);
  assert.deepEqual(sortLeadGroup(records, "overdue", "discussion").map((item) => item.id), [1, 2]);
});

test("unscheduled active leads come after dated reminders and closed leads are ignored", () => {
  const records = [
    lead(1, "Won", date(10, 9)),
    lead(2, "Contacted", null, date(12, 10)),
    lead(3, "New", null, date(11, 10)),
    lead(4, "Qualified", date(17, 10)),
  ];
  assert.equal(nextLeadToContact(records, now)?.lead.id, 4);
  assert.deepEqual(sortLeadGroup(records.slice(1, 3), "unscheduled").map((item) => item.id), [3, 2]);
  assert.equal(nextLeadToContact(records.slice(0, 3), now)?.lead.id, 3);
});
