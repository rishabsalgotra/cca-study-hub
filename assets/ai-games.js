/* ==========================================================
   AI topics — custom mini-games (data-driven ones live in games.js).
   Needs window.QGames from games.js. Each block runs only if its
   .qgame[data-game] is on the page.
   ========================================================== */
(function () {
  "use strict";
  const Q = window.QGames;
  if (!Q) return;
  const { $, $$, shuffle, award, say, starText, starsFor } = Q;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ======================================================
     How LLMs work · Build a tokenizer (byte-pair encoding)
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="llm-bpe"]');
    if (!g) return;
    const CORPUS = [{ w: "low", n: 5 }, { w: "lower", n: 2 }, { w: "newest", n: 6 }, { w: "widest", n: 3 }];
    const BUDGET = 5;
    const TRY = ["lowest", "newer", "wider"];
    let segs, merges, greedyAll;

    const pairs = (S) => {
      const m = new Map();
      S.forEach((seg, wi) => {
        for (let i = 0; i < seg.length - 1; i++) {
          const k = seg[i] + "\u0000" + seg[i + 1];
          m.set(k, (m.get(k) || 0) + CORPUS[wi].n);
        }
      });
      return [...m.entries()].map(([k, c]) => { const [a, b] = k.split("\u0000"); return { a, b, c }; })
        .sort((x, y) => y.c - x.c || (x.a + x.b).localeCompare(y.a + y.b));
    };
    const mergeSeg = (seg, a, b) => {
      const out = [];
      for (let i = 0; i < seg.length; i++) {
        if (i < seg.length - 1 && seg[i] === a && seg[i + 1] === b) { out.push(a + b); i++; } else out.push(seg[i]);
      }
      return out;
    };
    const total = (S) => S.reduce((t, seg, i) => t + seg.length * CORPUS[i].n, 0);
    const greedyTotal = () => {
      let S = CORPUS.map((c) => [...c.w]);
      for (let k = 0; k < BUDGET; k++) { const p = pairs(S)[0]; if (!p) break; S = S.map((s) => mergeSeg(s, p.a, p.b)); }
      return total(S);
    };

    function reset() {
      segs = CORPUS.map((c) => [...c.w]);
      merges = [];
      greedyAll = true;
      $("[data-try]", g).innerHTML = "";
      render();
      say($("[data-msg]", g), "wait", `Merge the pair you think is most useful. You have ${BUDGET} merges.`);
    }
    function render() {
      $("[data-corpus]", g).innerHTML = CORPUS.map((c, i) =>
        `<div class="bp-word"><span class="bp-n">×${c.n}</span>${segs[i].map((t) => `<span class="bp-tok ${t.length > 1 ? "merged" : ""}">${esc(t)}</span>`).join("")}</div>`).join("");
      const done = merges.length >= BUDGET;
      $("[data-pairs]", g).innerHTML = pairs(segs).slice(0, 8).map((p) =>
        `<button type="button" class="gbtn bp-pair" data-a="${esc(p.a)}" data-b="${esc(p.b)}" ${done ? "disabled" : ""}><span>${esc(p.a)} + ${esc(p.b)}</span><small>seen ${p.c}×</small></button>`).join("");
      $$("[data-a]", g).forEach((b) => b.addEventListener("click", () => doMerge(b.dataset.a, b.dataset.b)));
      $("[data-merges]", g).textContent = `${merges.length} / ${BUDGET}`;
      $("[data-total]", g).textContent = total(segs);
      $("[data-vocab]", g).innerHTML = merges.length
        ? merges.map((m, i) => `<span class="bp-tok merged">${i + 1}. ${esc(m.a)}+${esc(m.b)} → ${esc(m.a + m.b)}</span>`).join("")
        : `<span class="qg-empty">No merges yet: the vocabulary is just single characters.</span>`;
    }
    function doMerge(a, b) {
      if (merges.length >= BUDGET) return;
      const ps = pairs(segs);
      const c = ps.find((p) => p.a === a && p.b === b).c, top = ps[0].c;
      if (c < top) greedyAll = false;
      segs = segs.map((s) => mergeSeg(s, a, b));
      merges.push({ a, b });
      render();
      const msg = $("[data-msg]", g);
      if (merges.length < BUDGET) {
        say(msg, c === top ? "ok" : "warn", c === top
          ? `Merged <b>${esc(a + b)}</b>, the most frequent pair (${c}×). That's exactly what BPE does.`
          : `Merged <b>${esc(a + b)}</b> (${c}×), but another pair appeared ${top}×. BPE always merges the most frequent pair.`);
        return;
      }
      const gt = greedyTotal(), mine = total(segs);
      const stars = greedyAll ? 3 : mine <= gt + 4 ? 2 : 1;
      award("llm-bpe", stars);
      let S = TRY.map((w) => [...w]);
      merges.forEach((m) => (S = S.map((s) => mergeSeg(s, m.a, m.b))));
      $("[data-try]", g).innerHTML = `<p class="qs-q">Your tokenizer on words it has never seen:</p>` + TRY.map((w, i) =>
        `<div class="bp-word"><span class="bp-n">${w}</span>${S[i].map((t) => `<span class="bp-tok ${t.length > 1 ? "merged" : ""}">${esc(t)}</span>`).join("")}<span class="bp-n">${S[i].length} tokens</span></div>`).join("");
      say(msg, greedyAll ? "ok" : "warn", `Done: the corpus shrank from 79 to <b>${mine}</b> tokens (always merging the most frequent pair gets ${gt}). ${starText(stars)}<br>
        New words reuse your pieces. That's why common words become a single token while rare words split into several, and why English averages 3–4 characters per token. Real tokenizers do tens of thousands of merges.
        <button class="gbtn alt" type="button" data-again>Start over</button>`);
      $("[data-again]", msg).addEventListener("click", reset);
    }
    reset();
  })();

  /* ======================================================
     How LLMs work · What does it refer to? (attention)
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="llm-attn"]');
    if (!g) return;
    const ROUNDS = [
      { s: "The animal didn't cross the street because it was too tired", focus: 11, answer: 1, decoy: 5, q: "To make sense of “tired”, which earlier word should it look at most?" },
      { s: "The animal didn't cross the street because it was too wide", focus: 11, answer: 5, decoy: 1, q: "To make sense of “wide”, which earlier word should it look at most?" },
      { s: "The trophy didn't fit in the suitcase because it was too big", focus: 11, answer: 1, decoy: 6, q: "What is “big”? Click the word it should attend to." },
      { s: "The trophy didn't fit in the suitcase because it was too small", focus: 11, answer: 6, decoy: 1, q: "What is “small”? Click the word it should attend to." },
      { s: "Sarah lent Tom her bike because he had lost his", focus: 6, answer: 2, decoy: 0, q: "Who is “he”? The words after it are masked: the model can't see them yet." },
      { s: "The keys to the old cabinet are on the shelf", focus: 6, answer: 1, decoy: 5, q: "Which word decides whether the verb is “is” or “are”?" },
    ];
    let order, r, score;
    function weights(R, n) {
      const w = new Array(n).fill(0);
      const others = [...Array(R.focus + 1).keys()].filter((k) => k !== R.answer && k !== R.decoy);
      const norm = others.reduce((t, _, x) => t + (x % 3) + 1, 0);
      w[R.answer] = 0.58; w[R.decoy] = 0.16;
      others.forEach((k, j) => (w[k] = (0.26 * ((j % 3) + 1)) / norm));
      return w;
    }
    function start() { order = shuffle(ROUNDS); r = 0; score = 0; show(); }
    function show() {
      const R = order[r], words = R.s.split(" ");
      $("[data-q]", g).textContent = R.q;
      $("[data-round]", g).textContent = `${r + 1} / ${order.length}`;
      $("[data-score]", g).textContent = score;
      $("[data-sent]", g).innerHTML = words.map((w, i) => i < R.focus
        ? `<button type="button" class="at-w" data-i="${i}">${esc(w)}<i></i></button>`
        : i === R.focus ? `<span class="at-w focus">${esc(w)}</span>` : `<span class="at-w masked" title="Masked: a token can't attend to later tokens">${esc(w)}</span>`).join(" ");
      $$("[data-i]", g).forEach((b) => b.addEventListener("click", () => answer(+b.dataset.i)));
      $("[data-next]", g).hidden = true;
      say($("[data-msg]", g), "wait", "Click a word. Greyed-out words come later in the sentence, so the causal mask hides them.");
    }
    function answer(i) {
      const R = order[r], words = R.s.split(" "), w = weights(R, words.length);
      const ok = i === R.answer;
      if (ok) score++;
      $("[data-score]", g).textContent = score;
      $$("[data-i]", g).forEach((b) => {
        const k = +b.dataset.i;
        b.disabled = true;
        b.style.setProperty("--w", w[k].toFixed(3));
        b.querySelector("i").textContent = w[k].toFixed(2);
        b.classList.add("shown");
        if (k === R.answer) b.classList.add("right");
        if (k === i && !ok) b.classList.add("wrong");
      });
      say($("[data-msg]", g), ok ? "ok" : "bad", `${ok ? "Yes!" : `It's <b>${esc(words[R.answer])}</b>.`} A trained attention head puts most of its weight there (illustrative numbers are shown on each word). Changing one word changes the answer, which is why attention is computed from context every time rather than looked up.`);
      const next = $("[data-next]", g);
      next.hidden = false;
      next.textContent = r + 1 < order.length ? "Next sentence" : "See my score";
      next.focus({ preventScroll: true });
    }
    $("[data-next]", g).addEventListener("click", () => {
      r++;
      if (r < order.length) return show();
      const stars = starsFor(score / order.length);
      award("llm-attn", stars);
      $("[data-sent]", g).innerHTML = "";
      $("[data-q]", g).textContent = "";
      $("[data-next]", g).hidden = true;
      say($("[data-msg]", g), "ok", `${score} / ${order.length} ${starText(stars)}. Real models run dozens of attention heads in every layer: some track references like these, others grammar, position or copying. <button class="gbtn alt" type="button" data-again>Play again</button>`);
      $("[data-again]", g).addEventListener("click", start);
    });
    start();
  })();

  /* ======================================================
     How LLMs work · Be the LLM (generation loop + stop_reason)
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="llm-gen"]');
    if (!g) return;
    const MAX = 6, PROMPT_TOKENS = 24, END = "<end_turn>", STOP = "</answer>";
    const N = {
      root: [{ t: "<answer>", p: 0.55, n: "A" }, { t: "The", p: 0.3, n: "T" }, { t: "Sure", p: 0.15, n: "S" }],
      A: [{ t: "Paris", p: 0.95, n: "AP" }, { t: "Lyon", p: 0.05, n: "AL" }],
      AP: [{ t: STOP, p: 0.86 }, { t: ".", p: 0.14, n: "APd" }],
      APd: [{ t: STOP, p: 0.9 }, { t: END, p: 0.1 }],
      AL: [{ t: STOP, p: 0.7 }, { t: " (just kidding: Paris)", p: 0.3, n: "APd" }],
      T: [{ t: " capital", p: 0.85, n: "T2" }, { t: " answer", p: 0.15, n: "Tb" }],
      T2: [{ t: " of", p: 0.97, n: "T3" }, { t: " city", p: 0.03, n: "T3" }],
      T3: [{ t: " France", p: 0.97, n: "T4" }, { t: " the", p: 0.03, n: "T4" }],
      T4: [{ t: " is", p: 0.93, n: "T5" }, { t: ",", p: 0.07, n: "T5" }],
      T5: [{ t: " Paris", p: 0.96, n: "T6" }, { t: " famously", p: 0.04, n: "T6" }],
      Tb: [{ t: " is", p: 1, n: "T5" }],
      T6: [{ t: ".", p: 0.6, n: "T7" }, { t: END, p: 0.4 }],
      T7: [{ t: END, p: 0.95 }, { t: " Enjoy", p: 0.05, n: "T7" }],
      S: [{ t: "!", p: 0.6, n: "S2" }, { t: ",", p: 0.4, n: "S2" }],
      S2: [{ t: " <answer>", p: 0.7, n: "A" }, { t: " The", p: 0.3, n: "T" }],
    };
    const REASONS = ["end_turn", "stop_sequence", "max_tokens", "tool_use"];
    const WHY = {
      end_turn: "The model sampled its special end-of-turn token: it decided it was finished. Your loop can return the answer.",
      stop_sequence: `The text matched your stop sequence <code>${esc(STOP)}</code>, so the server stopped generating. The stop string itself isn't included in the returned text.`,
      max_tokens: `The output hit your max_tokens limit of ${MAX} and was cut off mid-thought (notice there's no full stop). Never treat this as complete: raise the limit or ask the model to continue.`,
    };
    const found = new Set(Q.store.get("qgame:llm-gen:endings", []));
    let node, out, stopped;

    function reset() {
      node = "root"; out = []; stopped = null;
      render();
      say($("[data-msg]", g), "wait", "Pick the next token yourself, or let the sampler pick by probability. Try to reach all three different endings.");
    }
    function render() {
      $("[data-out]", g).innerHTML = out.map((t) => `<span class="gn-tok ${t.trim() === STOP ? "stop" : t === END ? "end" : ""}">${t === END ? "⏎ end of turn" : esc(t)}</span>`).join("") + (stopped ? "" : `<span class="gn-caret" aria-hidden="true"></span>`);
      $("[data-count]", g).textContent = `${out.length} / ${MAX}`;
      $("[data-work]", g).innerHTML = out.length
        ? `Step ${out.length}: with the KV cache the model processed <b>1</b> new token and reused ${PROMPT_TOKENS + out.length - 1} cached ones. Without the cache it would re-process all <b>${PROMPT_TOKENS + out.length}</b>.`
        : `The prompt (${PROMPT_TOKENS} tokens) is processed once, then cached.`;
      $("[data-endings]", g).innerHTML = ["end_turn", "stop_sequence", "max_tokens"].map((r) => `<span class="gn-end ${found.has(r) ? "on" : ""}">${r}</span>`).join("");
      if (stopped) return;
      $("[data-cands]", g).innerHTML = N[node].map((o, i) =>
        `<button type="button" class="gn-cand" data-c="${i}"><span class="gn-t">${o.t === END ? "⏎ end of turn" : esc(o.t)}</span><span class="gn-bar"><i style="width:${o.p * 100}%"></i></span><span class="gn-p">${Math.round(o.p * 100)}%</span></button>`).join("");
      $$("[data-c]", g).forEach((b) => b.addEventListener("click", () => step(N[node][+b.dataset.c])));
      $("[data-sample]", g).disabled = false;
    }
    function step(o) {
      out.push(o.t);
      if (o.t === END) return stop("end_turn");
      if (o.t.trim() === STOP) return stop("stop_sequence");
      if (out.length >= MAX) return stop("max_tokens");
      node = o.n;
      render();
    }
    function stop(reason) {
      stopped = reason;
      render();
      $("[data-sample]", g).disabled = true;
      const text = out.filter((t) => t !== END && t.trim() !== STOP).join("").trim();
      $("[data-cands]", g).innerHTML = `<p class="qs-q">Generation stopped. The returned text is “<b>${esc(text)}</b>”. Which <code>stop_reason</code> will the API report?</p>
        <div class="qs-opts">${REASONS.map((r) => `<button type="button" class="qs-opt" data-r="${r}">${r}</button>`).join("")}</div>`;
      $$("[data-r]", g).forEach((b) => b.addEventListener("click", () => {
        const ok = b.dataset.r === reason;
        $$("[data-r]", g).forEach((x) => { x.disabled = true; if (x.dataset.r === reason) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        if (ok) { found.add(reason); Q.store.set("qgame:llm-gen:endings", [...found]); award("llm-gen", found.size); }
        render();
        say($("[data-msg]", g), ok ? "ok" : "bad", `${ok ? "Right:" : `It's <b>${reason}</b>:`} ${WHY[reason]} ${found.size < 3 ? `Endings found: ${found.size} of 3. Generate again and take a different path.` : `You've found all three endings! ${starText(3)}`}
          <button class="gbtn alt" type="button" data-again>Generate again</button>`);
        $("[data-again]", g).addEventListener("click", reset);
      }));
    }
    $("[data-sample]", g).addEventListener("click", () => {
      if (stopped) return;
      const opts = N[node];
      let r = Math.random(), k = 0;
      for (; k < opts.length - 1; k++) { r -= opts[k].p; if (r < 0) break; }
      step(opts[k]);
    });
    reset();
  })();

  /* ======================================================
     Agentic architecture · Pack the carry-on (context window budget)
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="ag-pack"]');
    if (!g) return;
    const BUDGET = 10000;
    const ITEMS = [
      { id: "sys", label: "System prompt + tool definitions", t: 1500, v: 10, req: true, why: "Always needed: it's how the model knows its role and its tools." },
      { id: "task", label: "Your request + the failing test's output", t: 800, v: 10, req: true, why: "The task itself. Without it nothing else matters." },
      { id: "file", label: "auth/session.ts, the file with the bug", t: 2600, v: 9, why: "High signal: the agent needs it for the very next step." },
      { id: "test", label: "auth/session.test.ts, the failing test", t: 1800, v: 8, why: "High signal: it shows exactly what “fixed” means." },
      { id: "grep", label: "Paths of files that mention “login” (paths only)", t: 150, v: 5, why: "Just-in-time retrieval: cheap references the agent can open later if needed." },
      { id: "notes", label: "NOTES.md: progress and decisions so far", t: 350, v: 5, why: "Structured note-taking: a compact memory of what's been tried." },
      { id: "summary", label: "Summary of yesterday's session", t: 450, v: 3, why: "Compaction: the gist of old turns instead of the turns themselves." },
      { id: "readme", label: "The whole README", t: 3000, v: 1, why: "Mostly irrelevant here. Read the one relevant section just in time instead." },
      { id: "history", label: "Yesterday's full chat (an unrelated refactor)", t: 6500, v: -2, why: "Stale context dilutes attention (“context rot”) and costs money on every turn." },
      { id: "logs", label: "Old npm install logs from earlier tool calls", t: 3800, v: -2, why: "Clear stale tool results once they've been used." },
      { id: "examples", label: "Five worked examples of unrelated tasks", t: 2200, v: -1, why: "Off-topic examples can pull the model in the wrong direction." },
      { id: "repo", label: "The entire repository", t: 240000, v: 3, why: "Far too big. Agents search with tools (glob, grep) instead of pasting everything." },
    ];
    const sel = new Set();
    const fmt = (n) => n.toLocaleString();
    const optimal = (() => {
      const opt = ITEMS.filter((x) => !x.req), base = ITEMS.filter((x) => x.req);
      const t0 = base.reduce((s, x) => s + x.t, 0), v0 = base.reduce((s, x) => s + x.v, 0);
      let bestV = -Infinity;
      for (let m = 0; m < 1 << opt.length; m++) {
        let t = t0, v = v0;
        opt.forEach((x, i) => { if (m & (1 << i)) { t += x.t; v += x.v; } });
        if (t <= BUDGET && v > bestV) bestV = v;
      }
      return bestV;
    })();
    const used = () => ITEMS.filter((x) => sel.has(x.id)).reduce((s, x) => s + x.t, 0);

    function reset() {
      sel.clear();
      ITEMS.filter((x) => x.req).forEach((x) => sel.add(x.id));
      g.classList.remove("checked");
      $("[data-pack]", g).innerHTML = ITEMS.map((x) => `<button type="button" class="pk-item" data-id="${x.id}" aria-pressed="${sel.has(x.id)}" ${x.req ? "disabled" : ""}>
        <span class="pk-box" aria-hidden="true"></span><span class="pk-label">${esc(x.label)}${x.req ? " <em>(always packed)</em>" : ""}</span><span class="pk-t">${fmt(x.t)}</span><span class="pk-why" hidden></span></button>`).join("");
      $$(".pk-item", g).forEach((b) => b.addEventListener("click", () => {
        if (g.classList.contains("checked")) return;
        const id = b.dataset.id;
        if (sel.has(id)) sel.delete(id); else sel.add(id);
        b.setAttribute("aria-pressed", String(sel.has(id)));
        meter();
      }));
      say($("[data-msg]", g), "wait", "Pack what the agent needs for its next step. More context isn't better context.");
      $("[data-check]", g).hidden = false;
      meter();
    }
    function meter() {
      const u = used(), over = u > BUDGET;
      const fill = $("[data-fill]", g);
      fill.style.width = `${Math.min(100, (u / BUDGET) * 100)}%`;
      fill.classList.toggle("over", over);
      $("[data-used]", g).textContent = `${fmt(u)} / ${fmt(BUDGET)} tokens${over ? ": over the limit!" : ""}`;
      $("[data-check]", g).disabled = over;
    }
    $("[data-check]", g).addEventListener("click", () => {
      g.classList.add("checked");
      const v = ITEMS.filter((x) => sel.has(x.id)).reduce((s, x) => s + x.v, 0);
      const ratio = v / optimal, stars = ratio >= 0.95 ? 3 : ratio >= 0.8 ? 2 : 1;
      award("ag-pack", stars);
      $$(".pk-item", g).forEach((b) => {
        const x = ITEMS.find((i) => i.id === b.dataset.id);
        const shouldPack = x.req || (x.v >= 3 && x.t < BUDGET);
        b.classList.add(sel.has(x.id) === shouldPack ? "verdict-ok" : "verdict-bad");
        const why = b.querySelector(".pk-why");
        why.hidden = false;
        why.textContent = x.why;
      });
      $("[data-check]", g).hidden = true;
      say($("[data-msg]", g), stars === 3 ? "ok" : "warn", `Signal score <b>${v}</b> out of a best possible ${optimal}, using ${fmt(used())} tokens. ${starText(stars)} The best pack leaves about 2,000 tokens free, so the agent has room to work. <button class="gbtn alt" type="button" data-again>Repack</button>`);
      $("[data-again]", g).addEventListener("click", reset);
    });
    reset();
  })();
})();
