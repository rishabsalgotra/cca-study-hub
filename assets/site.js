/* ==========================================================
   Quantum Computing — shared shell (menu, TOC, theme, quiz)
   ----------------------------------------------------------
   TO ADD A NEW TOPIC:
   1. Copy topics/_template.html to topics/<id>.html and write content.
      Every <h2 id="..."> automatically becomes a menu entry.
   2. Add one entry to TOPICS below (set ready: true and a group id).
   3. Rebuild the search index: python3 tools/build_search_index.py
   Menu, home page, search filters and prev/next links all follow GROUPS order.
   ========================================================== */
const SITE = { title: "Quantum Computing", subtitle: "quantumcompute.world · study notes", mark: "QC" };

/* Areas of the site, in display order. */
const GROUPS = [
  { id: "quantum", title: "Quantum Computing" },
  { id: "ai", title: "AI" },
  { id: "claude-cert", title: "Claude Certification" },
  { id: "cloud", title: "Cloud Computing" },
  { id: "crypto", title: "Crypto & Blockchain" },
];

const TOPICS = [
  { id: "quantum-basics", title: "Quantum Basics", href: "topics/quantum-basics.html", icon: "⚛", group: "quantum", ready: true, domain: "Basics" },
  { id: "how-llms-work", title: "How LLMs Work", href: "topics/how-llms-work.html", icon: "◇", group: "ai", ready: true, domain: "Foundations" },
  { id: "agentic-architecture", title: "Agentic Architecture", href: "topics/agentic-architecture.html", icon: "⟳", group: "ai", ready: true, domain: "D1" },
  { id: "tools-mcp", title: "Tool Design & MCP", href: "topics/tools-mcp.html", icon: "⚙", group: "ai", ready: true, domain: "D4" },
  { id: "harness-engineering", title: "Harness Engineering", href: "topics/harness-engineering.html", icon: "⛭", group: "ai", ready: true, domain: "D1 · D2 · D5" },
  { id: "claude-code", title: "Claude Code", href: "topics/claude-code.html", icon: "⌘", group: "claude-cert", ready: true, domain: "D1 · D2 · D5" },
  { id: "prompt-engineering", title: "Prompt Eng. & Structured Output", href: "topics/prompt-engineering.html", icon: "✎", group: "claude-cert", ready: false, domain: "D3" },
  { id: "context-reliability", title: "Context & Reliability", href: "topics/context-reliability.html", icon: "◎", group: "claude-cert", ready: false, domain: "D5" },
  { id: "tps-architecture", title: "1K vs 1M TPS", href: "topics/tps-architecture.html", icon: "⇶", group: "cloud", ready: true, domain: "AWS" },
  { id: "programmable-money", title: "Programmable Money", href: "topics/programmable-money.html", icon: "$", group: "crypto", ready: true, domain: "Fintech" },
];

/* Search: "static" today. To add agentic answers later, set mode to "hybrid" (static hits +
   AI answer) or "agentic", and point agentEndpoint at a service implementing docs/search.md. */
window.SEARCH_CONFIG = { mode: "static", agentEndpoint: null };

/* Topics in display order (group order, then TOPICS order within a group). */
const ORDERED_TOPICS = GROUPS.flatMap((g) => TOPICS.filter((t) => t.group === g.id));

