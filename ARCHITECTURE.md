# Influentify Architecture

```text
React / Vite UI
      |
      | same-origin /api
      v
Express API (Railway)
      |
      +--------------------------+
      |                          |
      v                          v
PostgreSQL / Prisma       Free Public-Web Research
      |                          |
      |                    DuckDuckGo HTML/Lite
      |                          |
      |                    Query diversification
      |                          |
      |                    Profile URL extraction
      |                          |
      |                    Evidence parsing
      |                    - follower snippets
      |                    - public email
      |                    - location signals
      |                    - niche signals
      |                          |
      +-------------+------------+
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

## Safety and reliability contract

- No Instagram login automation.
- No CAPTCHA bypass or access-control bypass.
- Missing metrics remain unknown.
- Search evidence is stored so the reviewer can inspect why a field was inferred.
- Previously used and voided handles are excluded before insertion.
- Handle normalization is deterministic and punctuation-preserving.
- Public search is rate-limited by default.
