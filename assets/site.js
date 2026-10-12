/* ==========================================================
   CCA Study Hub — shared shell (menu, TOC, theme, quiz)
   ----------------------------------------------------------
   TO ADD A NEW TOPIC:
   1. Copy topics/_template.html to topics/<id>.html and write content.
      Every <h2 id="..."> automatically becomes a menu entry.
   2. Add one entry to TOPICS below (set ready: true).
   ========================================================== */
const SITE = { title: "CCA Study Hub", subtitle: "Claude Certified Architect – Foundations" };

const TOPICS = [
  { id: "claude-code", title: "Claude Code", href: "topics/claude-code.html", icon: "⌘", group: "Topics", ready: true, domain: "D1 · D2 · D5" },
  { id: "how-llms-work", title: "How LLMs Work", href: "topics/how-llms-work.html", icon: "◇", group: "Topics", ready: true, domain: "Foundations" },
  { id: "programmable-money", title: "Programmable Money", href: "topics/programmable-money.html", icon: "$", group: "Fintech", ready: true, domain: "Fintech" },
  { id: "agentic-architecture", title: "Agentic Architecture", href: "topics/agentic-architecture.html", icon: "⟳", group: "Coming next", ready: false, domain: "D1" },
  { id: "tools-mcp", title: "Tool Design & MCP", href: "topics/tools-mcp.html", icon: "⚙", group: "Coming next", ready: false, domain: "D4" },
  { id: "prompt-engineering", title: "Prompt Eng. & Structured Output", href: "topics/prompt-engineering.html", icon: "✎", group: "Coming next", ready: false, domain: "D3" },
  { id: "context-reliability", title: "Context & Reliability", href: "topics/context-reliability.html", icon: "◎", group: "Coming next", ready: false, domain: "D5" },
];

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
    <a class="brand" href="${root}/index.html"><span class="brand-mark">CA</span>
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
    let html = `<input class="search" type="search" placeholder="Filter sections…" value="${filter.replace(/"/g, "&quot;")}" aria-label="Filter sections">`;
    html += `<a class="nav-topic ${currentId === "home" ? "active" : ""}" href="${root}/index.html"><span>⌂</span>Home</a>`;
    let lastGroup = null;
    for (const t of TOPICS) {
      if (t.group !== lastGroup) { html += `<div class="nav-group">${t.group}</div>`; lastGroup = t.group; }
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
    input.addEventListener("input", (e) => {
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
      renderSidebar(sidebar.querySelector(".search").value);
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
    cards.innerHTML = TOPICS.map(t => t.ready
      ? `<a class="card" href="${root}/${t.href}"><h4>${t.icon} ${t.title}</h4><p class="pill">${t.domain}</p></a>`
      : `<div class="card disabled"><h4>${t.icon} ${t.title}</h4><p class="pill">Coming soon · ${t.domain}</p></div>`).join("");
  }
})();
