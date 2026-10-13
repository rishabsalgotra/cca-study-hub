/* ==========================================================
   Site search (loaded by site.js on every page)
   ----------------------------------------------------------
   Architecture (see docs/search.md):
     SearchUI ──► SearchService ──► providers
                                      ├─ static  (this file; in-browser index, always on)
                                      └─ agentic (stub; enabled by SEARCH_CONFIG.agentEndpoint)
   Every provider speaks the same result schema:
     hit    = { id, topic, url, page, section, snippet(html), score, provider }
     answer = { text, citations: [hit ids] }
   so an agentic backend can be added later without touching the UI.
   ========================================================== */
(function () {
  "use strict";
  const body = document.body;
  const ROOT = (body.dataset.root || ".").replace(/\/$/, "");
  const CONFIG = Object.assign({ mode: "static", agentEndpoint: null, maxResults: 40 }, window.SEARCH_CONFIG || {});
  const topics = typeof TOPICS !== "undefined" ? TOPICS : [];
  const groups = typeof GROUPS !== "undefined" ? GROUPS : [];
  const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Text processing (shared by indexing and querying) ---------- */
  const STOP = new Set("a an and are as at be but by can do does for from how i if in into is it its of on or so than that the their then there these this to was what when where which who why will with you your".split(" "));
  const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  function stem(w) {
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) return w.slice(0, -1);
    return w;
  }
  const words = (s) => norm(s).match(/[a-z0-9]+/g) || [];
  const terms = (s) => words(s).map(stem);

  /* ---------- Static provider: weighted inverted index built in the browser ---------- */
  const FIELDS = [["section", 8], ["headings", 5], ["keywords", 4], ["page", 2], ["text", 1]];
  const StaticProvider = {
    name: "static",
    ready: null,
    load() {
      if (this.ready) return this.ready;
      this.ready = new Promise((resolve, reject) => {
        if (window.__SEARCH_INDEX__) return resolve(window.__SEARCH_INDEX__);
        const s = document.createElement("script");
        s.src = `${ROOT}/assets/search-index.js`;
        s.onload = () => resolve(window.__SEARCH_INDEX__);
        s.onerror = () => reject(new Error("Search index failed to load"));
        document.head.appendChild(s);
      }).then((idx) => { this.build(idx); return this; });
      return this.ready;
    },
    build(idx) {
      this.docs = idx.docs;
      this.byId = Object.fromEntries(idx.docs.map((d) => [d.id, d]));
      this.post = new Map();                                  // term -> Map(docIndex -> weighted tf)
      idx.docs.forEach((d, i) => {
        for (const [f, w] of FIELDS) {
          const val = Array.isArray(d[f]) ? d[f].join(" ") : d[f] || "";
          for (const t of terms(val)) {
            let m = this.post.get(t);
            if (!m) this.post.set(t, (m = new Map()));
            m.set(i, (m.get(i) || 0) + w);
          }
        }
        d._norm = norm(`${d.section} ${d.text}`);
      });
      this.vocab = [...this.post.keys()].sort();
      this.N = idx.docs.length;
    },
    expand(t) {
      const out = [];
      if (this.post.has(t)) out.push([t, 1]);
      if (t.length >= 2) {                                    // prefix matches via binary search on the vocabulary
        let lo = 0, hi = this.vocab.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (this.vocab[mid] < t) lo = mid + 1; else hi = mid; }
        for (let k = lo; k < this.vocab.length && out.length < 60 && this.vocab[k].startsWith(t); k++) {
          if (this.vocab[k] !== t) out.push([this.vocab[k], 0.75]);
        }
      }
      if (!out.length && t.length >= 5) {                     // typo tolerance: edit distance 1
        for (const v of this.vocab) {
          if (v[0] === t[0] && Math.abs(v.length - t.length) <= 1 && editWithin1(v, t)) out.push([v, 0.6]);
          if (out.length >= 10) break;
        }
      }
      return out;
    },
    async search(query, { group = "all" } = {}) {
      await this.load();
      let qt = [...new Set(terms(query))];
      const content = qt.filter((t) => !STOP.has(t));
      if (content.length) qt = content;
      if (!qt.length) return { hits: [], terms: [] };
      const scores = new Map(), matched = new Map(), fuzzy = new Set();
      for (const t of qt) {
        const best = new Map();
        for (const [v, factor] of this.expand(t)) {
          if (factor < 0.7) fuzzy.add(v);                    // typo-corrected words get highlighted too
          const m = this.post.get(v), idf = Math.log(1 + this.N / m.size);
          for (const [i, tf] of m) {
            const s = idf * (tf / (tf + 1.5)) * factor;
            if (s > (best.get(i) || 0)) best.set(i, s);
          }
        }
        for (const [i, s] of best) { scores.set(i, (scores.get(i) || 0) + s); matched.set(i, (matched.get(i) || 0) + 1); }
      }
      const phrase = norm(query).trim();
      let rows = [...scores].map(([i, s]) => {
        const d = this.docs[i];
        let score = s;
        const all = matched.get(i) === qt.length;
        if (!all) score *= 0.45;                              // OR fallback ranks below full matches
        if (qt.length > 1 && phrase.length > 3 && d._norm.includes(phrase)) score *= 1.6;
        if (qt.every((t) => norm(d.section).includes(t))) score *= 1.3;
        return { d, score, all };
      });
      if (rows.filter((r) => r.all).length >= 3) rows = rows.filter((r) => r.all);
      if (group !== "all") rows = rows.filter((r) => (topicById[r.d.topic] || {}).group === group);
      rows.sort((a, b) => b.score - a.score);
      const hl = [...new Set([...qt, ...fuzzy])].filter((v) => v.length >= 2);
      return {
        terms: hl,
        hits: rows.slice(0, CONFIG.maxResults).map(({ d, score }) => ({
          id: d.id, topic: d.topic, url: d.url, page: d.page, section: d.section,
          snippet: snippet(d.text, hl), score, provider: "static",
        })),
      };
    },
  };

  function editWithin1(a, b) {
    if (a === b) return true;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  const termRegex = (ts) => new RegExp(`(?<![a-z0-9])(?:${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})[a-z0-9]*`, "gi");
  function snippet(text, ts, len = 220) {
    if (!ts.length) return esc(text.slice(0, len));
    const re = termRegex(ts), hits = [...text.matchAll(re)].map((m) => m.index);
    let start = 0;
    if (hits.length) {                                        // window with the most matches
      let best = 0, bestCount = -1;
      for (const h of hits) { const c = hits.filter((x) => x >= h && x < h + len).length; if (c > bestCount) { bestCount = c; best = h; } }
      start = Math.max(0, best - 50);
      const sp = text.lastIndexOf(" ", start); if (sp > 0 && start - sp < 20) start = sp + 1;
    }
    const piece = text.slice(start, start + len);
    let out = "", last = 0;
    for (const m of piece.matchAll(termRegex(ts))) { out += esc(piece.slice(last, m.index)) + `<mark>${esc(m[0])}</mark>`; last = m.index + m[0].length; }
    out += esc(piece.slice(last));
    return (start > 0 ? "… " : "") + out + (start + len < text.length ? " …" : "");
  }

  /* ---------- Agentic provider (future): same contract, served by a backend ---------- */
  const AgentProvider = {
    name: "agentic",
    available: () => Boolean(CONFIG.agentEndpoint) && CONFIG.mode !== "static",
    /** POST { query, page, candidates: [hit ids] } → { text, citations: [ids], hits?: [...] } */
    async answer(query, hits, signal) {
      const res = await fetch(CONFIG.agentEndpoint, {
        method: "POST", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, page: location.pathname, candidates: hits.slice(0, 8).map((h) => h.id) }),
      });
      if (!res.ok) throw new Error(`Agent search failed (${res.status})`);
      return res.json();
    },
  };

  const SearchService = {
    providers: { static: StaticProvider, agentic: AgentProvider },
    search: (q, opts) => StaticProvider.search(q, opts),
    answer: (q, hits, signal) => AgentProvider.answer(q, hits, signal),
    agentic: () => AgentProvider.available(),
  };

  /* ---------- UI ---------- */
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "search-btn";
  btn.setAttribute("aria-label", "Search the site");
  btn.innerHTML = `<span aria-hidden="true">⌕</span><span class="sb-label">Search</span><kbd>${isMac ? "⌘K" : "Ctrl K"}</kbd>`;
  topbar.querySelector(".spacer").after(btn);
  btn.addEventListener("pointerenter", () => StaticProvider.load(), { once: true });

  const overlay = document.createElement("div");
  overlay.className = "search-overlay"; overlay.hidden = true;
  overlay.innerHTML = `
    <div class="search-dialog" role="dialog" aria-modal="true" aria-label="Search the site">
      <div class="search-head">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input class="search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search topics, sections and text…"
          role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list">
        <button class="search-close" type="button" aria-label="Close search">Esc</button>
      </div>
      <div class="search-chips" role="group" aria-label="Filter by area">
        <button type="button" data-group="all" aria-pressed="true">All</button>
        ${groups.map((g) => `<button type="button" data-group="${g.id}" aria-pressed="false">${g.title}</button>`).join("")}
      </div>
      <div class="search-answer" hidden aria-live="polite"></div>
      <div class="search-results" id="search-results" role="listbox" aria-label="Results"></div>
      <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close</span>
        <span class="search-mode"></span></div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector(".search-input");
  const list = overlay.querySelector(".search-results");
  const answerBox = overlay.querySelector(".search-answer");
  overlay.querySelector(".search-mode").textContent = SearchService.agentic() ? "Static + AI answers" : "Static search · AI answers coming soon";

  let group = "all", items = [], active = -1, lastFocus = null, seq = 0, answerCtl = null, timer = null;

  function open(q = "") {
    lastFocus = document.activeElement;
    overlay.hidden = false; body.classList.add("search-open");
    input.value = q; input.focus(); input.select();
    StaticProvider.load().then(run).catch(showError);
    run();
  }
  function close() {
    overlay.hidden = true; body.classList.remove("search-open");
    if (answerCtl) answerCtl.abort();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function showError(e) { list.innerHTML = `<p class="search-empty">${esc(e.message)}. Try reloading the page.</p>`; }

  async function run() {
    const q = input.value.trim(), my = ++seq;
    if (q.length < 2) return renderIdle();
    if (!StaticProvider.docs) { list.innerHTML = `<p class="search-empty">Loading index…</p>`; return; }
    const res = await SearchService.search(q, { group });
    if (my !== seq) return;                                   // a newer query has started
    render(res, q);
    clearTimeout(timer);
    if (SearchService.agentic() && res.hits.length) timer = setTimeout(() => askAgent(q, res.hits, my), 450);
  }

  function renderIdle() {
    answerBox.hidden = true;
    const recent = store.get("site-search-recent", []);
    const sugg = ["entanglement", "Bloch sphere", "idempotency", "MCP server", "stablecoin", "prompt caching"];
    items = [];
    list.innerHTML = `${recent.length ? `<div class="sr-group"><div class="sr-title">Recent</div>${recent.map((r) => `<button type="button" class="sr-chip" data-q="${esc(r)}">${esc(r)}</button>`).join("")}</div>` : ""}
      <div class="sr-group"><div class="sr-title">Try</div>${sugg.map((r) => `<button type="button" class="sr-chip" data-q="${esc(r)}">${esc(r)}</button>`).join("")}</div>`;
  }

  function render(res, q) {
    if (!res.hits.length) {
      items = []; active = -1;
      list.innerHTML = `<p class="search-empty">No results for “${esc(q)}”${group !== "all" ? " in this area. Try All." : "."}</p>`;
      return;
    }
    const byTopic = new Map();
    for (const h of res.hits) { if (!byTopic.has(h.topic)) byTopic.set(h.topic, []); byTopic.get(h.topic).push(h); }
    const hl = encodeURIComponent(res.terms.join(" "));
    let html = "", k = 0;
    for (const [tid, hs] of byTopic) {
      const t = topicById[tid] || { title: hs[0].page, icon: "•" };
      const g = groups.find((x) => x.id === t.group);
      html += `<div class="sr-group"><div class="sr-title">${t.icon} ${esc(t.title)}${g ? ` <span>${esc(g.title)}</span>` : ""}</div>`;
      for (const h of hs.slice(0, 6)) {
        const [path, hash] = h.url.split("#");
        const href = `${ROOT}/${path}?hl=${hl}${hash ? "#" + hash : ""}`;
        html += `<a class="sr-item" role="option" id="sr-${k}" href="${href}" data-k="${k}">
          <span class="sr-sec">${esc(h.section)}</span><span class="sr-snip">${h.snippet}</span></a>`;
        k++;
      }
      html += `</div>`;
    }
    list.innerHTML = html;
    items = [...list.querySelectorAll(".sr-item")];
    setActive(0);
  }

  function setActive(i) {
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((el, j) => el.setAttribute("aria-selected", String(j === active)));
    input.setAttribute("aria-activedescendant", items[active].id);
    items[active].scrollIntoView({ block: "nearest" });
  }

  async function askAgent(q, hits, my) {
    if (answerCtl) answerCtl.abort();
    answerCtl = new AbortController();
    answerBox.hidden = false; answerBox.innerHTML = `<div class="sa-label">AI answer</div><p class="sa-wait">Thinking…</p>`;
    try {
      const a = await SearchService.answer(q, hits, answerCtl.signal);
      if (my !== seq) return;
      const cites = (a.citations || []).map((id) => StaticProvider.byId[id]).filter(Boolean);
      answerBox.innerHTML = `<div class="sa-label">AI answer</div><p>${esc(a.text || "").replace(/\n/g, "<br>")}</p>
        ${cites.length ? `<div class="sa-cites">${cites.map((d) => `<a href="${ROOT}/${d.url}">${esc(d.section)}</a>`).join("")}</div>` : ""}`;
    } catch (e) {
      if (e.name !== "AbortError") answerBox.innerHTML = `<div class="sa-label">AI answer</div><p class="sa-wait">Unavailable right now. Static results are shown below.</p>`;
    }
  }

  function remember(q) {
    const r = store.get("site-search-recent", []).filter((x) => x.toLowerCase() !== q.toLowerCase());
    store.set("site-search-recent", [q, ...r].slice(0, 6));
  }

  input.addEventListener("input", () => { active = -1; run(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); remember(input.value.trim()); items[active].click(); }
  });
  list.addEventListener("click", (e) => {
    const chip = e.target.closest(".sr-chip");
    if (chip) { input.value = chip.dataset.q; input.focus(); run(); return; }
    const a = e.target.closest(".sr-item");
    if (a) { remember(input.value.trim()); close(); }
  });
  list.addEventListener("mousemove", (e) => { const a = e.target.closest(".sr-item"); if (a) setActive(+a.dataset.k); });
  overlay.querySelectorAll(".search-chips button").forEach((b) => b.addEventListener("click", () => {
    group = b.dataset.group;
    overlay.querySelectorAll(".search-chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    input.focus(); run();
  }));
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".search-close").addEventListener("click", close);
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") {                                    // keep focus inside the dialog
      const f = [...overlay.querySelectorAll("input, button, a.sr-item")].filter((x) => x.offsetParent !== null);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  btn.addEventListener("click", () => open());
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); overlay.hidden ? open() : close(); }
    else if (e.key === "/" && !typing && overlay.hidden) { e.preventDefault(); open(); }
  });

  /* ---------- Arriving from a result: highlight the terms in the target section ---------- */
  const params = new URLSearchParams(location.search);
  const hlTerms = (params.get("hl") || "").split(/\s+/).filter((t) => t.length >= 2);
  if (hlTerms.length) {
    const start = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : document.querySelector("article");
    const nodes = [];
    if (start) {
      if (start.tagName === "H2") { let el = start; do { nodes.push(el); el = el.nextElementSibling; } while (el && el.tagName !== "H2"); }
      else nodes.push(start);
    }
    const re = termRegex(hlTerms);
    let count = 0;
    for (const n of nodes) {
      const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, {
        acceptNode: (t) => (t.parentElement.closest("svg, script, style, button, .section-done") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
      for (const t of texts) {
        if (count >= 40) break;
        const parts = t.data.split(re), found = t.data.match(re);
        if (!found) continue;
        const frag = document.createDocumentFragment();
        parts.forEach((p, i) => {
          frag.appendChild(document.createTextNode(p));
          if (i < found.length) { const m = document.createElement("mark"); m.className = "search-hl"; m.textContent = found[i]; frag.appendChild(m); count++; }
        });
        t.replaceWith(frag);
      }
    }
  }
  const sq = params.get("search");
  if (sq !== null) open(sq);

  window.SiteSearch = { open, close, service: SearchService, config: CONFIG };
})();
