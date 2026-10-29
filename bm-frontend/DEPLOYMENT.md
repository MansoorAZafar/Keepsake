# Vercel previews

GitHub Actions runs the frontend lint, format check, tests, and production build before it deploys a pull request preview to Vercel. Preview deployments use the same Vercel project and environment variables configured for Preview.

## One-time setup

1. Create or select a Vercel project for this repository. Set its Root Directory to `bm-frontend` and its framework preset to Vite.
2. In the GitHub repository settings, add these Actions secrets:
   - `VERCEL_TOKEN`: a Vercel access token authorized for this project.
   - `VERCEL_ORG_ID`: the Vercel team or account ID.
   - `VERCEL_PROJECT_ID`: the Vercel project ID.
3. Set the Vercel Preview environment variable `VITE_API_URL` to the public URL of the deployed backend, ending in `/api`. The backend must allow the Vercel preview origin through its CORS configuration.
4. Keep Vercel Git auto-deployments disabled if every deployment must wait for the GitHub Actions checks. This workflow performs the preview deployment only after its `Frontend checks` job succeeds.

Vercel's `vercel pull` retrieves Preview environment variables before building. Do not add Vercel tokens or database credentials to the repository. A production deployment is not configured by this preview workflow.

## Required merge check

To block pull-request merges when checks fail, protect `main` with the GitHub Actions status check named `Frontend checks`. The deployment job also depends on that check, so it will not deploy if lint, formatting, tests, or the build fails.
