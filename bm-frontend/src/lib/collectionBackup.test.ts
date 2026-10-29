import { describe, expect, it } from "vitest";
import { buildCollectionBackup } from "./collectionBackup";

describe("buildCollectionBackup", () => {
    it("packages the collection and deletion password without including a session token", () => {
        const collection = {
            id: "reading",
            name: "Reading list",
            description: "To revisit",
            visibility: "private" as const,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            linkCount: 0,
        };

        expect(buildCollectionBackup(collection, "one-time-delete-password")).toEqual({
            collection,
            deletePassword: "one-time-delete-password",
        });
        expect(buildCollectionBackup(collection, "one-time-delete-password")).not.toHaveProperty(
            "accessToken",
        );
    });
});
