export const sessionMigrations = {
  journal: {
    entries: [
      { idx: 0, when: 1789516800000, tag: 'session_v1', breakpoints: true },
      {
        idx: 1,
        when: 1789516800001,
        tag: 'session_v2_responses',
        breakpoints: true
      },
      {
        idx: 2,
        when: 1789516800002,
        tag: 'session_v3_artifact_events',
        breakpoints: true
      },
      {
        idx: 3,
        when: 1789516800003,
        tag: 'session_v4_hearth_events',
        breakpoints: true
      },
      {
        idx: 4,
        when: 1789516800004,
        tag: 'session_v5_publication_grants',
        breakpoints: true
      }
    ]
  },
  migrations: {
    m0000: `CREATE TABLE session (key INTEGER PRIMARY KEY, state TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE events (sequence INTEGER PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE nudges (id TEXT PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE receipts (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE outbox (key INTEGER PRIMARY KEY, value TEXT NOT NULL, due INTEGER NOT NULL, failures INTEGER NOT NULL);`,
    m0001: `CREATE TABLE response_selections (receipt_key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
    m0002: `CREATE TABLE artifact_revisions (id TEXT PRIMARY KEY, revision INTEGER NOT NULL);`,
    m0003: `CREATE TABLE hearth_revisions (id TEXT PRIMARY KEY, revision INTEGER NOT NULL);`,
    m0004: `CREATE TABLE publication_grants (key TEXT PRIMARY KEY, revision INTEGER NOT NULL);`
  }
}
export const presenceMigrations = {
  journal: {
    entries: [
      { idx: 0, when: 1789516800000, tag: 'presence_v1', breakpoints: true },
      {
        idx: 1,
        when: 1789516800001,
        tag: 'presence_v2_admission',
        breakpoints: true
      }
    ]
  },
  migrations: {
    m0000: `CREATE TABLE summaries (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, eligible INTEGER NOT NULL, room TEXT, value TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX summaries_seen ON summaries(last_seen);
--> statement-breakpoint
CREATE INDEX summaries_expiry ON summaries(expires_at);
--> statement-breakpoint
CREATE INDEX summaries_room ON summaries(room);`,
    m0001: `CREATE TABLE presence_admission (key INTEGER PRIMARY KEY, watermark INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO presence_admission (key, watermark) VALUES (1, -1);`
  }
}
