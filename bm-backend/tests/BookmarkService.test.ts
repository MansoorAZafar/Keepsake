import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBookmarkRepository } from "../src/repositories/InMemoryBookmarkRepository.js";
import { BookmarkService } from "../src/services/BookmarkService.js";
import { hashSessionToken } from "../src/security/passwords.js";

describe("BookmarkService", () => {
    let repository: InMemoryBookmarkRepository;
    let service: BookmarkService;

    beforeEach(() => {
        repository = new InMemoryBookmarkRepository({ seed: false });
        service = new BookmarkService(repository);
    });

    it("creates a collection with a session and never returns its password hash", async () => {
        const result = await service.createCollection({
            name: "My links",
            visibility: "private",
            password: "safe password 123",
        });
        expect(result.collection).toMatchObject({ name: "My links", linkCount: 0 });
        expect(result.collection).not.toHaveProperty("passwordHash");
        expect(result.collection).not.toHaveProperty("deletePasswordHash");
        expect(result.collection.visibility).toBe("private");
        expect(result.deletePassword).toHaveLength(32);
        expect(result.accessToken).toHaveLength(43);
        expect(
            await repository.findSessionByTokenHash(hashSessionToken(result.accessToken)),
        ).toBeDefined();
    });

    it("makes public links readable without a session but does not allow public sessions", async () => {
        const created = await service.createCollection({
            name: "Open links",
            visibility: "public",
        });
        expect(created.collection.visibility).toBe("public");
        expect(await service.listLinks(created.collection.id)).toEqual([]);
        await expect(
            service.createSession(created.collection.id, "anything"),
        ).rejects.toMatchObject({ statusCode: 401 });
        await expect(
            service.createLink(created.collection.id, { url: "example.com" }, "missing-token"),
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("only deletes a collection when its one-time deletion password matches", async () => {
        const created = await service.createCollection({ name: "Delete me", visibility: "public" });
        await expect(
            service.deleteCollection(created.collection.id, "wrong deletion password"),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(await service.getCollection(created.collection.id)).toBeDefined();
        await service.deleteCollection(created.collection.id, created.deletePassword);
        await expect(service.getCollection(created.collection.id)).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    it("allows the right password and rejects a wrong password", async () => {
        const created = await service.createCollection({
            name: "Protected",
            visibility: "private",
            password: "safe password 123",
        });
        await expect(
            service.createSession(created.collection.id, "wrong password"),
        ).rejects.toMatchObject({ statusCode: 401 });
        const session = await service.createSession(created.collection.id, "safe password 123");
        expect(session.accessToken).toHaveLength(43);
    });

    it("requires a session for links and enforces its collection ownership", async () => {
        const first = await service.createCollection({
            name: "First",
            visibility: "private",
            password: "safe password 123",
        });
        const second = await service.createCollection({
            name: "Second",
            visibility: "private",
            password: "safe password 123",
        });
        await expect(service.listLinks(first.collection.id, "bad-token")).rejects.toMatchObject({
            statusCode: 401,
        });
        await expect(
            service.listLinks(second.collection.id, first.accessToken),
        ).rejects.toMatchObject({ statusCode: 401 });
        const link = await service.createLink(
            first.collection.id,
            { url: "www.github.com/sdda" },
            first.accessToken,
        );
        expect(link).toMatchObject({
            domain: "github.com",
            url: "https://www.github.com/sdda",
            title: "sdda",
        });
        expect(await service.listLinks(first.collection.id, first.accessToken)).toHaveLength(1);
    });

    it("rejects an expired session", async () => {
        let now = new Date("2026-01-01T00:00:00.000Z");
        const serviceWithClock = new BookmarkService(repository, () => now);
        const created = await serviceWithClock.createCollection({
            name: "Timed",
            visibility: "private",
            password: "safe password 123",
        });
        now = new Date("2026-01-02T00:00:00.000Z");
        await expect(
            serviceWithClock.listLinks(created.collection.id, created.accessToken),
        ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("revokes a session when it is closed", async () => {
        const created = await service.createCollection({
            name: "Closable",
            visibility: "private",
            password: "safe password 123",
        });
        await service.closeSession(created.collection.id, created.accessToken);
        await expect(
            service.listLinks(created.collection.id, created.accessToken),
        ).rejects.toMatchObject({ statusCode: 401 });
    });
});
