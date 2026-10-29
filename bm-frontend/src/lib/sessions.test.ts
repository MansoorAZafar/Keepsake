import { beforeEach, describe, expect, it } from "vitest";
import { readSession, removeSession, writeSession } from "./sessions";

describe("browser collection sessions", () => {
    beforeEach(() => window.sessionStorage.clear());

    it("stores and reads a session scoped to one collection", () => {
        const session = {
            accessToken: "secret-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
        writeSession("collection-a", session);
        expect(readSession("collection-a")).toEqual(session);
        expect(readSession("collection-b")).toBeNull();
    });

    it("clears expired sessions on read and explicitly removes active sessions", () => {
        writeSession("expired", {
            accessToken: "expired-token",
            expiresAt: "2000-01-01T00:00:00.000Z",
        });
        expect(readSession("expired")).toBeNull();
        writeSession("active", {
            accessToken: "active-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        removeSession("active");
        expect(readSession("active")).toBeNull();
    });
});
