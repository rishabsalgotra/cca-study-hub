/* ==========================================================
   Quantum Computing — shared shell (menu, TOC, theme, quiz, progress)
   ----------------------------------------------------------
   TO ADD A NEW TOPIC:
   1. Copy topics/_template.html to topics/<id>.html and write content.
      Every <h2 id="..."> automatically becomes a menu entry.
   2. Add one entry to TOPICS below (set ready: true, a group id, an icon
      name from ICONS, and a one-line blurb for the home page).
   3. Rebuild the search index: python3 tools/build_search_index.py
   Menu, home page, search filters and prev/next links all follow GROUPS order.
   ========================================================== */
const SITE = { title: "Quantum Computing", subtitle: "quantumcompute.world · study notes" };

/* Areas of the site, in display order. */
const GROUPS = [
  { id: "quantum", title: "Quantum Computing", icon: "mark" },
  { id: "ai", title: "Artificial Intelligence", icon: "cpu" },
  { id: "claude-cert", title: "Claude Certification", icon: "award" },
  { id: "cloud", title: "Cloud Computing", icon: "cloud" },
  { id: "crypto", title: "Crypto & Blockchain", icon: "link" },
];

/* sections / quiz = counts shown on the home page before a topic has been opened
   (the live section count from the page replaces `sections` once it is visited). */
const TOPICS = [
  { id: "quantum-basics", title: "Quantum Basics", href: "topics/quantum-basics.html", icon: "atom", group: "quantum", ready: true, domain: "Basics", sections: 19, quiz: 8,
    blurb: "From bits to qubits: the Bloch sphere, measurement, interference, gates, entanglement, error correction, algorithms and hardware, with an in-browser circuit simulator." },
  { id: "how-llms-work", title: "How LLMs Work", href: "topics/how-llms-work.html", icon: "sparkles", group: "ai", ready: true, domain: "Foundations", sections: 16, quiz: 8,
    blurb: "Follow one prompt through tokenization, embeddings, attention, logits, sampling and the KV cache." },
  { id: "agentic-architecture", title: "Agentic Architecture", href: "topics/agentic-architecture.html", icon: "workflow", group: "ai", ready: true, domain: "D1", sections: 10, quiz: 8,
    blurb: "The agent loop, workflows vs agents, the five workflow patterns, multi-agent orchestration and memory." },
  { id: "tools-mcp", title: "Tool Design & MCP", href: "topics/tools-mcp.html", icon: "plug", group: "ai", ready: true, domain: "D4", sections: 14, quiz: 8,
    blurb: "Designing tools agents use well, and wiring them up with the Model Context Protocol." },
  { id: "harness-engineering", title: "Harness Engineering", href: "topics/harness-engineering.html", icon: "shield", group: "ai", ready: true, domain: "D1 · D2 · D5", sections: 13, quiz: 8,
    blurb: "Everything around the model: control loop, context, permissions, hooks, sandboxing, verification and evals." },
  { id: "claude-code", title: "Claude Code", href: "topics/claude-code.html", icon: "terminal", group: "claude-cert", ready: true, domain: "D1 · D2 · D5", sections: 16, quiz: 10,
    blurb: "CLAUDE.md, settings, permissions, skills, subagents, hooks, MCP, headless/CI and the Agent SDK." },
  { id: "prompt-engineering", title: "Prompt Eng. & Structured Output", href: "topics/prompt-engineering.html", icon: "pen", group: "claude-cert", ready: false, domain: "D3",
    blurb: "Prompt structure, examples, and reliable structured output." },
  { id: "context-reliability", title: "Context & Reliability", href: "topics/context-reliability.html", icon: "target", group: "claude-cert", ready: false, domain: "D5",
    blurb: "Context windows, compaction, caching and failure handling." },
  { id: "tps-architecture", title: "1K vs 1M TPS", href: "topics/tps-architecture.html", icon: "gauge", group: "cloud", ready: true, domain: "AWS", sections: 10, quiz: 6,
    blurb: "An interactive explorer: 1,000 TPS on API Gateway + Lambda versus a sharded 1-million-TPS design." },
  { id: "programmable-money", title: "Programmable Money", href: "topics/programmable-money.html", icon: "coins", group: "crypto", ready: true, domain: "Fintech", sections: 13, quiz: 6,
    blurb: "Tokenized deposits and stablecoins: how they work, how to build them, and why banks care." },
];