(function () {
  const body = document.body;
  const root = (body.dataset.root || ".").replace(/\/$/, "");
  const currentId = body.dataset.topic || "home";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  /* ---- Theme ---- */
  const savedTheme = store.get("cca-theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  /* ---- Build shell around existing <main> ---- */
  const main = document.querySelector("main");
  const article = main.querySelector(".content") || main;
  const sections = [...article.querySelectorAll("h2[id]")];

  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="icon-btn menu-btn" aria-label="Open menu">☰</button>
    <a class="brand" href="${root}/index.html"><span class="brand-mark">${SITE.mark}</span>
      <span>${SITE.title}<small>${SITE.subtitle}</small></span></a>
    <span class="spacer"></span>
    <button class="icon-btn theme-btn" aria-label="Toggle theme" title="Toggle light/dark">◐</button>`;

  const layout = document.createElement("div");
  layout.className = "layout";
  const sidebar = document.createElement("nav");
  sidebar.className = "sidebar";
  sidebar.setAttribute("aria-label", "Site menu");

  const doneKey = "cca-done:" + currentId;
  let done = new Set(store.get(doneKey, []));

  function renderSidebar(filter = "") {
    const f = filter.trim().toLowerCase();
    let html = sections.length
      ? `<input class="search" type="search" placeholder="Filter this page's sections…" value="${filter.replace(/"/g, "&quot;")}" aria-label="Filter this page's sections">`
      : "";
    html += `<a class="nav-topic ${currentId === "home" ? "active" : ""}" href="${root}/index.html"><span>⌂</span>Home</a>`;
    let lastGroup = null;
    for (const t of ORDERED_TOPICS) {
      if (t.group !== lastGroup) { html += `<div class="nav-group">${GROUPS.find((g) => g.id === t.group).title}</div>`; lastGroup = t.group; }
      const active = t.id === currentId;
      html += `<a class="nav-topic ${active ? "active" : ""} ${t.ready ? "" : "soon"}" href="${root}/${t.href}">
        <span>${t.icon}</span>${t.title}<span class="badge">${t.ready ? t.domain : "soon"}</span></a>`;
      if (active && sections.length) {
        html += `<ul class="nav-sections">`;
        for (const h of sections) {
          const label = h.dataset.nav || h.textContent;
          if (f && !label.toLowerCase().includes(f) && !(h.dataset.keywords || "").toLowerCase().includes(f)) continue;
          html += `<li><a href="#${h.id}" data-id="${h.id}">${label}${done.has(h.id) ? ' <span class="done">✓</span>' : ""}</a></li>`;
        }
        html += `</ul>`;
      }
    }
    sidebar.innerHTML = html;
    const input = sidebar.querySelector(".search");
    if (input) input.addEventListener("input", (e) => {
      const pos = e.target.selectionStart;
      renderSidebar(e.target.value);
      const again = sidebar.querySelector(".search");
      again.focus(); again.setSelectionRange(pos, pos);
    });
    highlight();
  }

  const toc = document.createElement("aside");
  toc.className = "toc";
  if (sections.length) {
    toc.innerHTML = `<h5>On this page</h5>` + sections.map(h => `<a href="#${h.id}" data-id="${h.id}">${h.dataset.nav || h.textContent}</a>`).join("");
  }

  main.parentNode.insertBefore(layout, main);
  layout.append(sidebar, main, toc);
  body.insertBefore(topbar, layout);

  /* ---- "Reviewed" checkbox under each section heading ---- */
  for (const h of sections) {
    const label = document.createElement("label");
    label.className = "section-done";
    label.innerHTML = `<input type="checkbox" ${done.has(h.id) ? "checked" : ""}> Mark section as reviewed`;
    label.querySelector("input").addEventListener("change", (e) => {
      e.target.checked ? done.add(h.id) : done.delete(h.id);
      store.set(doneKey, [...done]);
      renderSidebar(sidebar.querySelector(".search")?.value || "");
    });
    h.after(label);
  }

  /* ---- Scrollspy ---- */
  let currentSection = null;
  function highlight() {
    document.querySelectorAll(".nav-sections a, .toc a").forEach(a => a.classList.toggle("current", a.dataset.id === currentSection));
  }
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { currentSection = e.target.id; highlight(); }
    }, { rootMargin: "-70px 0px -70% 0px" });
    sections.forEach(s => io.observe(s));
  }

  renderSidebar();

  /* ---- Controls ---- */
  topbar.querySelector(".menu-btn").addEventListener("click", () => body.classList.toggle("nav-open"));
  sidebar.addEventListener("click", (e) => { if (e.target.closest("a")) body.classList.remove("nav-open"); });
  topbar.querySelector(".theme-btn").addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("cca-theme", next);
  });

  /* ---- Copy buttons on code blocks ---- */
  document.querySelectorAll("pre").forEach(pre => {
    const btn = document.createElement("button");
    btn.className = "copy-btn"; btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pre.querySelector("code")?.innerText || pre.innerText); btn.textContent = "Copied"; }
      catch { btn.textContent = "Select & copy"; }
      setTimeout(() => (btn.textContent = "Copy"), 1400);
    });
    pre.appendChild(btn);
  });

  /* ---- Animated SVG diagrams: <figure class="diagram"><svg class="anim" data-still="secs"> ----
     Adds a play/pause button to the caption; starts paused (at data-still) for reduced-motion users. */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("figure.diagram svg.anim").forEach(svg => {
    const cap = svg.closest("figure").querySelector("figcaption");
    if (!cap || typeof svg.pauseAnimations !== "function") return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "anim-btn";
    const set = (playing) => {
      playing ? svg.unpauseAnimations() : svg.pauseAnimations();
      btn.textContent = playing ? "⏸ Pause" : "▶ Play";
      btn.setAttribute("aria-pressed", String(!playing));
    };
    btn.addEventListener("click", () => set(svg.animationsPaused()));
    cap.prepend(btn);
    if (reduceMotion) { svg.setCurrentTime(parseFloat(svg.dataset.still) || 0); set(false); }
    else set(true);
  });

  /* ---- Quizzes: <div class="quiz" data-answer="b"> with button.opt[data-k] ---- */
  const quizzes = [...document.querySelectorAll(".quiz")];
  const scoreEl = document.querySelector(".quiz-score");
  let answered = 0, correct = 0;
  quizzes.forEach(q => {
    q.querySelectorAll("button.opt").forEach(btn => btn.addEventListener("click", () => {
      if (q.classList.contains("answered")) return;
      q.classList.add("answered");
      const ok = btn.dataset.k === q.dataset.answer;
      btn.classList.add(ok ? "right" : "wrong");
      q.querySelector(`button.opt[data-k="${q.dataset.answer}"]`).classList.add("right");
      q.querySelectorAll("button.opt").forEach(b => (b.disabled = true));
      answered++; if (ok) correct++;
      if (scoreEl) scoreEl.textContent = `Score: ${correct} / ${answered} answered (of ${quizzes.length})`;
    }));
  });

  /* ---- Home page topic cards (optional container) ---- */
  const cards = document.querySelector("[data-topic-cards]");
  if (cards) {
    const card = (t) => t.ready
      ? `<a class="card" href="${root}/${t.href}"><h4>${t.icon} ${t.title}</h4><p class="pill">${t.domain}</p></a>`
      : `<div class="card disabled"><h4>${t.icon} ${t.title}</h4><p class="pill">Coming soon · ${t.domain}</p></div>`;
    cards.classList.remove("grid");
    cards.innerHTML = GROUPS.map((g) => {
      const ts = TOPICS.filter((t) => t.group === g.id);
      return ts.length ? `<section class="topic-group"><h4 class="topic-group-title">${g.title}</h4><div class="grid">${ts.map(card).join("")}</div></section>` : "";
    }).join("");
  }

  /* ---- Prev / next links follow the menu order (static HTML pager is the no-JS fallback) ---- */
  const pager = document.querySelector("nav.pager");
  const live = ORDERED_TOPICS.filter((t) => t.ready);
  const pos = live.findIndex((t) => t.id === currentId);
  if (pager && pos >= 0) {
    const prev = live[pos - 1], next = live[pos + 1];
    pager.innerHTML = `${prev ? `<a href="${root}/${prev.href}">← ${prev.title}</a>` : `<a href="${root}/index.html">← Home</a>`}
      ${next ? `<a href="${root}/${next.href}">${next.title} →</a>` : `<a href="${root}/index.html">Home →</a>`}`;
  }

  /* ---- Site search (static index now; agentic provider later, see docs/search.md) ---- */
  const searchScript = document.createElement("script");
  searchScript.src = `${root}/assets/search.js`;
  document.body.appendChild(searchScript);
})();
