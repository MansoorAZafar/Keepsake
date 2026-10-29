import { describe, expect, it } from "vitest";
import { hashPassword, hashSessionToken, verifyPassword } from "../src/security/passwords.js";

describe("password and token helpers", () => {
    it("stores a salted hash and verifies only the matching password", () => {
        const firstHash = hashPassword("correct horse battery staple");
        const secondHash = hashPassword("correct horse battery staple");
        expect(firstHash).not.toBe("correct horse battery staple");
        expect(firstHash).not.toBe(secondHash);
        expect(verifyPassword("correct horse battery staple", firstHash)).toBe(true);
        expect(verifyPassword("wrong password", firstHash)).toBe(false);
        expect(verifyPassword("anything", "malformed")).toBe(false);
    });

    it("hashes the same token deterministically without returning the raw token", () => {
        expect(hashSessionToken("sample-token")).toBe(hashSessionToken("sample-token"));
        expect(hashSessionToken("sample-token")).not.toBe("sample-token");
        expect(hashSessionToken("sample-token")).not.toBe(hashSessionToken("other-token"));
    });
});
