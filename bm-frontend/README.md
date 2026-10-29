# Keepsake frontend

Keepsake is a React 19 + TypeScript bookmark manager built with Vite, React Router, and Material UI. Collections appear as folders; each collection groups saved links by normalized domain.

## Run locally

Install frontend dependencies and start the Vite server:

```sh
npm ci
npm run dev
```

In a second terminal, start the API from the sibling `bm-backend` directory:

```sh
npm ci
npm run dev
```

The frontend uses `http://localhost:3001/api` by default. Set `VITE_API_URL` in a local `.env` file to override it. The API's `FRONTEND_ORIGIN` must match the Vite origin.

## Project structure

```text
src/
  app/         Router and shared MUI theme
  components/  Domain groups and collection actions
  lib/         API client, session handling, backup and grouping helpers
  pages/       Home and collection detail routes
  types/       Frontend API contracts
```

The pages own route-level state and user flows. Presentational components render focused parts of those flows. The API client unwraps the backend's `{ data }` response envelope and maps failures to `ApiError`. Collection sessions live in tab-scoped `sessionStorage`.

The backend is a separate project; frontend changes should not change its routes or response shapes. Public collection links can be read without a session. Private collection links require one. Link edits in either visibility mode require the session issued to the creator or by unlocking a private collection.

## Checks

```sh
npm run lint
npm run format:check
npm test
npm run build
```

`format` and `format:check` cover application source, Vite configuration, and first-party project files. They intentionally exclude `.agents/skills` and `skills-lock.json`, which are managed skill artifacts rather than application source.
