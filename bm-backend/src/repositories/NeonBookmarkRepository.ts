import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import { normalizeNeonConnectionString } from "../db/connection.js";
import type { BookmarkRepository } from "./BookmarkRepository.js";
import type {
    CollectionSession,
    SavedLink,
    StoredCollection,
    UpdateCollectionInput,
} from "../types/domain.js";

interface CollectionRow extends QueryResultRow {
    id: string;
    name: string;
    description: string;
    visibility: "public" | "private";
    password_hash: string | null;
    delete_password_hash: string;
    created_at: Date;
    updated_at: Date;
}

interface LinkRow extends QueryResultRow {
    id: string;
    collection_id: string;
    url: string;
    domain: string;
    title: string;
    note: string;
    created_at: Date;
}

interface SessionRow extends QueryResultRow {
    id: string;
    collection_id: string;
    token_hash: string;
    created_at: Date;
    expires_at: Date;
}

const toCollection = (row: CollectionRow): StoredCollection => ({
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    passwordHash: row.password_hash,
    deletePasswordHash: row.delete_password_hash,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
});

const toLink = (row: LinkRow): SavedLink => ({
    id: row.id,
    collectionId: row.collection_id,
    url: row.url,
    domain: row.domain,
    title: row.title,
    note: row.note,
    createdAt: row.created_at.toISOString(),
});

const toSession = (row: SessionRow): CollectionSession => ({
    id: row.id,
    collectionId: row.collection_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
});

/** PostgreSQL storage adapter. The service and HTTP DTOs remain database-agnostic. */
export class NeonBookmarkRepository implements BookmarkRepository {
    private readonly pool: Pool;

    constructor(connectionString: string) {
        this.pool = new Pool({
            connectionString: normalizeNeonConnectionString(connectionString),
            max: 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
        });
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    async listCollections(): Promise<StoredCollection[]> {
        const { rows } = await this.pool.query<CollectionRow>(
            "SELECT * FROM collections ORDER BY created_at DESC",
        );
        return rows.map(toCollection);
    }

    async findCollection(id: string): Promise<StoredCollection | undefined> {
        const { rows } = await this.pool.query<CollectionRow>(
            "SELECT * FROM collections WHERE id = $1",
            [id],
        );
        return rows[0] ? toCollection(rows[0]) : undefined;
    }

    async createCollection(input: {
        name: string;
        description: string;
        visibility: "public" | "private";
        passwordHash: string | null;
        deletePasswordHash: string;
    }): Promise<StoredCollection> {
        const { rows } = await this.pool.query<CollectionRow>(
            `INSERT INTO collections
                (id, name, description, visibility, password_hash, delete_password_hash)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                randomUUID(),
                input.name,
                input.description,
                input.visibility,
                input.passwordHash,
                input.deletePasswordHash,
            ],
        );
        return toCollection(rows[0]);
    }

    async updateCollection(
        id: string,
        changes: UpdateCollectionInput,
    ): Promise<StoredCollection | undefined> {
        const assignments: string[] = [];
        const values: string[] = [];
        if (changes.name !== undefined) {
            values.push(changes.name);
            assignments.push(`name = $${values.length}`);
        }
        if (changes.description !== undefined) {
            values.push(changes.description);
            assignments.push(`description = $${values.length}`);
        }
        if (assignments.length === 0) return this.findCollection(id);
        values.push(id);
        const { rows } = await this.pool.query<CollectionRow>(
            `UPDATE collections
             SET ${assignments.join(", ")}, updated_at = NOW()
             WHERE id = $${values.length}
             RETURNING *`,
            values,
        );
        return rows[0] ? toCollection(rows[0]) : undefined;
    }

    async deleteCollection(id: string): Promise<boolean> {
        const result = await this.pool.query("DELETE FROM collections WHERE id = $1", [id]);
        return result.rowCount === 1;
    }

    async listLinks(collectionId: string): Promise<SavedLink[]> {
        const { rows } = await this.pool.query<LinkRow>(
            "SELECT * FROM links WHERE collection_id = $1 ORDER BY created_at DESC",
            [collectionId],
        );
        return rows.map(toLink);
    }

    async createLink(input: Omit<SavedLink, "id" | "createdAt">): Promise<SavedLink> {
        const { rows } = await this.pool.query<LinkRow>(
            `INSERT INTO links (id, collection_id, url, domain, title, note)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [randomUUID(), input.collectionId, input.url, input.domain, input.title, input.note],
        );
        return toLink(rows[0]);
    }

    async deleteLink(collectionId: string, linkId: string): Promise<boolean> {
        const result = await this.pool.query(
            "DELETE FROM links WHERE collection_id = $1 AND id = $2",
            [collectionId, linkId],
        );
        return result.rowCount === 1;
    }

    async createSession(
        input: Omit<CollectionSession, "id" | "createdAt">,
    ): Promise<CollectionSession> {
        const { rows } = await this.pool.query<SessionRow>(
            `INSERT INTO collection_sessions (id, collection_id, token_hash, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [randomUUID(), input.collectionId, input.tokenHash, input.expiresAt],
        );
        return toSession(rows[0]);
    }

    async findSessionByTokenHash(tokenHash: string): Promise<CollectionSession | undefined> {
        const { rows } = await this.pool.query<SessionRow>(
            "SELECT * FROM collection_sessions WHERE token_hash = $1",
            [tokenHash],
        );
        return rows[0] ? toSession(rows[0]) : undefined;
    }

    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
        await this.pool.query("DELETE FROM collection_sessions WHERE token_hash = $1", [tokenHash]);
    }
}
