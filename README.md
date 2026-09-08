# Influentify V3

Influentify is a React + Express + PostgreSQL creator-sourcing workspace built for repeated influencer research: discover public Instagram profiles, normalize handles, block duplicates and voided creators, rank leads, review evidence, approve/void, and export clean Excel lists.

## Core stack

- React 19 + Vite + TypeScript
- Express + TypeScript
- PostgreSQL + Prisma
- One Railway service for frontend + backend
- Railway PostgreSQL
- Brave Search API for public-web discovery
- No AI required
- No paid influencer-data provider required

## V3 discovery engine

V3 replaces fragile search-engine HTML scraping with the official Brave Web Search API. Brave is used only as an **ephemeral locator**. Influentify takes returned result URLs, independently fetches the original public source pages, and stores only information obtained from those source pages. Brave-returned titles, snippets and result data are never written to PostgreSQL.

It can save public evidence that appears in indexed search results, including:

- Instagram handle and profile URL
- creator/display name when visible
- follower count when visible in indexed snippets
- public email when visible in indexed snippets
- country/city signals
- niche signals
- source URL and evidence snippets obtained from independently fetched public source pages

Influentify deliberately does **not** invent unavailable data. Engagement, Reel views and last-post dates remain unknown unless manually supplied or later obtained from reliable public evidence.

## Free-credit protection

Influentify includes its own monthly Brave request counter in PostgreSQL.

Defaults:

```text
BRAVE_MONTHLY_REQUEST_BUDGET=900
BRAVE_MAX_REQUESTS_PER_RUN=24
```

The dashboard shows how many app-capped Brave searches remain for the current month. The server refuses to make additional Brave requests after the app-side monthly budget is reached.

This cap is intentionally lower than the current Brave Search monthly free-credit allowance. Keep your Brave account billing/prepaid limit at $0 as an additional account-level safeguard.

## Deep Research

Open a creator and choose **Deep research this creator — free**. Influentify runs several targeted Brave searches for that exact handle and attempts to improve follower, email, website, location and niche evidence.

## Duplicate behavior

These normalize to the same creator:

- `@EmmaHill`
- `EmmaHill`
- `https://instagram.com/emmahill/`

All become `emmahill`.

These remain different:

- `ashleyannel`
- `ashley_annel`

The final normalized Instagram username is compared exactly. Punctuation is preserved.

## Data Vault

Import all previous and rejected lists before large discovery runs.

- old/used creator lists → **Previous / Used creators**
- rejected creators → **Voided creators**

Supported files: `.xlsx`, `.csv`, `.txt`, `.md`.

## Railway upgrade from V2

Keep the existing Railway service, PostgreSQL database, domain and `DATABASE_URL`.

Add/keep:

```text
BRAVE_SEARCH_API_KEY=<your Railway secret>
```

Recommended optional variables:

```text
BRAVE_MONTHLY_REQUEST_BUDGET=900
BRAVE_MAX_REQUESTS_PER_RUN=24
DISCOVERY_DELAY_MS=180
DISCOVERY_HTTP_TIMEOUT_MS=15000
SOURCE_HTTP_TIMEOUT_MS=8000
SOURCE_FETCHES_PER_QUERY=8
```

Keep Railway commands:

```text
Build:      npm run railway:build
Pre-deploy: npm run db:push
Start:      node server/dist/index.js
```

`db:push` adds the `SearchUsage` table used for the app-side monthly request counter.

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

## Ranking

Fit score remains deterministic:

- follower strength: 20
- engagement: 25
- Reel performance: 20
- niche match: 15
- recency: 10
- public email: 5
- country match: 5

Influentify also stores a separate **data confidence** score. Fit score and data confidence are intentionally separate: a creator may be a promising fit while still needing verification.

## Reliability contract

- No Instagram login automation.
- No CAPTCHA or access-control bypass.
- No guessed metrics.
- Search evidence is stored for human review.
- Used and voided handles are rejected before insertion.
- Handle normalization is deterministic and punctuation-preserving.
- Brave API key stays server-side.
- Brave Search response data is transient and is not stored.
- Persisted evidence comes from independently fetched original public source pages.
- An app-side monthly request budget limits search usage.
