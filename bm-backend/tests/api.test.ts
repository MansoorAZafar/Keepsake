import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { InMemoryBookmarkRepository } from "../src/repositories/InMemoryBookmarkRepository.js";

const app = createApp(new InMemoryBookmarkRepository());

describe("HTTP API", () => {
    afterEach(() => {
        /* Each test uses unique collections; seed data stays read-only. */
    });

    it("serves health and public collection metadata without exposing password hashes", async () => {
        expect((await request(app).get("/api/health")).body).toEqual({ status: "ok" });
        const response = await request(app).get("/api/collections").expect(200);
        expect(response.body.data[0]).toMatchObject({
            id: "design",
            name: "Design inspiration",
            linkCount: 5,
        });
        expect(response.body.data[0]).not.toHaveProperty("passwordHash");
    });

    it("requires the design password before returning its links", async () => {
        await request(app).get("/api/collections/design/links").expect(401);
        await request(app)
            .post("/api/collections/design/sessions")
            .send({ password: "incorrect" })
            .expect(401);
        const sessionResponse = await request(app)
            .post("/api/collections/design/sessions")
            .send({ password: "design-demo" })
            .expect(201);
        const token = sessionResponse.body.data.accessToken as string;
        const links = await request(app)
            .get("/api/collections/design/links")
            .set("Authorization", `Bearer ${token}`)
            .expect(200);
        expect(links.body.data).toHaveLength(5);
        expect(
            links.body.data.filter((link: { domain: string }) => link.domain === "github.com"),
        ).toHaveLength(2);
    });

    it("creates a password-protected collection, saves normalized links, and revokes a session", async () => {
        const created = await request(app)
            .post("/api/collections")
            .send({
                name: "My links",
                description: "Saved for later",
                visibility: "private",
                password: "a strong password",
            })
            .expect(201);
        const { collection, accessToken } = created.body.data as {
            collection: { id: string };
            accessToken: string;
        };
        expect(collection).not.toHaveProperty("passwordHash");
        expect(collection).toMatchObject({ visibility: "private" });
        expect(created.body.data.deletePassword).toHaveLength(32);
        const saved = await request(app)
            .post(`/api/collections/${collection.id}/links`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ url: "github.com/sdda" })
            .expect(201);
        expect(saved.body.data).toMatchObject({
            domain: "github.com",
            url: "https://github.com/sdda",
            title: "sdda",
        });
        await request(app)
            .delete(`/api/collections/${collection.id}/sessions/current`)
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(204);
        await request(app)
            .get(`/api/collections/${collection.id}/links`)
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(401);
    });

    it("creates public collections without a view password and requires the one-time deletion password", async () => {
        const created = await request(app)
            .post("/api/collections")
            .send({ name: "Open links", visibility: "public" })
            .expect(201);
        const { collection, accessToken, deletePassword } = created.body.data as {
            collection: { id: string; visibility: string };
            accessToken: string;
            deletePassword: string;
        };
        expect(collection.visibility).toBe("public");
        expect(deletePassword).toHaveLength(32);
        const publicLinks = await request(app)
            .get(`/api/collections/${collection.id}/links`)
            .expect(200);
        expect(publicLinks.body.data).toEqual([]);
        await request(app)
            .post(`/api/collections/${collection.id}/sessions`)
            .send({ password: "anything" })
            .expect(401);
        await request(app)
            .post(`/api/collections/${collection.id}/links`)
            .send({ url: "github.com" })
            .expect(401);
        await request(app)
            .delete(`/api/collections/${collection.id}`)
            .send({ deletePassword: "incorrect-deletion-password" })
            .expect(401);
        await request(app)
            .delete(`/api/collections/${collection.id}`)
            .send({ deletePassword })
            .expect(204);
        await request(app).get(`/api/collections/${collection.id}`).expect(404);
        await request(app)
            .get(`/api/collections/${collection.id}/links`)
            .set("Authorization", `Bearer ${accessToken}`)
            .expect(404);
    });

    it("treats an empty public password field as omitted, but rejects a real password", async () => {
        await request(app)
            .post("/api/collections")
            .send({ name: "No password", visibility: "public", password: "" })
            .expect(201);
        await request(app)
            .post("/api/collections")
            .send({
                name: "Conflicting password",
                visibility: "public",
                password: "a strong password",
            })
            .expect(400);
    });

    it("rejects attempts to change visibility after collection creation", async () => {
        const created = await request(app)
            .post("/api/collections")
            .send({
                name: "Fixed visibility",
                visibility: "private",
                password: "a strong password",
            })
            .expect(201);
        const { collection, accessToken } = created.body.data as {
            collection: { id: string };
            accessToken: string;
        };
        await request(app)
            .patch(`/api/collections/${collection.id}`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ visibility: "public" })
            .expect(400);
        const unchanged = await request(app).get(`/api/collections/${collection.id}`).expect(200);
        expect(unchanged.body.data.visibility).toBe("private");
    });

    it("validates passwords and rejects unsafe URL protocols", async () => {
        await request(app)
            .post("/api/collections")
            .send({ name: "Short password", password: "123" })
            .expect(400);
        const login = await request(app)
            .post("/api/collections/design/sessions")
            .send({ password: "design-demo" })
            .expect(201);
        await request(app)
            .post("/api/collections/design/links")
            .set("Authorization", `Bearer ${login.body.data.accessToken}`)
            .send({ url: "javascript:alert(1)" })
            .expect(400);
    });

    it("returns stable 404 errors for missing routes and collections", async () => {
        expect((await request(app).get("/api/not-a-route").expect(404)).body).toEqual({
            error: "Route not found",
        });
        expect((await request(app).get("/api/collections/missing").expect(404)).body).toEqual({
            error: "Collection not found",
        });
    });
});
