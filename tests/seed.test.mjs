import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("seed creates representative leads once and preserves existing data", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "leadflow-seed-"));
  const databasePath = path.join(directory, "test.sqlite");
  const runSeed = () => spawnSync(process.execPath, ["scripts/seed.mjs"], { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, encoding: "utf8" });
  try {
    assert.equal(runSeed().status, 0);
    const db = new DatabaseSync(databasePath);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM leads").get().count, 25);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM discussions").get().count, 39);
    assert.equal(db.prepare("SELECT COUNT(DISTINCT status) AS count FROM leads").get().count, 6);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM leads WHERE follow_up_at IS NOT NULL").get().count, 15);
    db.close();
    assert.equal(runSeed().status, 0);
    const reopened = new DatabaseSync(databasePath);
    assert.equal(reopened.prepare("SELECT COUNT(*) AS count FROM leads").get().count, 25);
    assert.equal(reopened.prepare("SELECT COUNT(*) AS count FROM discussions").get().count, 39);
    reopened.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("seed expands an existing seven-lead demo without changing its original records", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "leadflow-seed-upgrade-"));
  const databasePath = path.join(directory, "test.sqlite");
  const runSeed = () => spawnSync(process.execPath, ["scripts/seed.mjs"], { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, encoding: "utf8" });
  try {
    assert.equal(runSeed().status, 0);
    const db = new DatabaseSync(databasePath);
    db.exec("DELETE FROM demo_seed_runs; DELETE FROM leads WHERE id > 7;");
    db.prepare("UPDATE leads SET status = ? WHERE name = ?").run("Contacted", "Sarah Connor");
    db.close();

    assert.equal(runSeed().status, 0);
    const reopened = new DatabaseSync(databasePath);
    assert.equal(reopened.prepare("SELECT COUNT(*) AS count FROM leads").get().count, 25);
    assert.equal(reopened.prepare("SELECT COUNT(*) AS count FROM discussions").get().count, 39);
    assert.equal(reopened.prepare("SELECT status FROM leads WHERE name = ?").get("Sarah Connor").status, "Contacted");
    reopened.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
