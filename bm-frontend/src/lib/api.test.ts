import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("frontend API client", () => {
    it("unwraps the common data envelope", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify({ data: [{ id: "design" }] }), { status: 200 }),
                ),
        );
        await expect(api.listCollections()).resolves.toEqual([{ id: "design" }]);
    });

    it("sends JSON, bearer authorization, and reports API errors", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ error: "Session is invalid or expired" }), {
                    status: 401,
                }),
            );
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            api.createLink("design", "token", { url: "github.com/sdda" }),
        ).rejects.toBeInstanceOf(ApiError);
        const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
        const headers = new Headers(requestInit.headers);
        expect(requestInit.method).toBe("POST");
        expect(headers.get("Authorization")).toBe("Bearer token");
        expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("handles empty 204 responses", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        await expect(api.closeSession("design", "token")).resolves.toBeUndefined();
    });
});
