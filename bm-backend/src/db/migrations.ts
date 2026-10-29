import type { Pool } from "pg";

const INITIAL_SCHEMA = `
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
    password_hash TEXT,
    delete_password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT collection_password_visibility CHECK (
        (visibility = 'public' AND password_hash IS NULL) OR
        (visibility = 'private' AND password_hash IS NOT NULL)
    )
);

CREATE TABLE links (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX links_collection_created_at_idx ON links(collection_id, created_at DESC);

CREATE TABLE collection_sessions (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX collection_sessions_collection_idx ON collection_sessions(collection_id);
`;

/** Applies schema changes once, serializing concurrent app starts through a transaction lock. */
export async function runMigrations(pool: Pool): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [814207531]);
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        const { rows } = await client.query<{ version: number }>(
            "SELECT version FROM schema_migrations WHERE version = 1",
        );
        if (rows.length === 0) {
            await client.query(INITIAL_SCHEMA);
            await client.query("INSERT INTO schema_migrations (version) VALUES (1)");
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
