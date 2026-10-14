/* ==========================================================
   Quantum Basics — mini-games (topics/quantum-basics.html)
   Each game is a .qgame[data-game="<id>"] block in the page.
   Best stars per game (0–3) are kept in localStorage as "qgame:<id>"
   and summed in the arcade index at the top of the page.
   ========================================================== */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  /* ---------- Stars + arcade ---------- */
  const GAMES = ["mystery", "maze", "memory", "chsh", "qec", "grover", "bb84"];
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>';
  const starRow = (n) => [0, 1, 2].map((i) => `<span class="${i < n ? "on" : ""}">${STAR}</span>`).join("");
  const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const best = (id) => store.get("qgame:" + id, 0);

  function paint(id) {
    const n = best(id);
    const box = $(`.qgame[data-game="${id}"] [data-stars]`);
    if (box) { box.innerHTML = starRow(n); box.setAttribute("role", "img"); box.setAttribute("aria-label", `Best score: ${n} of 3 stars`); }
    const link = $(`[data-arcade="${id}"]`);
    if (link) {
      link.querySelector(".qa-stars")?.remove();
      link.insertAdjacentHTML("beforeend", `<span class="qa-stars" role="img" aria-label="${n} of 3 stars">${starRow(n)}</span>`);
    }
    const total = $("[data-arcade-total]");
    if (total) total.textContent = `${GAMES.reduce((t, g) => t + best(g), 0)} / ${GAMES.length * 3} stars`;
  }
  function award(id, stars) {
    if (stars > best(id)) store.set("qgame:" + id, stars);
    paint(id);
  }
  function say(el, kind, html) { el.className = "pm-result " + kind; el.innerHTML = html; }
  GAMES.forEach(paint);

  /* ======================================================
     1. Mystery qubit — measurement bases
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="mystery"]');
    if (!g) return;
    const log = $("[data-log]", g), msg = $("[data-msg]", g);
    const NAME = { 0: "|0⟩", 1: "|1⟩", "+": "|+⟩", "-": "|−⟩" };
    let secret, shots, over;

    function reset() {
      secret = pick(["0", "1", "+", "-"]); shots = []; over = false;
      log.innerHTML = `<span class="qg-empty">No measurements yet. Each button measures a fresh copy of the secret state.</span>`;
      say(msg, "wait", "Make some measurements, then name the state. Name it with 2 measurements or fewer for 3 stars.");
      $$("[data-guess]", g).forEach((b) => { b.disabled = false; b.classList.remove("right", "wrong"); });
      $$("[data-measure]", g).forEach((b) => (b.disabled = false));
    }
    function measure(basis) {
      if (basis === "z") return secret === "0" || secret === "1" ? secret : pick(["0", "1"]);
      return secret === "+" ? "+" : secret === "-" ? "−" : pick(["+", "−"]);
    }
    $$("[data-measure]", g).forEach((b) => b.addEventListener("click", () => {
      if (over) return;
      shots.push({ basis: b.dataset.measure, out: measure(b.dataset.measure) });
      log.innerHTML = shots.map((s, i) =>
        `<span class="qg-chip ${s.basis}" title="Shot ${i + 1}"><small>${s.basis === "z" ? "0/1" : "+/−"}</small>${s.out}</span>`).join("");
    }));
    $$("[data-guess]", g).forEach((b) => b.addEventListener("click", () => {
      if (over) return;
      over = true;
      const ok = b.dataset.guess === secret, n = shots.length;
      $$("[data-guess]", g).forEach((x) => { x.disabled = true; if (x.dataset.guess === secret) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      $$("[data-measure]", g).forEach((x) => (x.disabled = true));
      const zState = secret === "0" || secret === "1";
      const why = zState
        ? `${NAME[secret]} gives <b>${secret}</b> every time through the 0/1 "filter", but a random + or − through the +/− one.`
        : `${NAME[secret]} gives <b>${secret === "+" ? "+" : "−"}</b> every time through the +/− "filter", but a random 0 or 1 through the 0/1 one.`;
      if (ok) {
        const stars = n === 0 ? 1 : n <= 2 ? 3 : n <= 4 ? 2 : 1;
        award("mystery", stars);
        say(msg, "ok", n === 0
          ? `Lucky guess: it was ${NAME[secret]}! ${why} Next time, prove it with a measurement. ${starText(stars)}`
          : `Correct, it was ${NAME[secret]}. ${why} You used ${n} measurement${n > 1 ? "s" : ""}. ${starText(stars)}`);
      } else {
        say(msg, "bad", `Not quite: it was ${NAME[secret]}. ${why} <b>Tip:</b> results that look random mean you're looking through the "wrong filter". Switch basis and the answer becomes certain.`);
      }
    }));
    $("[data-new]", g).addEventListener("click", reset);
    reset();
  })();

  /* ======================================================
     2. Gate maze — single-qubit gates permute the six Bloch-sphere poles
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="maze"]');
    if (!g) return;
    const NS = "http://www.w3.org/2000/svg";
    const S = ["|0⟩", "|1⟩", "|+⟩", "|−⟩", "|+i⟩", "|−i⟩"];
    const POS = [[150, 32], [150, 238], [99, 163], [201, 107], [252, 135], [48, 135]];
    /* Where each gate sends each of the six states (index order as in S), up to global phase. */
    const GATES = { X: [1, 0, 2, 3, 5, 4], Y: [1, 0, 3, 2, 4, 5], Z: [0, 1, 3, 2, 5, 4], H: [2, 3, 0, 1, 5, 4], S: [0, 1, 4, 5, 3, 2] };
    const LEVELS = [
      { from: 0, to: 1, gates: ["X"], text: "Flip the bit: turn |0⟩ into |1⟩.", learn: "X is the quantum NOT gate: a half-turn that swaps the poles." },
      { from: 0, to: 2, gates: ["X", "H"], text: "Make a superposition: reach |+⟩.", learn: "H turns |0⟩ into an equal mix of 0 and 1, the start of almost every algorithm." },
      { from: 0, to: 3, gates: ["X", "H"], text: "Reach |−⟩. The order of the gates matters.", learn: "X then H gives |−⟩, but H then X leaves you on |+⟩: gates generally don't commute." },
      { from: 2, to: 3, gates: ["X", "H"], text: "Turn |+⟩ into |−⟩, but there's no Z gate here. Can you build one?", learn: "H·X·H = Z: you built a phase flip out of other gates, one of the identities listed above." },
      { from: 0, to: 4, gates: ["H", "S"], text: "Reach |+i⟩, on the far side of the equator.", learn: "S is a quarter-turn around the vertical axis: it walks states around the equator." },
      { from: 0, to: 5, gates: ["H", "S"], text: "Reach |−i⟩. There's a shortcut.", learn: "H·S·H gets there in 3 moves; the long way round (H, S, S, S) takes 4." },
      { from: 1, to: 4, gates: ["X", "H", "S"], text: "Start from |1⟩ this time and reach |+i⟩.", learn: "Many paths lead to the same state. Finding the shortest is exactly what quantum compilers do." },
      { from: 5, to: 0, gates: ["H", "S"], text: "Undo everything: bring |−i⟩ home to |0⟩.", learn: "Every gate can be undone. Quantum computation is reversible right up until you measure." },
    ];
    const bfs = (a, b, gs) => {
      const dist = { [a]: 0 }, q = [a];
      while (q.length) {
        const s = q.shift();
        if (s === b) return dist[s];
        for (const k of gs) { const t = GATES[k][s]; if (!(t in dist)) { dist[t] = dist[s] + 1; q.push(t); } }
      }
      return Infinity;
    };
    LEVELS.forEach((L) => (L.par = bfs(L.from, L.to, L.gates)));

    const board = $("[data-board]", g), msg = $("[data-msg]", g), seq = $("[data-seq]", g);
    const levelStars = store.get("qgame:maze:levels", {});
    let li = 0, moves = [], cur = 0, solved = false;

    const mk = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (parent) parent.appendChild(e);
      return e;
    };
    mk("circle", { cx: 150, cy: 135, r: 103, class: "mz-sphere" }, board);
    mk("ellipse", { cx: 150, cy: 135, rx: 103, ry: 32, class: "mz-eq" }, board);
    mk("line", { x1: 150, y1: 32, x2: 150, y2: 238, class: "mz-axis" }, board);
    mk("line", { x1: 99, y1: 163, x2: 201, y2: 107, class: "mz-axis" }, board);
    mk("line", { x1: 48, y1: 135, x2: 252, y2: 135, class: "mz-axis" }, board);
    const target = mk("circle", { r: 26, class: "mz-target" }, board);
    const token = mk("g", { class: "mz-token" }, board);
    mk("circle", { r: 21 }, token);
    const nodes = POS.map(([x, y], i) => {
      const n = mk("g", { class: "mz-node", transform: `translate(${x} ${y})` }, board);
      mk("circle", { r: 18 }, n);
      const t = mk("text", { "text-anchor": "middle", dy: "4.5" }, n);
      t.textContent = S[i];
      return n;
    });

    function renderLevels() {
      const unlocked = Math.max(0, ...Object.keys(levelStars).map((k) => +k + 1));
      $("[data-levels]", g).innerHTML = LEVELS.map((L, i) => {
        const st = levelStars[i] || 0, locked = i > unlocked;
        return `<button type="button" class="mz-lvl ${i === li ? "on" : ""}" data-lvl="${i}" ${locked ? "disabled" : ""} aria-label="Level ${i + 1}${st ? `, ${st} stars` : ""}${locked ? ", locked" : ""}">
          <b>${i + 1}</b><span>${st ? "★".repeat(st) : locked ? "locked" : "–"}</span></button>`;
      }).join("");
      $$("[data-lvl]", g).forEach((b) => b.addEventListener("click", () => load(+b.dataset.lvl)));
    }
    function render() {
      const L = LEVELS[li];
      const [x, y] = POS[cur], [tx, ty] = POS[L.to];
      token.setAttribute("transform", `translate(${x} ${y})`);
      target.setAttribute("cx", tx); target.setAttribute("cy", ty);
      nodes.forEach((n, i) => n.classList.toggle("is-cur", i === cur));
      $("[data-moves]", g).textContent = moves.length;
      let path = S[L.from], s = L.from;
      for (const k of moves) { s = GATES[k][s]; path += ` <i>→${k}→</i> ${S[s]}`; }
      seq.innerHTML = `<span class="ket">${path}</span>`;
    }
    function load(i) {
      li = i; moves = []; solved = false;
      const L = LEVELS[li];
      cur = L.from;
      $("[data-level]", g).textContent = li + 1;
      $("[data-par]", g).textContent = L.par;
      $("[data-level-text]", g).innerHTML = `<b>Level ${li + 1}.</b> ${L.text}`;
      $("[data-gates]", g).innerHTML = L.gates.map((k) => `<button class="gbtn" type="button" data-gate="${k}">${k}</button>`).join("");
      $$("[data-gate]", g).forEach((b) => b.addEventListener("click", () => apply(b.dataset.gate)));
      $("[data-next]", g).hidden = true;
      say(msg, "wait", `Glowing dot = where you are. Dashed ring = the target. Gates available: ${L.gates.join(", ")}.`);
      renderLevels(); render();
    }
    function apply(k) {
      if (solved) return;
      const before = cur;
      cur = GATES[k][cur];
      moves.push(k);
      render();
      const L = LEVELS[li];
      if (cur === L.to) {
        solved = true;
        const n = moves.length, st = n <= L.par ? 3 : n <= L.par + 2 ? 2 : 1;
        levelStars[li] = Math.max(levelStars[li] || 0, st);
        store.set("qgame:maze:levels", levelStars);
        award("maze", Math.round(LEVELS.reduce((t, _, i) => t + (levelStars[i] || 0), 0) / LEVELS.length));
        say(msg, "ok", `Solved in ${n} move${n > 1 ? "s" : ""} (fewest possible: ${L.par}) ${starText(st)}. ${L.learn}` +
          (li === LEVELS.length - 1 ? " <b>You've finished every level!</b>" : ""));
        $("[data-next]", g).hidden = li === LEVELS.length - 1;
        renderLevels();
      } else {
        say(msg, "wait", before === cur
          ? `${k} left ${S[cur]} where it was: it's a rotation around this state's own axis. Try another gate.`
          : `${k}: ${S[before]} → ${S[cur]}.`);
      }
    }
    $("[data-undo]", g).addEventListener("click", () => {
      if (solved || !moves.length) return;
      moves.pop();
      cur = moves.reduce((s, k) => GATES[k][s], LEVELS[li].from);
      render();
    });
    $("[data-restart]", g).addEventListener("click", () => load(li));
    $("[data-next]", g).addEventListener("click", () => load(li + 1));
    load(Math.min(LEVELS.length - 1, Object.keys(levelStars).length));
  })();

  /* ======================================================
     3. Rice on the chessboard — exponential memory
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="memory"]');
    if (!g) return;
    const slider = $("#mem-n", g), msg = $("[data-msg]", g);
    const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    const sci = (log10) => {
      const e = Math.floor(log10), m = 10 ** (log10 - e);
      return `${m.toFixed(1)} × 10${String(e).replace(/./g, (c) => SUP[c])}`;
    };
    const amps = (n) => (n <= 60 ? (2n ** BigInt(n)).toLocaleString() : sci(n * Math.log10(2)));
    const UNITS = ["bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    const bytes = (n) => {
      const b = n + 4, u = Math.floor(b / 10);                      // 16 bytes = 2⁴ per amplitude
      return u < UNITS.length ? `${(2 ** (b - u * 10)).toLocaleString()} ${UNITS[u]}` : `${sci(b * Math.log10(2))} bytes`;
    };
    /* Landmarks by qubit count n (memory = 2^(n+4) bytes). */
    const MARKS = [
      { n: 4, tick: "text", label: "a text message" },
      { n: 18, tick: "photo", label: "a phone photo" },
      { n: 30, tick: "laptop", label: "a 16 GB laptop's memory, completely full" },
      { n: 36, tick: "1 TB", label: "a laptop's entire 1 TB drive" },
      { n: 49, tick: "supercomputer", label: "the memory of the world's biggest supercomputers (about 10 PB)" },
      { n: 73, tick: "all data", label: "roughly all the data humanity has ever stored (about 150 ZB)" },
    ];
    const compare = (n) => {
      if (n < 4) return "a few bytes";
      if (n >= 266) return "more numbers than there are atoms in the observable universe";
      if (n > 73) return `all the data on Earth, about ${sci((n - 73) * Math.log10(2))} times over`;
      let m = MARKS[0];
      for (const x of MARKS) if (x.n <= n) m = x;
      const ratio = 2 ** (n - m.n);
      return ratio === 1 ? m.label : `${ratio.toLocaleString()} × ${m.label.replace(/,.*$/, "")}`;
    };
    $("[data-scale]", g).insertAdjacentHTML("beforeend",
      MARKS.map((m) => `<span class="qg-tick" style="left:${m.n}%"><i>${m.tick}</i></span>`).join(""));
    function render(n) {
      $("[data-n-out]", g).textContent = n;
      $("[data-amps]", g).textContent = amps(n);
      $("[data-bytes]", g).textContent = bytes(n);
      $("[data-compare]", g).textContent = compare(n);
      $("[data-fill]", g).style.width = `${Math.min(100, n)}%`;
      g.classList.toggle("over-laptop", n > 30);
    }
    slider.addEventListener("input", () => render(+slider.value));
    $("[data-jump]", g).addEventListener("click", () => { slider.value = 100; render(300); });
    $("[data-check]", g).addEventListener("click", () => {
      const v = parseInt($("#mem-guess", g).value, 10);
      if (!Number.isFinite(v) || v < 1) { say(msg, "warn", "Type a whole number of qubits first."); return; }
      const off = Math.abs(v - 30), stars = off === 0 ? 3 : off <= 2 ? 2 : 1;
      award("memory", stars);
      say(msg, off === 0 ? "ok" : "warn", `${off === 0 ? "Spot on!" : v > 30 ? "Far fewer than that!" : "A little more than that."} The answer is <b>30 qubits</b>: 2³⁰ amplitudes × 16 bytes = 16 GiB. Add just <em>one</em> more qubit and you'd need 32 GiB. ${starText(stars)}<br>
        That's why around 50 qubits already strains supercomputers, and why big quantum computers can't simply be simulated on ordinary ones. Drag the slider to watch it explode.`);
      slider.value = 30; render(30);
    });
    render(+slider.value);
  })();

  /* ======================================================
     4. The impossible quiz show — CHSH game
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="chsh"]');
    if (!g) return;
    const msg = $("[data-msg]", g), qBtn = $('[data-play="quantum"]', g), rounds = $("[data-rounds]", g);
    const plan = { a0: 0, a1: 0, b0: 0, b1: 0 };
    const tried = new Set();
    const WIN_Q = Math.cos(Math.PI / 8) ** 2;                         // ≈ 0.854, Tsirelson's bound

    $$(".seg", g).forEach((seg) => seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      plan[seg.dataset.key] = +b.dataset.v;
      $$("button", seg).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));

    function play(mode) {
      const N = 1000, log = [];
      let wins = 0;
      for (let i = 0; i < N; i++) {
        const x = rnd(2), y = rnd(2), mustDiffer = x & y;
        let a, b;
        if (mode === "classical") { a = x ? plan.a1 : plan.a0; b = y ? plan.b1 : plan.b0; }
        else {
          /* Measuring a shared Bell pair at polariser angles (Alice 0°/45°, Bob 22.5°/−22.5°):
             each answer is a fair coin, and the pair lands on the winning relation with probability cos²(22.5°). */
          a = rnd(2);
          const good = Math.random() < WIN_Q;
          b = mustDiffer ? (good ? 1 - a : a) : (good ? a : 1 - a);
        }
        const win = (a ^ b) === mustDiffer;
        wins += win;
        if (log.length < 6) log.push({ x, y, a, b, win });
      }
      const rate = wins / N;
      const fill = $("[data-fill]", g);
      fill.style.width = pct(rate);
      fill.classList.toggle("q", mode === "quantum");
      rounds.hidden = false;
      rounds.innerHTML = `<table><thead><tr><th>Round</th><th>Alice: card → answer</th><th>Bob: card → answer</th><th>Needed</th><th>Result</th></tr></thead><tbody>${log.map((r, i) =>
        `<tr><td>${i + 1}</td><td>${r.x} → <b>${r.a}</b></td><td>${r.y} → <b>${r.b}</b></td><td>${r.x & r.y ? "differ" : "match"}</td><td class="${r.win ? "qg-win" : "qg-lose"}">${r.win ? "win" : "lose"}</td></tr>`).join("")}</tbody></table>`;

      if (mode === "classical") {
        tried.add(`${plan.a0}${plan.a1}${plan.b0}${plan.b1}`);
        const exact = [[0, 0], [0, 1], [1, 0], [1, 1]].filter(([x, y]) => (((x ? plan.a1 : plan.a0) ^ (y ? plan.b1 : plan.b0)) === (x & y))).length;
        award("chsh", exact === 3 ? 2 : 1);
        if (tried.size >= 2) qBtn.disabled = false;
        const left = 2 - tried.size;
        say(msg, exact === 3 ? "ok" : "warn",
          `This plan won <b>${pct(rate)}</b> of 1,000 rounds. It wins ${exact} of the 4 possible card combinations, so in the long run it gets ${exact * 25}%. ` +
          (exact === 3 ? "That's the best any classical plan can do: every fixed plan must lose at least one of the four combinations. " : "Can you find a plan that gets 75%? ") +
          (qBtn.disabled ? `Try ${left} more plan${left > 1 ? "s" : ""} to unlock the entangled option.` : "Now try giving them entangled qubits."));
      } else {
        award("chsh", 3);
        say(msg, "ok", `<b>${pct(rate)}</b>! No classical plan, however clever, can beat 75%. This is Bell's theorem, and the experiments testing it won the 2022 Nobel Prize in Physics. ` +
          `How they do it: Alice and Bob each hold one photon of an entangled pair. Alice measures hers through a polariser at 0° (card 0) or 45° (card 1); Bob uses 22.5° or −22.5°. ` +
          `Their answers agree with probability cos²(angle between the polarisers), which lands on the winning answer about 85% of the time. They still can't send messages: each answer on its own is a coin flip. ${starText(3)}`);
      }
    }
    $('[data-play="classical"]', g).addEventListener("click", () => play("classical"));
    qBtn.addEventListener("click", () => play("quantum"));
  })();

  /* ======================================================
     5. Bit-flip detective — 3-qubit repetition code with parity checks
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="qec"]');
    if (!g) return;
    const code = $("[data-code]", g), msg = $("[data-msg]", g), next = $("[data-next]", g);
    const ROUNDS = 8;
    let round = 1, score = 0, st, over = false;

    function newRound() {
      const logical = rnd(2), data = [logical, logical, logical];
      const r = Math.random(), flips = [];
      if (r < 0.15) { /* no error this round */ }
      else if (r < 0.9) flips.push(rnd(3));
      else { const a = rnd(3); flips.push(a, (a + 1 + rnd(2)) % 3); }
      flips.forEach((i) => (data[i] ^= 1));
      st = { logical, data, flips, s12: data[0] !== data[1], s23: data[1] !== data[2], answered: false };
      drawCode(false);
      $$("[data-fix]", g).forEach((b) => (b.disabled = false));
      next.hidden = true;
      $("[data-round]", g).textContent = round;
      say(msg, "wait", "Read the two checks, then choose which qubit to fix.");
    }
    function drawCode(reveal, fixed = -2) {
      const q = (i) => {
        const flipped = st.flips.includes(i);
        const v = reveal ? (fixed === i ? st.data[i] ^ 1 : st.data[i]) : "?";
        const cls = !reveal ? "" : fixed === i ? (flipped ? "fixed" : "broke") : flipped ? "bad" : "";
        return `<span class="qg-q ${cls}"><small>qubit ${i + 1}</small>${v}</span>`;
      };
      const chk = (diff, a, b) => `<span class="qg-check ${diff ? "differ" : "agree"}"><small>${a} vs ${b}</small>${diff ? "differ" : "agree"}</span>`;
      code.innerHTML = q(0) + chk(st.s12, 1, 2) + q(1) + chk(st.s23, 2, 3) + q(2);
    }
    function decide(fix) {
      if (st.answered) return;
      st.answered = true;
      $$("[data-fix]", g).forEach((b) => (b.disabled = true));
      const bestFix = st.s12 && st.s23 ? 1 : st.s12 ? 0 : st.s23 ? 2 : -1;
      const right = fix === bestFix;
      if (right) score++;
      $("[data-score]", g).textContent = score;
      drawCode(true, fix);
      const after = st.data.map((v, i) => (i === fix ? v ^ 1 : v));
      const recovered = after.every((v) => v === st.logical);
      const where = bestFix === -1 ? "no error" : `qubit ${bestFix + 1}`;
      if (right && recovered) say(msg, "ok", `Correct: the checks pointed to ${where}. The logical bit <b>${st.logical}</b> is safe, and you never looked at it directly.`);
      else if (right) say(msg, "warn", `You read the checks correctly (they point to ${where}), but this time <b>two</b> qubits flipped, so the majority was wrong and the logical bit was lost. This is the code's failure mode, and it's rare: it needs two errors at once.`);
      else say(msg, "bad", `The checks pointed to ${where}. Rule of thumb: if only the left check says "differ", it's qubit 1; only the right one, qubit 3; both, the qubit in the middle; neither, no error.`);
      if (round >= ROUNDS) {
        const stars = score >= 7 ? 3 : score >= 5 ? 2 : 1;
        award("qec", stars);
        msg.innerHTML += ` <br><b>Game over: ${score} / ${ROUNDS} correct calls. ${starText(stars)}</b>`;
        next.textContent = "Play again"; over = true;
      } else next.textContent = "Next round";
      next.hidden = false;
    }
    $$("[data-fix]", g).forEach((b) => b.addEventListener("click", () => decide(+b.dataset.fix)));
    next.addEventListener("click", () => {
      if (over) { over = false; round = 1; score = 0; $("[data-score]", g).textContent = 0; }
      else round++;
      newRound();
    });

    const p = $("#qec-p", g);
    function renderP() {
      const x = +p.value / 100, L = 3 * x * x - 2 * x ** 3;
      $("[data-p-out]", g).textContent = pct(x, 0);
      $("[data-b-phys]", g).style.width = pct(x);
      $("[data-b-log]", g).style.width = pct(L);
      $("[data-v-phys]", g).textContent = pct(x);
      $("[data-v-log]", g).textContent = pct(L, 2);
      $("[data-p-note]", g).innerHTML = x < 0.5
        ? `With three copies the stored bit is lost only if 2 or 3 copies flip: 3p² − 2p³. That's <b>${(x / L).toFixed(1)}× more reliable</b> than a single copy. The rarer the raw errors, the bigger the gain, which is why hardware must get below an error <em>threshold</em> before error correction pays off.`
        : `At 50% noise the copies are pure coin flips and majority voting can't help. Error correction only works below a threshold.`;
    }
    p.addEventListener("input", renderP);
    renderP();
    newRound();
  })();

  /* ======================================================
     6. Find the prize — classical peeking vs Grover's algorithm (N = 16)
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="grover"]');
    if (!g) return;
    const N = 16;
    const cards = $("[data-cards]", g), cmsg = $("[data-cmsg]", g), qmsg = $("[data-qmsg]", g), bars = $("[data-bars]", g);

    /* Round 1: classical peeking */
    let cPrize, peeks, cDone;
    function resetClassical() {
      cPrize = rnd(N); peeks = 0; cDone = false;
      cards.innerHTML = Array.from({ length: N }, (_, i) =>
        `<button type="button" class="gb-card" data-card="${i}" aria-label="Card ${i + 1}, face down"><span>${i + 1}</span></button>`).join("");
      say(cmsg, "wait", "Click cards to peek. Each peek is one look at the data.");
    }
    cards.addEventListener("click", (e) => {
      const b = e.target.closest("[data-card]");
      if (!b || cDone || b.classList.contains("open")) return;
      peeks++;
      const i = +b.dataset.card, hit = i === cPrize;
      b.classList.add("open", hit ? "prize" : "empty");
      b.setAttribute("aria-label", `Card ${i + 1}: ${hit ? "the prize" : "empty"}`);
      b.innerHTML = `<span>${hit ? "Prize" : "–"}</span>`;
      if (hit) {
        cDone = true;
        say(cmsg, "ok", `Found it after <b>${peeks}</b> peek${peeks > 1 ? "s" : ""}. On average a classical search needs (16 + 1) / 2 = 8.5 peeks, and 16 in the worst case. Now try round 2. <button class="gbtn alt" type="button" data-again>Shuffle and play again</button>`);
        $("[data-again]", cmsg).addEventListener("click", resetClassical);
      } else say(cmsg, "wait", `${peeks} peek${peeks > 1 ? "s" : ""} so far…`);
    });

    /* Round 2: Grover */
    let qPrize, amps, calls, marked, done;
    bars.innerHTML = Array.from({ length: N }, (_, i) => `<div class="gb-col"><div class="gb-bar"></div><small>${i + 1}</small></div>`).join("");
    const cols = $$(".gb-col", bars);
    function drawBars() {
      amps.forEach((a, i) => {
        const bar = cols[i].firstElementChild;
        bar.style.height = `${Math.abs(a) * 50}%`;
        bar.classList.toggle("neg", a < 0);
      });
      $("[data-calls]", g).textContent = calls;
      $("[data-p]", g).textContent = pct(amps[qPrize] ** 2);
    }
    function resetQuantum() {
      qPrize = rnd(N); amps = new Array(N).fill(1 / Math.sqrt(N)); calls = 0; marked = false; done = false;
      $$("[data-op]", g).forEach((b) => (b.disabled = false));
      cols.forEach((c) => c.classList.remove("is-prize"));
      drawBars();
      say(qmsg, "wait", "Press Oracle, then Diffuse. Repeat, and measure when you think the prize is most likely. The bars are the simulator's view of the amplitudes: a real quantum computer can't show them to you.");
    }
    function op(kind) {
      if (kind === "reset") return resetQuantum();
      if (done) return;
      if (kind === "oracle") {
        amps[qPrize] *= -1; calls++; marked = !marked;
        say(qmsg, "wait", "The oracle flipped the sign of one amplitude (the bar pointing down). The probabilities haven't changed yet, because a sign is invisible to measurement. Now diffuse.");
      } else if (kind === "diffuse") {
        const mean = amps.reduce((s, a) => s + a, 0) / N;
        amps = amps.map((a) => 2 * mean - a);
        const p = amps[qPrize] ** 2;
        say(qmsg, "wait", calls === 0
          ? "Diffusing an equal superposition changes nothing: every amplitude already sits at the average. Mark the prize with the oracle first."
          : calls >= 4
            ? `Careful: the chance is now ${pct(p)}. Grover's amplitude rises and falls like a swing, so you've gone past the peak. For 16 items the sweet spot is 3 rounds (about π/4 × √16).`
            : `Every amplitude was reflected about the average, so the marked one grew. Chance of the prize: <b>${pct(p)}</b>.`);
        marked = false;
      } else if (kind === "measure") {
        const r = Math.random();
        let acc = 0, out = N - 1;
        for (let i = 0; i < N; i++) { acc += amps[i] ** 2; if (r < acc) { out = i; break; } }
        done = true;
        $$("[data-op]", g).forEach((b) => (b.disabled = b.dataset.op !== "reset"));
        cols[qPrize].classList.add("is-prize");
        if (out === qPrize) {
          const stars = calls === 3 ? 3 : calls > 0 ? 2 : 1;
          award("grover", stars);
          say(qmsg, "ok", `Measured card <b>${out + 1}</b>: the prize! Grover needed <b>${calls}</b> oracle call${calls === 1 ? "" : "s"}, versus about 8.5 classical peeks on average. For a million items it would be about 785 calls instead of 500,000. ${starText(stars)}`);
        } else {
          award("grover", 1);
          say(qmsg, "bad", `Measured card <b>${out + 1}</b>: empty. The prize was card ${qPrize + 1}, and its chance was ${pct(amps[qPrize] ** 2)}. ${calls === 3 ? "That's the ~4% of bad luck left after 3 rounds." : "Aim for exactly 3 rounds of oracle + diffuse."} Press Reset to try again.`);
        }
      }
      drawBars();
    }
    $$("[data-op]", g).forEach((b) => b.addEventListener("click", () => op(b.dataset.op)));
    resetClassical();
    resetQuantum();
  })();

  /* ======================================================
     7. Catch the spy — BB84 eavesdropper detection
     ====================================================== */
  (function () {
    const g = $('.qgame[data-game="bb84"]');
    if (!g) return;
    const table = $("[data-table]", g), msg = $("[data-msg]", g), next = $("[data-next]", g), more = $("[data-more]", g);
    const ROUNDS = 5;
    let round = 1, score = 0, eve, photons, answered, over = false;

    const send = (k) => Array.from({ length: k }, () => {
      const aBit = rnd(2), aBasis = pick(["+", "×"]);
      let bit = aBit, basis = aBasis;
      if (eve) {                                    // Eve measures in a random filter and re-sends what she saw
        const eBasis = pick(["+", "×"]);
        bit = eBasis === basis ? bit : rnd(2);
        basis = eBasis;
      }
      const bBasis = pick(["+", "×"]);
      return { aBit, aBasis, bBasis, bBit: bBasis === basis ? bit : rnd(2) };
    });
    function render() {
      const same = (p) => p.aBasis === p.bBasis;
      const kept = photons.filter(same);
      const errors = kept.filter((p) => p.aBit !== p.bBit).length;
      $("[data-errors]", g).textContent = `${errors} of ${kept.length}`;
      const row = (label, v, cls = () => "") => `<tr><th scope="row">${label}</th>${photons.map((p, i) => `<td class="${cls(p)}">${v(p, i)}</td>`).join("")}</tr>`;
      table.innerHTML = `<table><tbody>
        ${row("Photon", (_, i) => i + 1)}
        ${row("Alice's bit", (p) => p.aBit)}
        ${row("Alice's filter", (p) => p.aBasis)}
        ${row("Bob's filter", (p) => p.bBasis, (p) => (same(p) ? "bb-same" : "bb-drop"))}
        ${row("Bob reads", (p) => p.bBit, (p) => (same(p) ? "" : "bb-drop"))}
        ${row("Compare <small>✓ match · ✗ error · – dropped</small>", (p) => (!same(p) ? "–" : p.aBit === p.bBit ? "✓" : "✗"), (p) => (!same(p) ? "bb-drop" : p.aBit === p.bBit ? "bb-ok" : "bb-err"))}
      </tbody></table>`;
      return { kept: kept.length, errors };
    }
    function newRound() {
      eve = Math.random() < 0.5; photons = send(16); answered = false;
      $("[data-round]", g).textContent = round;
      $$("[data-verdict]", g).forEach((b) => (b.disabled = false));
      more.disabled = false;
      next.hidden = true;
      render();
      say(msg, "wait", "Only columns where the two filters matched are compared; the rest are discarded. Is anyone on the line?");
    }
    more.addEventListener("click", () => {
      if (answered) return;
      photons = photons.concat(send(16));
      render();
      if (photons.length >= 64) more.disabled = true;
    });
    $$("[data-verdict]", g).forEach((b) => b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      $$("[data-verdict]", g).forEach((x) => (x.disabled = true));
      more.disabled = true;
      const { kept, errors } = render();
      const right = (b.dataset.verdict === "spy") === eve;
      if (right) score++;
      $("[data-score]", g).textContent = score;
      const escape = (0.75 ** kept * 100).toFixed(kept > 20 ? 2 : 1);
      let text;
      if (eve && errors > 0) text = `${right ? "Right" : "Wrong"}: Eve was listening. Each time she guessed the wrong filter she scrambled the photon, which shows up as errors in about 25% of the compared bits (${errors} of ${kept} here). Alice and Bob throw this key away.`;
      else if (eve) text = `${right ? "Right, well judged" : "Unlucky"}: Eve was listening but happened to leave no errors in these ${kept} bits. A spy slips past ${kept} compared bits about ${escape}% of the time (0.75 per bit), so real systems compare hundreds of bits. Try "Send 16 more photons" next time.`;
      else text = `${right ? "Right" : "Wrong"}: the line was safe. With no spy and a perfect channel, every compared bit matches. (In practice they compare only a random sample and keep the rest of the matching-filter bits as their secret key.)`;
      say(msg, right ? "ok" : "bad", text);
      if (round >= ROUNDS) {
        const stars = score === ROUNDS ? 3 : score >= ROUNDS - 1 ? 2 : 1;
        award("bb84", stars);
        msg.innerHTML += ` <br><b>Game over: ${score} / ${ROUNDS} correct verdicts. ${starText(stars)}</b>`;
        next.textContent = "Play again"; over = true;
      } else next.textContent = "Next round";
      next.hidden = false;
    }));
    next.addEventListener("click", () => {
      if (over) { over = false; round = 1; score = 0; $("[data-score]", g).textContent = 0; }
      else round++;
      newRound();
    });
    newRound();
  })();
})();
