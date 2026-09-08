# Architecture

```text
React / Vite
    │
    │ /api/*
    ▼
Express API
    ├── Creator CRUD
    ├── Campaign filters + scoring
    ├── XLSX/TXT/MD exclusion importer
    ├── XLSX exporter
    └── Discovery adapter
            ├── Database search (always available)
            └── Serper web discovery (optional)
    │
    ▼
Prisma ORM
    │
    ▼
PostgreSQL (Railway)
```

## Key design rule

`handle` is a unique normalized Instagram username and is the canonical de-duplication key.

Exclusions are stored independently so deleted/absent creator records still remain blocked in future discovery.
