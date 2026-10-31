import { afterEach, describe, expect, it } from "vitest";
import { FilebaseStorage } from "../src/services/FilebaseStorage.js";

const ENV_KEYS = [
    "FILEBASE_ACCESS_KEY_ID",
    "FILEBASE_SECRET_ACCESS_KEY",
    "FILEBASE_BUCKET",
    "FILEBASE_ENDPOINT",
    "FILEBASE_REGION",
] as const;
const originalEnvironment = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
    for (const key of ENV_KEYS) {
        const value = originalEnvironment.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

describe("FilebaseStorage", () => {
    it("creates a short-lived signed PUT URL bound to the image type and exact size", async () => {
        process.env.FILEBASE_ACCESS_KEY_ID = "test-access-key";
        process.env.FILEBASE_SECRET_ACCESS_KEY = "test-secret-key";
        process.env.FILEBASE_BUCKET = "test-bucket";
        process.env.FILEBASE_ENDPOINT = "https://s3.filebase.io";
        process.env.FILEBASE_REGION = "auto";

        const storage = FilebaseStorage.fromEnvironment();
        expect(storage).toBeDefined();
        try {
            const upload = await storage!.createUploadUrl("collection-1", "image/png", 1024);
            const signedUrl = new URL(upload.uploadUrl);
            const signedHeaders = signedUrl.searchParams.get("X-Amz-SignedHeaders")?.split(";");

            expect(signedUrl.hostname).toBe("s3.filebase.io");
            expect(signedUrl.searchParams.get("X-Amz-Expires")).toBe("300");
            expect(signedHeaders).toContain("content-length");
            expect(signedHeaders).toContain("content-type");
            expect(upload.imageKey).toMatch(/^collections\/collection-1\/images\//);
            expect(upload.imageUrl).toContain("X-Amz-Signature");
        } finally {
            await storage!.close();
        }
    });

    it("rejects unsupported image types and out-of-range sizes before signing", async () => {
        process.env.FILEBASE_ACCESS_KEY_ID = "test-access-key";
        process.env.FILEBASE_SECRET_ACCESS_KEY = "test-secret-key";
        process.env.FILEBASE_BUCKET = "test-bucket";

        const storage = FilebaseStorage.fromEnvironment();
        expect(storage).toBeDefined();
        try {
            await expect(storage!.createUploadUrl("collection-1", "text/html", 10)).rejects.toThrow(
                "Use a JPEG, PNG, GIF, or WebP image.",
            );
            await expect(
                storage!.createUploadUrl("collection-1", "image/png", 5 * 1024 * 1024 + 1),
            ).rejects.toThrow("Images must be smaller than 5 MB.");
        } finally {
            await storage!.close();
        }
    });
});
