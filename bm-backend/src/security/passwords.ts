import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_KEY_BYTES = Number(process.env.PASSWORD_KEY_BYTES) ?? 64;

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, PASSWORD_KEY_BYTES).toString("hex");
    return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, encodedHash: string): boolean {
    const [salt, expectedHex] = encodedHash.split(":");
    if (!salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    if (expected.length !== PASSWORD_KEY_BYTES) return false;
    const actual = scryptSync(password, salt, PASSWORD_KEY_BYTES);
    return timingSafeEqual(actual, expected);
}

export function hashSessionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}
