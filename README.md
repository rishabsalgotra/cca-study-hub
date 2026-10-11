# CCA Study Hub

A static study site for the Claude Certified Architect – Foundations exam. It has no build step and no dependencies: open `index.html` in a browser.

```
cca-site/
├── index.html              home page (exam overview + topic cards)
├── assets/
│   ├── style.css           shared styles (light/dark)
│   └── site.js             menu, TOC, search, theme, quiz, progress, TOPICS list
└── topics/
    ├── claude-code.html    Topic 1
    └── _template.html      copy this to add a topic
```

## Add a new topic

1. `cp topics/_template.html topics/<id>.html`, then set `data-topic="<id>"` on `<body>`.
2. Write content. Each `<h2 id="...">` automatically becomes a sidebar entry and a TOC entry.
3. In `assets/site.js`, add or update the entry in `TOPICS` with `ready: true`.

Components available: `.callout.exam | .trap | .tip | .warn`, `.table-wrap > table`, `.grid > .card`, `.precedence` (numbered list), `.diagram` (inline SVG), and `.quiz` (set `data-answer`).
