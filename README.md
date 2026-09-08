# Influencer Reach

A React + Express + PostgreSQL influencer sourcing workspace built around a repeatable creator-research workflow: discover/import profiles, normalize Instagram handles, block duplicates and voided accounts, score candidates, approve/void, and export a clean Excel list.

## What is included

- **React 19 + Vite + TypeScript** frontend
- **Express + TypeScript** API
- **PostgreSQL + Prisma** persistence
- One-service production build: Express serves the built React app
- Railway-ready `railway.toml`
- Exact Instagram handle normalization
- Permanent **USED** and **VOIDED** exclusion memory
- XLSX / CSV / TXT / Markdown exclusion import
- Campaign brief filters
- Deterministic creator scoring (no AI required)
- Candidate / Approved / Voided review workflow
- Clickable Instagram links in XLSX export
- Optional public web discovery with **Serper** (no Instagram scraping)

## Duplicate behavior

These are duplicates:

- `@EmmaHill`
- `emmahill`
- `https://instagram.com/emmahill/`

They all normalize to `emmahill`.

These are **not** duplicates:

- `ashleyannel`
- `ashley_annel`

Punctuation is preserved and the final normalized username is compared exactly.

## Local setup

Requirements: Node 22+ and PostgreSQL.

```bash
cp .env.example .env
npm install
npm run db:push
npm run seed      # optional demo records
npm run dev
```

Open `http://localhost:5173`.

The API runs on `http://localhost:3000` and Vite proxies `/api` automatically.

## Railway deployment

The repo is intentionally structured so **one Railway service runs both the React frontend and the API**.

1. Push this folder to GitHub.
2. Create a Railway project from the repository.
3. Add a PostgreSQL database to the Railway project.
4. Make sure the application service receives the database's `DATABASE_URL`.
5. Optional: set `SERPER_API_KEY` if you want the Discover page to find public Instagram profile URLs through web search.
6. Deploy. `railway.toml` runs the build and starts the app; startup applies committed Prisma migrations.
7. Health check endpoint: `/api/health`.

No separate frontend host is required. If you later prefer Vercel for the frontend, the client can be split out by pointing its `/api` requests to the Railway API.

## Discovery: what works now vs. what needs a provider

The platform intentionally **does not scrape Instagram directly**.

Without any external discovery key, Discover ranks and filters creators already in your database. You can populate the database by manual entry and by importing prior lists into the exclusion memory.

With `SERPER_API_KEY`, Discover also searches the public web for Instagram profile URLs that match the campaign's country/niche terms, normalizes them, checks them against your USED/VOIDED database, and stores new candidates.

Follower count, engagement, Reel performance, email and exact recent-post data are not reliably available from ordinary public search. For fully automatic enrichment, add a licensed creator-data provider later (for example a provider with an influencer discovery API) behind `server/src/lib/discovery.ts`. The rest of the application does not need to change.

## Deterministic fit score

Current 100-point weighting:

- Follower strength: **20**
- Engagement rate: **25**
- Reel performance relative to follower count: **20**
- Niche match: **15**
- Recent activity: **10**
- Public email: **5**
- Country match: **5**

AI is not involved in duplicate checking or pass/fail filtering.

## Importing your existing Hacoo / voided files

Go to **Data Vault** and import:

- old Hacoo / previous creator lists → **Previous / Used creators**
- rejected / voided lists → **Voided creators**

Supported: `.xlsx`, `.csv`, `.txt`, `.md`.

For spreadsheets, the importer searches Instagram URLs everywhere and also checks columns whose headers contain terms like Instagram, IG, handle, username, social, profile, or link.

## Production notes

This MVP does not include user authentication because it is designed first as a private internal sourcing tool. Before exposing it publicly, add authentication/authorization and rate limits.

The optional Serper adapter is a discovery source, not an Instagram metrics source. For large-scale commercial creator discovery, connect a compliant data provider rather than relying on direct social-platform scraping.
