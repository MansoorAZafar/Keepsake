# Deployment

## Frontend on Vercel

GitHub Actions runs frontend linting, format checks, tests, and a production build on pushes and relevant pull requests. It deploys to Vercel Production only after those checks pass on a pushed Git tag beginning with `v` (for example, `v0.0.1`). Branch pushes and pull requests do not deploy.

One-time setup:

1. Create or select a Vercel project for this repository. Set its Root Directory to `bm-frontend` and framework preset to Vite.
2. Add GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
3. Set the Vercel Production environment variable `VITE_API_URL` to the public backend URL ending in `/api`.
4. Disable Vercel Git auto-deployments if deployments must only happen after these checks. GitHub Actions performs the production deployment.

Release the frontend by tagging a commit and pushing the tag:

```sh
git tag v0.0.1
git push origin v0.0.1
```

## Backend Docker image on Docker Hub

The backend workflow runs linting, formatting, tests, and the TypeScript build on pushes and relevant pull requests. It publishes a Docker image only after checks pass for a pushed Git tag beginning with `bv` (for example, `bv0.0.1`). A release publishes both `DOCKERHUB_USERNAME/bookmark-manager-backend:bv0.0.1` and the moving `:latest` tag.

One-time setup:

1. Create a Docker Hub repository named `bookmark-manager-backend` (public images are simplest for Back4App to pull).
2. Add GitHub Actions secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. Use a Docker Hub access token.
3. In Back4App, select the Docker Hub image `DOCKERHUB_USERNAME/bookmark-manager-backend:latest` and configure runtime environment variables such as `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `FRONTEND_ORIGIN`, and `PORT` in the Back4App service settings. Secrets belong in the service environment, never in the image.

Release the backend image by tagging a commit and pushing the tag:

```sh
git tag bv0.0.1
git push origin bv0.0.1
```

The workflow pushes the image to Docker Hub. Back4App remains responsible for pulling/redeploying the configured image according to its service settings; this workflow does not call Back4App directly.

## Branch protection

To block pull-request merges when checks fail, protect `main` with the `Frontend checks` and `Backend checks` GitHub Actions status checks. Both deploy/publish jobs depend on the corresponding checks.