/* Search: "static" today. To add agentic answers later, set mode to "hybrid" (static hits +
   AI answer) or "agentic", and point agentEndpoint at a service implementing docs/search.md. */
window.SEARCH_CONFIG = { mode: "static", agentEndpoint: null };

/* Topics in display order (group order, then TOPICS order within a group). */
const ORDERED_TOPICS = GROUPS.flatMap((g) => TOPICS.filter((t) => t.group === g.id));

/* Line icons (24×24, stroke = currentColor). */
const ICONS = {
  atom: '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
  sparkles: '<path d="M9.94 14.6A2 2 0 0 0 8.5 13.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 8.94A2 2 0 0 0 9.94 7.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 7.5A2 2 0 0 0 15.5 8.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 13.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>',
  workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  pen: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowUp: '<path d="m5 12 7-7 7 7M12 19V5"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  play: '<path d="M6 4.5v15a.5.5 0 0 0 .76.43l12.5-7.5a.5.5 0 0 0 0-.86L6.76 4.07A.5.5 0 0 0 6 4.5Z"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  exam: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trap: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  tip: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  warn: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  award: '<path d="m15.48 12.89 1.51 8.53a.5.5 0 0 1-.81.47l-3.58-2.69a1 1 0 0 0-1.2 0l-3.59 2.69a.5.5 0 0 1-.81-.47l1.51-8.53"/><circle cx="12" cy="8" r="6"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  mark: '<ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-30 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(30 12 12)" opacity=".45"/><circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none"/><circle cx="20.66" cy="7" r="1.4" fill="currentColor" stroke="none"/>',
};
const icon = (name, cls = "ico") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
window.SiteIcon = icon;

