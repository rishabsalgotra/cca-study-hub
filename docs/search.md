# Site search

Search is **static today** and designed so an **agentic search** can be added behind it
without changing the UI or the pages.

```
 ┌──────────── browser ─────────────┐        ┌──────── future backend ────────┐
 │ search UI (assets/search.js)      │        │  POST /search  (agent)          │
 │   │                               │        │   1. retrieve: search-index.json│
 │   ▼                               │  JSON  │      (+ embeddings, optional)   │
 │ SearchService ──► static provider ─┼───────►│   2. reason / rerank with an LLM │
 │               └─► agentic provider │        │   3. answer + cite chunk ids    │
 └───────────────────────────────────┘        └─────────────────────────────────┘
        ▲ assets/search-index.js / .json  ◄── tools/build_search_index.py ◄── topics/*.html
```

## 1. The index (shared by both providers)

`python3 tools/build_search_index.py` reads every page in `topics/` and writes:

| File | Used by |
|---|---|
| `assets/search-index.js` | the browser (`window.__SEARCH_INDEX__`); works over `file://` too |
| `assets/search-index.json` | any server-side or agentic search: the same chunks, as plain JSON |

Each **chunk** is one `<h2 id>` section (plus one intro chunk per page):

```json
{
  "id": "quantum-basics#bloch",
  "topic": "quantum-basics",
  "url": "topics/quantum-basics.html#bloch",
  "page": "Quantum Computing Basics",
  "section": "4. The Bloch sphere: picturing one qubit",
  "headings": ["…h3 titles…"],
  "keywords": "bloch sphere theta phi …",
  "text": "plain text of the section"
}
```

`id` is stable and is the **citation key**: an agent answer cites ids, and the UI turns them
into links. Re-run the script after editing any page; the build is deterministic.

## 2. Static provider (live now)

Runs entirely in the browser. The index is lazy-loaded the first time search opens (or on
hover of the search button).

* Inverted index with field weights: section title 8, h3 headings 5, keywords 4, page title 2, body 1.
* Light stemming, stop-word removal, prefix matching (so `entangl` matches *entanglement*),
  and edit-distance-1 typo tolerance (`entanglment`).
* Score ≈ Σ idf × saturated tf, with all-terms-match preferred, plus phrase and title bonuses.
* Snippets pick the window with the most matches; matched terms are highlighted, and the
  target page highlights them again (`?hl=` parameter) inside the opened section.
* Filter chips limit results to one area (`GROUPS` in `assets/site.js`).
* Shortcuts: `/` or `Ctrl/⌘ K` to open, `↑ ↓ Enter Esc`; `?search=term` on any URL opens search.

## 3. Agentic provider (future): the contract

Turn it on in `assets/site.js`:

```js
window.SEARCH_CONFIG = { mode: "hybrid", agentEndpoint: "https://api.quantumcompute.world/search" };
```

* `static`: today; no network calls.
* `hybrid`: static hits appear instantly; an AI answer panel fills in above them.
* `agentic`: same UI; reserved for when the agent also returns `hits` to replace static ranking.

**Request** (`POST agentEndpoint`, JSON):

```json
{ "query": "why do queues not add capacity?", "page": "/topics/tps-architecture.html",
  "candidates": ["tps-architecture#overview", "tps-architecture#queue", "…up to 8 static hit ids…"] }
```

**Response** (`200`, JSON):

```json
{
  "text": "A queue only stores work… (plain text; the UI escapes it)",
  "citations": ["tps-architecture#overview", "tps-architecture#simulator"],
  "hits": [ { "id": "…", "score": 0.92 } ]
}
```

`hits` is optional and only used in `agentic` mode. Requests are aborted when the user keeps
typing, and errors fall back gracefully to static results.

### A suggested backend

1. **Retrieval**: load `search-index.json`; start with BM25 over the chunks (same corpus as
   the browser), optionally add embeddings for semantic recall. Treat the `candidates` from
   the browser as a strong prior.
2. **Agent**: an LLM with a `search_site(query) → chunks` tool, and optionally
   `get_section(id)`, answering **only** from retrieved chunks and returning chunk ids as
   citations. Keep the corpus as untrusted data, never as instructions.
3. **Guardrails**: rate-limit per IP, cap tokens per request, cache answers by
   normalised query, log queries with no good hits (they show which content to write next).
4. **Hosting**: any HTTPS endpoint with CORS for `https://www.quantumcompute.world`
   (e.g. a serverless function behind an API gateway).

## 4. Extending in the browser

`window.SiteSearch` exposes `open(query)`, `close()`, `service` and `config`, so other
scripts (e.g. a "search this term" link) can drive the dialog.
