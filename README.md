# CCA Study Hub

A static study site for the Claude Certified Architect – Foundations exam. It has no build step and no dependencies: open `index.html` in a browser.

```
cca-site/
├── index.html              home page (exam overview + topic cards)
├── assets/
│   ├── style.css           shared styles (light/dark)
│   ├── site.js             menu, TOC, search, theme, quiz, progress, TOPICS list
│   ├── tps.css · tps.js    page-scoped theme, animation engine and simulator for Topic 7
└── topics/
    ├── claude-code.html    Topic 1
    ├── how-llms-work.html  Topic 2
    ├── agentic-architecture.html  Topic 3 (D1)
    ├── tools-mcp.html             Topic 4 (D4)
    ├── harness-engineering.html   Topic 5 (D1 · D2 · D5)
    ├── programmable-money.html    Topic 6 (Fintech): tokenized deposits & stablecoins
    ├── tps-architecture.html      Topic 7 (Enterprise architecture): 1K vs 1M TPS explorer
    └── _template.html      copy this to add a topic
```

## Add a new topic

1. `cp topics/_template.html topics/<id>.html`, then set `data-topic="<id>"` on `<body>`.
2. Write content. Each `<h2 id="...">` automatically becomes a sidebar entry and a TOC entry.
3. In `assets/site.js`, add or update the entry in `TOPICS` with `ready: true`.

Code samples for topics 3–6 live in `examples/` (each folder has a README, tests and a `build.py` that inlines the code into the page).

Components available: `.callout.exam | .trap | .tip | .warn`, `.table-wrap > table`, `.grid > .card`, `.precedence` (numbered list), `.diagram` (inline SVG; add `class="anim" data-still="secs"` to an SVG with SMIL animations to get a play/pause button), and `.quiz` (set `data-answer`).