(function () {
  const doc = document.documentElement;
  const body = document.body;
  doc.classList.add("js");
  const root = (body.dataset.root || ".").replace(/\/$/, "");
  const currentId = body.dataset.topic || "home";
  const currentTopic = TOPICS.find((t) => t.id === currentId);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Per-topic progress: reviewed sections / total sections. */
  const progressOf = (t) => {
    const total = store.get("cca-total:" + t.id, t.sections || 0);
    const done = Math.min(store.get("cca-done:" + t.id, []).length, total);
    return { done, total, pct: total ? done / total : 0 };
  };

  /* ---- Theme ---- */
  const savedTheme = store.get("cca-theme", null);
  if (savedTheme) doc.dataset.theme = savedTheme;

  /* ---- Build shell around existing <main> ---- */
  const main = document.querySelector("main");
  main.id = main.id || "main";
  const article = main.querySelector(".content") || main;
  const sections = currentTopic ? [...article.querySelectorAll("h2[id]")] : [];   /* home page h2s are not study sections */
  const sectionLabels = new Map(sections.map((h) => [h.id, h.dataset.nav || h.textContent.trim()]));
  if (currentTopic && sections.length) store.set("cca-total:" + currentId, sections.length);

  const skip = document.createElement("a");
  skip.className = "skip-link"; skip.href = "#" + main.id; skip.textContent = "Skip to content";

  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-menu">${icon("menu")}</button>
    <a class="brand" href="${root}/index.html"><span class="brand-mark">${icon("mark")}</span>
      <span>${SITE.title}<small>${SITE.subtitle}</small></span></a>
    <span class="spacer"></span>
    <button class="icon-btn theme-btn" type="button" aria-label="Toggle dark mode" title="Toggle light/dark">${icon("moon", "ico i-moon")}${icon("sun", "ico i-sun")}</button>
    ${sections.length ? '<div class="read-progress" aria-hidden="true"></div>' : ""}`;

  const layout = document.createElement("div");
  layout.className = "layout";
  const sidebar = document.createElement("nav");
  sidebar.className = "sidebar"; sidebar.id = "site-menu";
  sidebar.setAttribute("aria-label", "Site menu");
  const scrim = document.createElement("div");
  scrim.className = "scrim";

  const doneKey = "cca-done:" + currentId;
  let done = new Set(store.get(doneKey, []));

  /* Menu: Home, then one collapsible area per GROUP (areas → topics → this page's sections).
     Collapsed areas are remembered; the area holding the current topic always opens. */
  const collapsed = new Set(store.get("cca-nav-collapsed", []));
  if (currentTopic) collapsed.delete(currentTopic.group);

  function topicRow(t, secs) {
    const active = t.id === currentId;
    const p = progressOf(t);
    const trail = !t.ready ? `<span class="badge">soon</span>`
      : p.done ? `<span class="nav-ring" style="--v:${p.pct.toFixed(3)}" title="${p.done} of ${p.total} sections reviewed"></span>`
      : `<span class="badge">${t.domain}</span>`;
    let html = `<a class="nav-topic ${active ? "active" : ""} ${t.ready ? "" : "soon"}" href="${root}/${t.href}" ${active ? 'aria-current="page"' : ""} ${t.ready ? "" : 'aria-disabled="true" tabindex="-1"'}>${icon(t.icon)}<span class="nt-label">${t.title}</span>${trail}</a>`;
    if (secs.length) {
      html += `<ul class="nav-sections" aria-label="Sections in ${esc(t.title)}">` + secs.map((h) =>
        `<li><a href="#${h.id}" data-id="${h.id}"><span class="ns-label">${esc(sectionLabels.get(h.id))}</span>${done.has(h.id) ? `<span class="done" title="Reviewed">${icon("check")}</span>` : ""}</a></li>`).join("") + `</ul>`;
    }
    return html;
  }

  function renderSidebar(filter = "") {
    const f = filter.trim().toLowerCase();
    const hit = (str) => !f || String(str || "").toLowerCase().includes(f);
    const keepScroll = sidebar.scrollTop;
    const home = currentId === "home";
    let html = `<div class="nav-filter">${icon("search")}<input class="search" type="search" placeholder="Filter menu…" value="${esc(filter)}" aria-label="Filter topics and sections"></div>`;
    if (hit("home")) html += `<a class="nav-home ${home ? "active" : ""}" href="${root}/index.html" ${home ? 'aria-current="page"' : ""}><span class="na-ico">${icon("home")}</span><span class="na-title">Home</span></a>`;
    let any = false;
    for (const g of GROUPS) {
      const groupHit = hit(g.title);
      const rows = [];
      for (const t of TOPICS.filter((x) => x.group === g.id)) {
        const topicHit = groupHit || hit(t.title) || hit(t.domain);
        const secs = t.id === currentId ? sections.filter((h) => topicHit || hit(sectionLabels.get(h.id)) || hit(h.dataset.keywords)) : [];
        if (topicHit || secs.length) rows.push(topicRow(t, secs));
      }
      if (!rows.length) continue;
      any = true;
      const open = f ? true : !collapsed.has(g.id);
      const ready = TOPICS.filter((t) => t.group === g.id && t.ready).length;
      const cur = currentTopic?.group === g.id;
      html += `<section class="nav-area ${cur ? "is-current" : ""}">
        <button type="button" class="nav-area-head" data-group="${g.id}" aria-expanded="${open}" aria-controls="area-${g.id}">
          <span class="na-ico">${icon(g.icon)}</span><span class="na-title">${g.title}</span>
          <span class="na-count" title="${ready} topic${ready === 1 ? "" : "s"} available">${ready}</span>${icon("chevron", "ico na-chev")}</button>
        <div class="nav-area-body" id="area-${g.id}" ${open ? "" : "data-collapsed inert"}><div class="nav-area-inner">${rows.join("")}</div></div></section>`;
    }
    if (!any) html += `<p class="nav-empty">Nothing matches “${esc(filter.trim())}”.</p>`;

    const live = ORDERED_TOPICS.filter((t) => t.ready).map(progressOf);
    const d = live.reduce((n, p) => n + p.done, 0), tot = live.reduce((n, p) => n + p.total, 0);
    html += `<div class="nav-foot"><div class="nf-row"><span>Your progress</span><b>${d} / ${tot}</b></div>
      <div class="nf-bar"><i style="width:${tot ? (d / tot) * 100 : 0}%"></i></div><span class="nf-note">sections reviewed across all topics</span></div>`;

    sidebar.innerHTML = html;
    sidebar.scrollTop = keepScroll;
    sidebar.querySelector(".search").addEventListener("input", (e) => {
      const pos = e.target.selectionStart;
      renderSidebar(e.target.value);
      const again = sidebar.querySelector(".search");
      again.focus(); again.setSelectionRange(pos, pos);
    });
    sidebar.querySelectorAll(".nav-area-head").forEach((btn) => btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      const panel = sidebar.querySelector("#area-" + btn.dataset.group);
      btn.setAttribute("aria-expanded", String(open));
      panel.toggleAttribute("data-collapsed", !open);
      panel.inert = !open;
      if (!f) { open ? collapsed.delete(btn.dataset.group) : collapsed.add(btn.dataset.group); store.set("cca-nav-collapsed", [...collapsed]); }
    }));
    highlight();
  }

  /* Keep an item visible inside the sidebar's own scroll area (never scrolls the page). */
  function keepInView(el, force = false) {
    if (!el || (!force && sidebar.matches(":hover"))) return;
    const r = el.getBoundingClientRect(), s = sidebar.getBoundingClientRect();
    if (!s.height) return;
    if (r.top < s.top + 56 || r.bottom > s.bottom - 110) sidebar.scrollTop += r.top - s.top - s.height / 3;
  }

  const toc = document.createElement("aside");
  toc.className = "toc";
  toc.setAttribute("aria-label", "On this page");
  if (sections.length) {
    toc.innerHTML = `<h5>On this page</h5><nav>${sections.map((h) => `<a href="#${h.id}" data-id="${h.id}">${esc(sectionLabels.get(h.id))}</a>`).join("")}</nav>
      <a class="toc-top" href="#">${icon("arrowUp")}Back to top</a>`;
    toc.querySelector(".toc-top").addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); });
  }

  main.parentNode.insertBefore(layout, main);
  layout.append(sidebar, main, toc);
  body.insertBefore(topbar, layout);
  body.insertBefore(skip, topbar);
  body.appendChild(scrim);

  /* ---- Topic progress bar under the intro ---- */
  let progressEl = null;
  function renderTopicProgress() {
    if (!progressEl) return;
    const n = sections.filter((h) => done.has(h.id)).length;
    progressEl.innerHTML = `<div class="tp-track"><div class="tp-fill" style="width:${(n / sections.length) * 100}%"></div></div>
      <span>${n === sections.length ? "All sections reviewed" : `${n} of ${sections.length} sections reviewed`}</span>`;
  }
  if (currentTopic && sections.length) {
    progressEl = document.createElement("div");
    progressEl.className = "topic-progress";
    const anchor = article.querySelector(".meta-row") || article.querySelector(".lede") || article.querySelector("h1");
    if (anchor) { anchor.after(progressEl); renderTopicProgress(); }
  }

  /* ---- Heading anchors + "Reviewed" toggle under each section heading ---- */
  for (const h of sections) {
    const a = document.createElement("a");
    a.className = "h-anchor"; a.href = "#" + h.id;
    a.setAttribute("aria-label", `Link to section: ${sectionLabels.get(h.id)}`);
    a.innerHTML = icon("hash");
    h.prepend(a);

    const label = document.createElement("label");
    label.className = "section-done";
    label.innerHTML = `<input type="checkbox" ${done.has(h.id) ? "checked" : ""}> <span>Mark as reviewed</span>`;
    label.querySelector("input").addEventListener("change", (e) => {
      e.target.checked ? done.add(h.id) : done.delete(h.id);
      store.set(doneKey, [...done]);
      renderSidebar(sidebar.querySelector(".search")?.value || "");
      renderTopicProgress();
    });
    h.after(label);
  }

  /* ---- Scrollspy + "continue where you left off" ---- */
  let currentSection = null;
  function highlight() {
    document.querySelectorAll(".nav-sections a, .toc a[data-id]").forEach((a) => {
      const on = a.dataset.id === currentSection;
      a.classList.toggle("current", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
    keepInView(sidebar.querySelector(".nav-sections a.current"));
  }
  const remember = () => {
    if (currentTopic?.ready) store.set("cca-last", { id: currentId, section: currentSection, label: currentSection ? sectionLabels.get(currentSection) : null });
  };
  remember();
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { currentSection = e.target.id; highlight(); remember(); }
    }, { rootMargin: "-70px 0px -70% 0px" });
    sections.forEach((s) => io.observe(s));
  }

  renderSidebar();
  keepInView(sidebar.querySelector(".nav-topic.active"), true);

  /* ---- Reading progress (topbar hairline) ---- */
  const bar = topbar.querySelector(".read-progress");
  if (bar) {
    let ticking = false;
    const update = () => {
      const max = doc.scrollHeight - innerHeight;
      bar.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
      ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---- Controls ---- */
  const menuBtn = topbar.querySelector(".menu-btn");
  const setNav = (open) => {
    body.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuBtn.innerHTML = icon(open ? "close" : "menu");
    if (open) requestAnimationFrame(() => keepInView(sidebar.querySelector(".nav-sections a.current, .nav-topic.active"), true));
  };
  menuBtn.addEventListener("click", () => setNav(!body.classList.contains("nav-open")));
  scrim.addEventListener("click", () => setNav(false));
  sidebar.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("nav-open")) { setNav(false); menuBtn.focus(); }
  });
  topbar.querySelector(".theme-btn").addEventListener("click", () => {
    const isDark = doc.dataset.theme ? doc.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    doc.dataset.theme = next;
    store.set("cca-theme", next);
  });

  /* ---- Callouts: swap a leading emoji in the title for a matching line icon ---- */
  const EMOJI = /^[\s\p{Extended_Pictographic}️‍]+/u;
  document.querySelectorAll(".callout > .title").forEach((t) => {
    const kind = ["exam", "trap", "tip", "warn"].find((k) => t.parentElement.classList.contains(k)) || "info";
    const first = t.firstChild;
    if (first && first.nodeType === 3) first.data = first.data.replace(EMOJI, "");
    t.insertAdjacentHTML("afterbegin", icon(kind));
  });

  /* ---- Copy buttons on code blocks ---- */
  document.querySelectorAll("pre").forEach((pre) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "copy-btn";
    const idle = `${icon("copy")}Copy`;
    btn.innerHTML = idle;
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pre.querySelector("code")?.innerText || pre.innerText); btn.innerHTML = `${icon("check")}Copied`; }
      catch { btn.textContent = "Select & copy"; }
      setTimeout(() => (btn.innerHTML = idle), 1400);
    });
    pre.appendChild(btn);
  });

  /* ---- Animated SVG diagrams: <figure class="diagram"><svg class="anim" data-still="secs"> ----
     Adds a play/pause button to the caption; starts paused (at data-still) for reduced-motion users. */
  document.querySelectorAll("figure.diagram svg.anim").forEach((svg) => {
    const cap = svg.closest("figure").querySelector("figcaption");
    if (!cap || typeof svg.pauseAnimations !== "function") return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "anim-btn";
    const set = (playing) => {
      playing ? svg.unpauseAnimations() : svg.pauseAnimations();
      btn.innerHTML = playing ? `${icon("pause")}Pause` : `${icon("play")}Play`;
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
  quizzes.forEach((q) => {
    q.querySelectorAll("button.opt").forEach((btn) => btn.addEventListener("click", () => {
      if (q.classList.contains("answered")) return;
      const ok = btn.dataset.k === q.dataset.answer;
      q.classList.add("answered", ok ? "correct" : "incorrect");
      btn.classList.add(ok ? "right" : "wrong");
      q.querySelector(`button.opt[data-k="${q.dataset.answer}"]`).classList.add("right");
      q.querySelectorAll("button.opt").forEach((b) => (b.disabled = true));
      answered++; if (ok) correct++;
      if (scoreEl) scoreEl.textContent = `Score: ${correct} / ${answered} answered (of ${quizzes.length})`;
    }));
  });

  /* ---- Home page: topic cards, stats, continue card ---- */
  const live = ORDERED_TOPICS.filter((t) => t.ready);
  const cards = document.querySelector("[data-topic-cards]");
  if (cards) {
    const areaOf = (t) => GROUPS.find((g) => g.id === t.group).title;
    const card = (t, featured) => {
      if (!t.ready) return `<div class="tcard soon"><div class="t-top"><span class="t-ico">${icon(t.icon)}</span><span class="t-tag">${t.domain} · soon</span></div>
        <div><span class="t-area">${areaOf(t)}</span><h3>${t.title}</h3></div><p>${t.blurb}</p></div>`;
      if (featured) return `<a class="tcard featured" href="${root}/${t.href}"><span class="t-ico">${icon(t.icon)}</span>
        <h3><span class="t-area">${areaOf(t)} · start here</span>${t.title}</h3><span class="t-go">Begin ${icon("arrowRight")}</span><div class="t-meta"><p>${t.blurb}</p></div></a>`;
      const p = progressOf(t);
      const foot = p.done
        ? `<span class="t-bar"><i style="width:${p.pct * 100}%"></i></span><span>${p.done}/${p.total}</span>`
        : `<span style="flex:1">${p.total} sections · ${t.quiz} questions</span>`;
      return `<a class="tcard" href="${root}/${t.href}"><div class="t-top"><span class="t-ico">${icon(t.icon)}</span><span class="t-tag">${t.domain}</span></div>
        <div><span class="t-area">${areaOf(t)}</span><h3>${t.title}</h3></div><p>${t.blurb}</p><div class="t-foot">${foot}<span class="t-go">Open ${icon("arrowRight")}</span></div></a>`;
    };
    cards.innerHTML = `<div class="tgrid">${ORDERED_TOPICS.map((t) => card(t, t === live[0])).join("")}</div>`;
  }

  const stats = {
    topics: live.length,
    sections: live.reduce((n, t) => n + progressOf(t).total, 0),
    quiz: live.reduce((n, t) => n + (t.quiz || 0), 0),
    reviewed: live.reduce((n, t) => n + progressOf(t).done, 0),
  };
  document.querySelectorAll("[data-stat]").forEach((el) => { if (el.dataset.stat in stats) el.textContent = stats[el.dataset.stat]; });

  const cont = document.querySelector("[data-continue]");
  const last = store.get("cca-last", null);
  const lastTopic = last && TOPICS.find((t) => t.id === last.id && t.ready);
  if (cont && lastTopic) {
    cont.href = `${root}/${lastTopic.href}${last.section ? "#" + encodeURIComponent(last.section) : ""}`;
    cont.innerHTML = `<span class="c-ico">${icon("history")}</span><span class="c-body"><small>Continue where you left off</small>
      <strong>${esc(lastTopic.title)}${last.label ? ` · ${esc(last.label)}` : ""}</strong></span><span class="c-arrow">${icon("arrowRight")}</span>`;
    cont.hidden = false;
  }

  document.querySelectorAll("[data-open-search]").forEach((b) => b.addEventListener("click", () => window.SiteSearch?.open()));

  if (reduceMotion) document.querySelectorAll(".hero-art svg").forEach((s) => s.pauseAnimations?.());

  /* ---- Prev / next cards follow the menu order (static HTML pager is the no-JS fallback) ---- */
  const pager = document.querySelector("nav.pager");
  const pos = live.findIndex((t) => t.id === currentId);
  if (pager && pos >= 0) {
    const pg = (t, dir) => `<a class="pg ${dir}" href="${root}/${t ? t.href : "index.html"}">
      <small>${dir === "prev" ? `${icon("arrowLeft")}Previous` : `Next${icon("arrowRight")}`}</small>${t ? t.title : "Home"}</a>`;
    pager.setAttribute("aria-label", "Previous and next topic");
    pager.innerHTML = pg(live[pos - 1], "prev") + pg(live[pos + 1], "next");
  }

  /* ---- Site search (static index now; agentic provider later, see docs/search.md) ---- */
  const searchScript = document.createElement("script");
  searchScript.src = `${root}/assets/search.js`;
  document.body.appendChild(searchScript);
})();
