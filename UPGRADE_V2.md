# Influentify V2 — Railway upgrade

This version replaces paid-provider discovery with a zero-paid-API public-web research engine.

## What you need to change in Railway

Nothing new.

Keep the settings you already have:

```text
DATABASE_URL = ${{Postgres.DATABASE_URL}}
Build command = npm run railway:build
Pre-deploy command = npm run db:push
Start command = node server/dist/index.js
```

`npm start` is also safe in this V2 if you later want to use the repo default.

No `SERPER_API_KEY` is needed.

## Deploy

Replace/push the V2 files to the existing GitHub repository. Railway is already connected to `main`, so the push should trigger a redeploy automatically.

The pre-deploy `db:push` will add the new research/evidence columns to the existing PostgreSQL database without deleting the creators or exclusions already stored.

## First test

1. Open **Discover**.
2. For the first test use a target count of **10** rather than 100.
3. Keep United States + United Kingdom and Fashion.
4. Click **Find creators — free public web**.
5. Open one result and inspect **Public-web evidence**.
6. Click **Deep research this creator — free**.
7. Confirm no previously imported USED/VOIDED handle reappears.

After a small successful run, increase the target count gradually.

## If free search returns zero

Public search engines may rate-limit cloud datacenter IPs. Do not add a paid API immediately. First retry later and/or increase:

```text
DISCOVERY_DELAY_MS=1200
```

The app stores everything it successfully discovers, so repeated runs gradually build Influentify's own creator database.
