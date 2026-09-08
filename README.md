# Influentify

Influentify is a React + Express + PostgreSQL creator-sourcing workspace built for repeated influencer research: discover public Instagram profiles, normalize handles, block duplicates and voided creators, rank leads, review evidence, approve/void, and export clean Excel lists.

## Core stack

- React 19 + Vite + TypeScript
- Express + TypeScript
- PostgreSQL + Prisma
- One Railway service for frontend + backend
- Railway PostgreSQL
- No AI required
- No paid influencer-data provider required

## Free public-web discovery

Influentify V2 includes a **zero-paid-API discovery adapter** using DuckDuckGo's public non-JavaScript search results.

The worker generates diversified searches using campaign country, city and niche combinations, then extracts public Instagram profile results. It can save public evidence that appears in indexed search results, including:

- Instagram handle and profile URL
- creator/display name when visible
- follower count when visible in an indexed snippet
- public email when visible in an indexed snippet
- country/city signals from public text
- niche signals from public text
- source snippet and evidence

Influentify deliberately does **not** invent unavailable data. Engagement, Reel views and last-post dates remain unknown unless they are manually supplied or later obtained from a reliable public source.

Free search can be rate-limited or return incomplete results. The app treats missing fields as **unknown**, not as failed criteria. Known values that contradict the campaign still reject the candidate.

## Deep Research

Open any creator and choose **Deep research this creator — free**. Influentify runs additional public-web searches for that exact handle and attempts to improve saved follower, email, location and niche evidence.

## Duplicate behavior

These normalize to the same creator:

- `@EmmaHill`
- `EmmaHill`
- `https://instagram.com/emmahill/`

All become `emmahill`.

These stay different:

- `ashleyannel`
- `ashley_annel`

The final normalized Instagram username is compared exactly. Punctuation is preserved.

## Data Vault

Import all previous and rejected lists before large discovery runs.

- old/used creator lists → **Previous / Used creators**
- rejected creators → **Voided creators**

Supported files: `.xlsx`, `.csv`, `.txt`, `.md`.

The importer searches Instagram URLs across spreadsheet cells and also inspects likely social-handle columns.

## Local setup

Requirements: Node 22+ and PostgreSQL.

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Frontend: `http://localhost:5173`
API: `http://localhost:3000`

## Railway deployment

1. Push the repository to GitHub.
2. Connect the repository to a Railway service.
3. Add Railway PostgreSQL.
4. Set the app variable:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

5. Build command:

```text
npm run railway:build
```

6. Pre-deploy command:

```text
npm run db:push
```

7. Start command:

```text
npm start
```

8. Deploy.

`npm start` now starts the compiled server directly. Schema sync is intentionally handled only by the Railway pre-deploy command, avoiding the earlier Prisma `P3005` conflict.

## Optional free-discovery tuning

No keys are required. These environment variables are optional:

```text
DISCOVERY_DELAY_MS=650
DISCOVERY_HTTP_TIMEOUT_MS=12000
```

Increasing `DISCOVERY_DELAY_MS` makes the worker gentler if public search rate-limits Railway's IP.

## Ranking

Fit score remains deterministic:

- follower strength: 20
- engagement: 25
- Reel performance: 20
- niche match: 15
- recency: 10
- public email: 5
- country match: 5

Influentify also stores a separate **data confidence** score. Fit score and data confidence are intentionally different: a creator can look like a strong fit while still needing more verification.

## Important limitation

There is no legitimate free source that guarantees complete Instagram analytics for every public creator. Influentify's free mode is therefore a research engine, not a fake analytics API. It uses indexed public-web evidence, exact deduplication and a growing internal database to reduce repeated manual work over time.
