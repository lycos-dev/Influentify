# Influentify V3 Architecture

```text
React / Vite UI
      |
      | same-origin /api
      v
Express API (Railway)
      |
      +-----------------------------+
      |                             |
      v                             v
PostgreSQL / Prisma          Brave Web Search API
      |                             |
      |                       Server-side API key
      |                             |
      |                       Monthly request guard
      |                             |
      |                       Query diversification
      |                       US / UK / Germany
      |                       city + niche variants
      |                             |
      |                       Ephemeral result URLs
      |                             |
      |                       Fetch original source pages
      |                             |
      |                       Source-page parsing
      |                       - Instagram handles
      |                       - follower text
      |                       - public email
      |                       - location signals
      |                       - niche signals
      |                             |
      +---------------+-------------+
                      v
              Exact handle dedupe
                      |
               USED / VOIDED check
                      |
            deterministic fit score
                      |
               data-confidence score
                      |
            Candidate review / export
```

## Search-spend guard

A `SearchUsage` PostgreSQL model tracks Brave requests by month. Before every Brave request, Influentify atomically reserves one request from the configured app budget. Once the budget is reached, public discovery stops and the app continues to use its existing Data Vault.

Defaults:

```text
BRAVE_MONTHLY_REQUEST_BUDGET=900
BRAVE_MAX_REQUESTS_PER_RUN=24
```

## Safety and reliability contract

- API key is server-side only.
- Brave API response data is never persisted; only independently fetched original-source data is stored.
- No Instagram login automation.
- No CAPTCHA bypass or access-control bypass.
- Missing metrics remain unknown.
- Search evidence is stored so the reviewer can inspect why a field was inferred.
- Previously used and voided handles are excluded before insertion.
- Handle normalization is deterministic and punctuation-preserving.
