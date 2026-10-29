# Bookmark Manager API

An accountless TypeScript REST API for collections and saved links. Private collections are unlocked with a password; public collections can be browsed without one. The first storage adapter uses in-memory `Map`s; data and sessions reset whenever the process restarts.

## Run locally

```sh
npm install
npm run dev
```

The API starts on `http://localhost:3001`. Copy `.env.example` to `.env` to configure `PORT` and `FRONTEND_ORIGIN`. The seeded `design` collection password is `design-demo`.

## Endpoints

| Method | Path                                    | Access                 | Purpose                                                                                                                                                                                  |
| ------ | --------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                           | Public                 | Check server status                                                                                                                                                                      |
| GET    | `/api/collections`                      | Public metadata        | List names, descriptions, timestamps, and link counts                                                                                                                                    |
| POST   | `/api/collections`                      | Public                 | Create `{ "name", "description?", "visibility", "password?" }`; private requires a password, public forbids one. Returns collection, first session token, and one-time deletion password |
| GET    | `/api/collections/:id`                  | Public metadata        | Get one collection summary                                                                                                                                                               |
| POST   | `/api/collections/:id/sessions`         | Password               | Unlock with `{ "password" }`; returns bearer token and expiry                                                                                                                            |
| DELETE | `/api/collections/:id/sessions/current` | Bearer token           | Revoke the current session                                                                                                                                                               |
| PATCH  | `/api/collections/:id`                  | Bearer token           | Rename or edit the description                                                                                                                                                           |
| DELETE | `/api/collections/:id`                  | Deletion password      | Delete collection, links, and sessions by sending `{ "deletePassword" }`                                                                                                                 |
| GET    | `/api/collections/:id/links`            | Public or bearer token | Public links are readable by anyone; private links need a session                                                                                                                        |
| POST   | `/api/collections/:id/links`            | Bearer token           | Save `{ "url", "title?", "note?" }`                                                                                                                                                      |
| DELETE | `/api/collections/:id/links/:linkId`    | Bearer token           | Remove a saved link                                                                                                                                                                      |

Link mutations and private reads send `Authorization: Bearer <accessToken>`. Visibility is fixed at creation. Private passwords must be at least 8 characters. The server hashes passwords with salted scrypt. Session tokens are random, expire after 12 hours, and only their SHA-256 hashes are stored. A separate random deletion password is returned once; only its salted hash is stored. Link URLs without a scheme are normalized to HTTPS. Domains are lowercased and have a leading `www.` removed.

All successful JSON responses use `{ "data": ... }`; validation failures return status 400 with field details, missing collections/links return 404, and missing/invalid sessions return 401. Deletes return `204 No Content`.

## Architecture and request flow

`routes -> controllers -> service -> BookmarkRepository -> InMemoryBookmarkRepository`

Routes connect HTTP paths and verbs to controller methods. Controllers parse route parameters, validate request bodies with Zod, extract bearer tokens, and translate results into HTTP responses. `BookmarkService` contains the rules: visibility-aware reads, password verification, deletion authorization, session expiry, URL normalization, and link titles. The `BookmarkRepository` interface is the persistence boundary. Its current Map-backed implementation seeds the design example, hashes are stored instead of raw credentials, and collection deletion cascades to its links and sessions. The seed collection's local deletion password is `design-delete-demo`.

The repository interface returns Promises even though Maps are synchronous. A Neon/Postgres implementation can use asynchronous queries behind the same service contract. Keep SQL and Prisma/Drizzle details inside that adapter; routes and UI should continue using the same API DTOs.

`ARCHITECTURE.md` explains the model types, access flow, interface contract, and migration path in more depth.

## Tests

```sh
npm test
npm run build
```

Vitest covers password/token helpers, repository behavior, service/session rules, and HTTP routes and validation.

## Local-development scope

Collection metadata is listable so the home page can browse without an account; public link contents are openly readable, private links require a collection session, and edits require a session for either visibility. In-memory storage is not durable. For a public deployment, use HTTPS and an HttpOnly secure cookie or a carefully reviewed token store, add password-attempt throttling, and configure Neon backups and migrations.
