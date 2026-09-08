# Influentify V3 Railway Upgrade

You already have the hard part done: Railway, PostgreSQL, the domain and `DATABASE_URL` stay in place.

## 1. Replace the GitHub repository files

Replace the current repository contents with this V3 project and push to `main`.

## 2. Keep your existing Railway secret

```text
BRAVE_SEARCH_API_KEY=<already added>
```

Do not expose the key in React or GitHub.

## 3. Optional safety/tuning variables

You do not have to add these because V3 has defaults, but adding them makes the limits explicit:

```text
BRAVE_MONTHLY_REQUEST_BUDGET=900
BRAVE_MAX_REQUESTS_PER_RUN=24
DISCOVERY_DELAY_MS=180
DISCOVERY_HTTP_TIMEOUT_MS=15000
SOURCE_HTTP_TIMEOUT_MS=8000
SOURCE_FETCHES_PER_QUERY=8
```

## 4. Keep Railway commands exactly as they are

```text
Build:      npm run railway:build
Pre-deploy: npm run db:push
Start:      node server/dist/index.js
```

The pre-deploy step adds the new `SearchUsage` table automatically.

## 5. Redeploy

A push to `main` should trigger Railway automatically.

## 6. Test

Start small:

```text
Countries: United States + United Kingdom
Niche: Fashion
Min followers: 10,000
Min engagement: leave blank for the first search
Active within: Any time for the first search
Public email required: OFF for the first search
Target count: 10
```

Then click **Find creators — Brave Search**.

Once real profiles appear, tighten the campaign requirements. Missing engagement/activity data is intentionally shown as unknown rather than silently rejecting a potentially good creator.
