import { describe, expect, it } from "vitest";
import { InMemoryBookmarkRepository } from "../src/repositories/InMemoryBookmarkRepository.js";
import { hashPassword } from "../src/security/passwords.js";

describe("InMemoryBookmarkRepository", () => {
    it("creates and updates collections without exposing link data as collection fields", async () => {
        const repository = new InMemoryBookmarkRepository({ seed: false });
        const created = await repository.createCollection({
            name: "Reading",
            description: "To revisit",
            visibility: "private",
            passwordHash: hashPassword("a safe password"),
            deletePasswordHash: hashPassword("delete this collection"),
        });
        expect(await repository.findCollection(created.id)).toMatchObject({
            name: "Reading",
            description: "To revisit",
        });
        const updated = await repository.updateCollection(created.id, { name: "Reading list" });
        expect(updated?.name).toBe("Reading list");
        expect(await repository.listCollections()).toHaveLength(1);
    });

    it("isolates links by collection and cascades collection deletion to links and sessions", async () => {
        const repository = new InMemoryBookmarkRepository({ seed: false });
        const collection = await repository.createCollection({
            name: "One",
            description: "",
            visibility: "public",
            passwordHash: null,
            deletePasswordHash: hashPassword("delete this collection"),
        });
        const link = await repository.createLink({
            collectionId: collection.id,
            url: "https://example.com/",
            domain: "example.com",
            title: "Example",
            note: "",
        });
        await repository.createSession({
            collectionId: collection.id,
            tokenHash: "hashed-token",
            expiresAt: new Date(Date.now() + 1000).toISOString(),
        });
        expect(await repository.deleteLink("wrong-collection", link.id)).toBe(false);
        expect(await repository.deleteCollection(collection.id)).toBe(true);
        expect(await repository.listLinks(collection.id)).toEqual([]);
        expect(await repository.findSessionByTokenHash("hashed-token")).toBeUndefined();
    });
});
