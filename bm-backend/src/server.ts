import "dotenv/config";
import { Pool } from "pg";
import { createApp } from "./app.js";
import { normalizeNeonConnectionString } from "./db/connection.js";
import { runMigrations } from "./db/migrations.js";
import { NeonBookmarkRepository } from "./repositories/NeonBookmarkRepository.js";
import { InMemoryBookmarkRepository } from "./repositories/InMemoryBookmarkRepository.js";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DATABASE_URL_UNPOOLED;

const isInMemoryDB = process.env.IN_MEMORY === "true";

if (!isInMemoryDB && (!databaseUrl || !migrationUrl)) {
    throw new Error("DATABASE_URL and DATABASE_URL_UNPOOLED must be set to start the API");
}

if (!isInMemoryDB && migrationUrl) {
    const migrationPool = new Pool({
        connectionString: normalizeNeonConnectionString(migrationUrl),
        max: 1,
    });

    try {
        await runMigrations(migrationPool);
    } finally {
        await migrationPool.end();
    }
}

const repository = isInMemoryDB
    ? new InMemoryBookmarkRepository()
    : new NeonBookmarkRepository(databaseUrl!);
const server = createApp(repository).listen(port, () =>
    console.log(
        `Bookmark API listening at http://localhost:${port} ${isInMemoryDB ? "(In Memory DB)" : "(Neon PostgreSQL)"}`,
    ),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
        server.close(() => {
            void repository.close().finally(() => process.exit(0));
        });
    });
}
