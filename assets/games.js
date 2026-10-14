/* ==========================================================
   Games core: stars, arcade, and data-driven game engines.
   ----------------------------------------------------------
   A game is a .qgame[data-game="<id>"] block. Best stars (0–3) are
   stored as localStorage "qgame:<id>"; the page's arcade
   ([data-arcade="<id>"] links + [data-arcade-total]) sums them.

   Engines, chosen with data-engine on the .qgame and fed by a
   <script type="application/json" data-items> inside it:
     sort      classify one card at a time into options
               {options:[{id,label}], question?, items:[{html, answer, why, options?, cls?}]}
     sequence  click steps in the right order, over one or more levels
               {levels:[{title, steps:[html…], done, hints?}]}
     flag      tick every line that is a problem, then check
               {lines:[{html, bad, why}]}
   Custom games (ai-games.js) use window.QGames directly.
   ========================================================== */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>';
  const starRow = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? "on" : ""}">${STAR}</span>`).join("");
  const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const best = (id) => store.get("qgame:" + id, 0);
  const starsFor = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1);

  function paint(id) {
    const n = best(id);
    const box = $(`.qgame[data-game="${id}"] [data-stars]`);
    if (box) { box.innerHTML = starRow(n); box.setAttribute("role", "img"); box.setAttribute("aria-label", `Best score: ${n} of 3 stars`); }
    const link = $(`[data-arcade="${id}"]`);
    if (link) {
      link.querySelector(".qa-stars")?.remove();
      link.insertAdjacentHTML("beforeend", `<span class="qa-stars" role="img" aria-label="${n} of 3 stars">${starRow(n)}</span>`);
    }
    const ids = $$(".qgame[data-game]").map((g) => g.dataset.game);
    const total = $("[data-arcade-total]");
    if (total) total.textContent = `${ids.reduce((t, g) => t + best(g), 0)} / ${ids.length * 3} stars`;
  }
  function award(id, stars) {
    if (stars > best(id)) store.set("qgame:" + id, stars);
    paint(id);
  }
  function say(el, kind, html) { el.className = "pm-result " + kind; el.innerHTML = html; }
  const data = (g) => { try { return JSON.parse($("script[data-items]", g).textContent); } catch (e) { console.error("Bad game data in", g.id, e); return null; } };

  window.QGames = { $, $$, rnd, pick, shuffle, store, award, paint, say, starText, starsFor };

  /* ======================================================
     sort — one card at a time, pick the right option
     ====================================================== */
  function sortGame(g) {
    const d = data(g);
    if (!d) return;
    const stage = $("[data-stage]", g);
    let order, i, score, streak, bestStreak;

    function start() {
      order = d.keepOrder ? d.items.slice() : shuffle(d.items);
      i = 0; score = 0; streak = 0; bestStreak = 0;
      show();
    }
    function show() {
      const it = order[i];
      const opts = it.options || d.options;
      const list = d.shuffleOptions || it.shuffleOptions ? shuffle(opts) : opts;
      stage.innerHTML = `
        <div class="qs-top"><span>Card <b>${i + 1}</b> of ${order.length}</span><span>Score <b>${score}</b></span><span class="qs-streak ${streak >= 3 ? "hot" : ""}">Streak <b>${streak}</b></span></div>
        <div class="qs-prog" aria-hidden="true"><i style="width:${(i / order.length) * 100}%"></i></div>
        ${it.question || d.question ? `<p class="qs-q">${it.question || d.question}</p>` : ""}
        <div class="qs-card ${it.cls || ""}">${it.html}</div>
        <div class="qs-opts" role="group" aria-label="Your answer">${list.map((o) => `<button type="button" class="qs-opt" data-opt="${o.id}">${o.label}</button>`).join("")}</div>
        <p class="pm-result wait" data-msg aria-live="polite" hidden></p>
        <div class="btnrow"><button class="btn" type="button" data-next hidden>${i + 1 < order.length ? "Next card" : "See my score"}</button></div>`;
      $$("[data-opt]", stage).forEach((b) => b.addEventListener("click", () => answer(b)));
      $("[data-next]", stage).addEventListener("click", () => { i++; if (i < order.length) show(); else finish(); });
    }
    function answer(btn) {
      const it = order[i];
      const answers = [].concat(it.answer);
      const ok = answers.includes(btn.dataset.opt);
      $$("[data-opt]", stage).forEach((b) => {
        b.disabled = true;
        if (answers.includes(b.dataset.opt)) b.classList.add("right");
      });
      if (!ok) btn.classList.add("wrong");
      if (ok) { score++; streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
      $(".qs-card", stage).classList.add("answered", ok ? "is-right" : "is-wrong");
      const right = (it.options || d.options).filter((o) => answers.includes(o.id)).map((o) => o.label).join(" or ");
      const msg = $("[data-msg]", stage);
      msg.hidden = false;
      say(msg, ok ? "ok" : "bad", `${ok ? (streak >= 3 ? `Correct, ${streak} in a row!` : "Correct.") : `Not quite: it's <b>${right}</b>.`} ${it.why || ""}`);
      const next = $("[data-next]", stage);
      next.hidden = false;
      next.focus({ preventScroll: true });
    }
    function finish() {
      const stars = starsFor(score / order.length);
      award(g.dataset.game, stars);
      stage.innerHTML = `<div class="qs-end"><b class="qs-big">${score} / ${order.length}</b><span>${starText(stars)} · best streak ${bestStreak}</span>
        <p>${score === order.length ? (d.perfect || "Perfect round!") : (d.retry || "Play again: the cards are shuffled each time.")}</p>
        <button class="btn" type="button" data-again>Play again</button></div>`;
      $("[data-again]", stage).addEventListener("click", start);
    }
    start();
  }

  /* ======================================================
     sequence — click the steps in order
     ====================================================== */
  function sequenceGame(g) {
    const d = data(g);
    if (!d) return;
    const stage = $("[data-stage]", g);
    let li, built, pool, mistakes, totalMistakes = 0;

    function load(n) {
      li = n; built = []; mistakes = 0;
      const L = d.levels[li];
      pool = shuffle(L.steps.map((html, k) => ({ html, k })));
      stage.innerHTML = `
        <div class="qs-top"><span>Level <b>${li + 1}</b> of ${d.levels.length}: ${L.title}</span><span>Wrong picks <b data-mis>0</b></span></div>
        <div class="sq-cols">
          <div><p class="sq-h">Your sequence</p><ol class="sq-built" data-built></ol></div>
          <div><p class="sq-h">Click the step that comes next</p><div class="sq-pool" data-pool role="group" aria-label="Remaining steps"></div></div>
        </div>
        <p class="pm-result wait" data-msg aria-live="polite">${L.intro || "Start with what happens first."}</p>
        <div class="btnrow"><button class="btn" type="button" data-next hidden></button></div>`;
      render();
    }
    function render() {
      $("[data-pool]", stage).innerHTML = pool.length
        ? pool.map((s) => `<button type="button" class="sq-step" data-k="${s.k}">${s.html}</button>`).join("")
        : `<span class="qg-empty">All steps placed.</span>`;
      $("[data-built]", stage).innerHTML = built.map((s) => `<li>${s.html}</li>`).join("");
      $$("[data-k]", stage).forEach((b) => b.addEventListener("click", () => choose(+b.dataset.k, b)));
    }
    function choose(k, btn) {
      const L = d.levels[li];
      const msg = $("[data-msg]", stage);
      if (k !== built.length) {
        mistakes++; totalMistakes++;
        $("[data-mis]", stage).textContent = mistakes;
        btn.classList.remove("shake"); void btn.offsetWidth; btn.classList.add("shake");
        say(msg, "bad", (L.hints && L.hints[built.length]) || "Not yet. Something else has to happen first.");
        return;
      }
      built.push(pool.find((s) => s.k === k));
      pool = pool.filter((s) => s.k !== k);
      render();
      if (pool.length) { say(msg, "wait", `Step ${built.length} placed. What comes next?`); return; }
      const last = li === d.levels.length - 1;
      say(msg, "ok", `${mistakes ? `Done, with ${mistakes} wrong pick${mistakes > 1 ? "s" : ""}.` : "Perfect order!"} ${L.done || ""}`);
      const next = $("[data-next]", stage);
      next.hidden = false;
      next.textContent = last ? "See my score" : "Next level";
      next.onclick = () => (last ? finish() : load(li + 1));
    }
    function finish() {
      const stars = totalMistakes === 0 ? 3 : totalMistakes <= 3 ? 2 : 1;
      award(g.dataset.game, stars);
      stage.innerHTML = `<div class="qs-end"><b class="qs-big">${totalMistakes === 0 ? "Flawless" : `${totalMistakes} wrong pick${totalMistakes > 1 ? "s" : ""}`}</b><span>${starText(stars)}</span>
        <p>${d.end || ""}</p><button class="btn" type="button" data-again>Play again</button></div>`;
      $("[data-again]", stage).addEventListener("click", () => { totalMistakes = 0; load(0); });
    }
    load(0);
  }

  /* ======================================================
     flag — mark every line that's a problem, then check
     ====================================================== */
  function flagGame(g) {
    const d = data(g);
    if (!d) return;
    const stage = $("[data-stage]", g);
    function start() {
      const lines = d.keepOrder ? d.lines : shuffle(d.lines);
      stage.classList.remove("checked");
      stage.innerHTML = `
        <p class="qs-q">${d.question || "Tick every line that's a problem, then press Check."}</p>
        <ul class="fl-list">${lines.map((l, i) => `<li><button type="button" class="fl-line" data-i="${i}" aria-pressed="false"><span class="fl-box" aria-hidden="true"></span><span class="fl-text">${l.html}</span></button><div class="fl-why" hidden></div></li>`).join("")}</ul>
        <div class="btnrow"><button class="btn" type="button" data-check>Check</button></div>
        <p class="pm-result wait" data-msg aria-live="polite" hidden></p>`;
      $$(".fl-line", stage).forEach((b) => b.addEventListener("click", () => {
        if (stage.classList.contains("checked")) return;
        b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
      }));
      $("[data-check]", stage).addEventListener("click", () => check(lines));
    }
    function check(lines) {
      stage.classList.add("checked");
      let wrong = 0;
      $$(".fl-line", stage).forEach((b) => {
        const l = lines[+b.dataset.i], flagged = b.getAttribute("aria-pressed") === "true";
        const ok = flagged === !!l.bad;
        if (!ok) wrong++;
        b.disabled = true;
        b.classList.add(l.bad ? "is-bad" : "is-good", ok ? "got-it" : "missed");
        const why = b.nextElementSibling;
        why.hidden = false;
        why.innerHTML = `<b>${l.bad ? (flagged ? "Problem, and you caught it." : "Problem you missed.") : (flagged ? "This one is actually fine." : "Fine, correctly left alone.")}</b> ${l.why || ""}`;
      });
      const bad = lines.filter((l) => l.bad).length;
      const stars = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
      award(g.dataset.game, stars);
      const msg = $("[data-msg]", stage);
      msg.hidden = false;
      say(msg, wrong ? "warn" : "ok", `${wrong === 0 ? `You found all ${bad} problems and left the good practices alone.` : `${wrong} line${wrong > 1 ? "s" : ""} misjudged. Read the note under each one.`} ${starText(stars)} <button class="gbtn alt" type="button" data-again>Try again</button>`);
      $("[data-check]", stage).hidden = true;
      $("[data-again]", stage).addEventListener("click", start);
    }
    start();
  }

  const ENGINES = { sort: sortGame, sequence: sequenceGame, flag: flagGame };
  $$(".qgame[data-game]").forEach((g) => {
    paint(g.dataset.game);
    const run = ENGINES[g.dataset.engine];
    if (run) run(g);
  });
})();
