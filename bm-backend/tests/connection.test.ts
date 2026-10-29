import { describe, expect, it } from "vitest";
import { normalizeNeonConnectionString } from "../src/db/connection.js";

describe("normalizeNeonConnectionString", () => {
    it("makes Neon require mode's current strict TLS behavior explicit", () => {
        const result = normalizeNeonConnectionString(
            "postgresql://user:secret@ep.example.neon.tech/db?sslmode=require",
        );
        const url = new URL(result);

        expect(url.hostname).toBe("ep.example.neon.tech");
        expect(url.searchParams.get("sslmode")).toBe("verify-full");
        expect(url.password).toBe("secret");
    });

    it("leaves other SSL modes intact", () => {
        const input = "postgresql://user:secret@ep.example.neon.tech/db?sslmode=verify-full";
        expect(normalizeNeonConnectionString(input)).toBe(input);
    });
});
