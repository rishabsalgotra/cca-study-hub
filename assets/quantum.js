/* ==========================================================
   Topic: Quantum computing basics (topics/quantum-basics.html)
   QSim: a tiny state-vector simulator (pure, testable in Node).
   UI: Bloch sphere, superposition sampler, interference phasors, circuit lab.
   ========================================================== */
const QSim = (function () {
  "use strict";
  const S2 = Math.SQRT1_2;
  // 2×2 gate matrices as [[re, im], ...] in row-major order: [u00, u01, u10, u11]
  const G = {
    I: [[1, 0], [0, 0], [0, 0], [1, 0]],
    X: [[0, 0], [1, 0], [1, 0], [0, 0]],
    Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
    Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
    H: [[S2, 0], [S2, 0], [S2, 0], [-S2, 0]],
    S: [[1, 0], [0, 0], [0, 0], [0, 1]],
    T: [[1, 0], [0, 0], [0, 0], [S2, S2]],
  };
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

  function zero(n) {
    const amp = Array.from({ length: 1 << n }, () => [0, 0]);
    amp[0] = [1, 0];
    return { n, amp };
  }
  function apply1(st, name, q) {
    const U = G[name], bit = 1 << q;
    for (let i = 0; i < st.amp.length; i++) {
      if (i & bit) continue;
      const j = i | bit, a = st.amp[i], b = st.amp[j];
      st.amp[i] = add(mul(U[0], a), mul(U[1], b));
      st.amp[j] = add(mul(U[2], a), mul(U[3], b));
    }
  }
  function cnot(st, c, t) {
    for (let i = 0; i < st.amp.length; i++) {
      if ((i >> c) & 1 && !((i >> t) & 1)) {
        const j = i | (1 << t);
        [st.amp[i], st.amp[j]] = [st.amp[j], st.amp[i]];
      }
    }
  }
  function cz(st, a, b) {
    for (let i = 0; i < st.amp.length; i++) {
      if ((i >> a) & 1 && (i >> b) & 1) st.amp[i] = [-st.amp[i][0], -st.amp[i][1]];
    }
  }
  function run(n, ops) {
    const st = zero(n);
    for (const op of ops) {
      if (op.g === "CNOT") cnot(st, op.c, op.t);
      else if (op.g === "CZ") cz(st, op.c, op.t);
      else apply1(st, op.g, op.t);
    }
    return st;
  }
  const probs = (st) => st.amp.map(([r, i]) => r * r + i * i);
  function sample(p, shots, rnd = Math.random) {
    const counts = new Array(p.length).fill(0);
    for (let s = 0; s < shots; s++) {
      let r = rnd(), k = 0;
      while (k < p.length - 1 && r >= p[k]) { r -= p[k]; k++; }
      counts[k]++;
    }
    return counts;
  }
  const PRESETS = {
    bell: [{ g: "H", t: 0 }, { g: "CNOT", c: 0, t: 1 }],
    ghz: [{ g: "H", t: 0 }, { g: "CNOT", c: 0, t: 1 }, { g: "CNOT", c: 1, t: 2 }],
    uniform: [{ g: "H", t: 0 }, { g: "H", t: 1 }, { g: "H", t: 2 }],
    interfere: [{ g: "H", t: 0 }, { g: "H", t: 0 }],
    phase: [{ g: "H", t: 0 }, { g: "Z", t: 0 }, { g: "H", t: 0 }],
    grover: [
      { g: "H", t: 0 }, { g: "H", t: 1 },
      { g: "CZ", c: 0, t: 1 },                                   // oracle: mark |11⟩
      { g: "H", t: 0 }, { g: "H", t: 1 }, { g: "X", t: 0 }, { g: "X", t: 1 },
      { g: "CZ", c: 0, t: 1 },                                   // diffusion: reflect about the mean
      { g: "X", t: 0 }, { g: "X", t: 1 }, { g: "H", t: 0 }, { g: "H", t: 1 },
    ],
  };
  return { G, zero, apply1, cnot, cz, run, probs, sample, PRESETS };
})();
if (typeof module !== "undefined") module.exports = QSim;

if (typeof document !== "undefined") (function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clean = (x) => (Math.abs(x) < 5e-4 ? 0 : x);
  const f3 = (x) => clean(x).toFixed(3);
  const cfmt = (re, im) => {
    re = clean(re); im = clean(im);
    if (im === 0) return f3(re);
    if (re === 0) return `${f3(im)}i`;
    return `${f3(re)} ${im < 0 ? "−" : "+"} ${Math.abs(im).toFixed(3)}i`;
  };
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------- Bloch sphere ---------- */
  const bs = $("#bloch-svg");
  if (bs) {
    const R = 120, cx = 180, cy = 168;
    const P = (x, y, z) => [cx + R * (y - 0.42 * x), cy + R * (-z + 0.3 * x)];
    const poly = (pts, cls) => el("polyline", { points: pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), class: cls }, bs);
    const arc = (fn, a0, a1, cls) => {
      const pts = [];
      for (let k = 0; k <= 60; k++) { const t = a0 + ((a1 - a0) * k) / 60; pts.push(P(...fn(t))); }
      poly(pts, cls);
    };
    const D = Math.PI / 180;
    arc((t) => [0, Math.sin(t), Math.cos(t)], 0, 2 * Math.PI, "bl-outline");          // y–z great circle (silhouette)
    arc((t) => [Math.cos(t), Math.sin(t), 0], 90 * D, 270 * D, "bl-back");             // equator, back half
    arc((t) => [Math.cos(t), Math.sin(t), 0], -90 * D, 90 * D, "bl-front");            // equator, front half
    arc((t) => [Math.sin(t), 0, Math.cos(t)], 0, Math.PI, "bl-front bl-faint");        // x–z meridian, front
    arc((t) => [Math.sin(t), 0, Math.cos(t)], Math.PI, 2 * Math.PI, "bl-back");       // x–z meridian, back
    [[[-1, 0, 0], [1, 0, 0]], [[0, -1, 0], [0, 1, 0]], [[0, 0, -1], [0, 0, 1]]].forEach(([a, b]) => poly([P(...a), P(...b)], "bl-axis"));
    const label = (v, txt, cls = "") => { const [x, y] = P(...v); const t = el("text", { x: x.toFixed(1), y: (y + 5).toFixed(1), "text-anchor": "middle", class: "bl-lbl " + cls }, bs); t.textContent = txt; };
    label([0, 0, 1.17], "|0⟩", "strong"); label([0, 0, -1.2], "|1⟩", "strong");
    label([1.32, 0, 0], "|+⟩"); label([-1.2, 0, 0], "|−⟩"); label([0, 1.17, 0], "|+i⟩"); label([0, -1.2, 0], "|−i⟩");
    const proj = el("polyline", { class: "bl-proj" }, bs);
    const vec = el("line", { x1: cx, y1: cy, class: "bl-vec", "marker-end": "url(#bl-arrow)" }, bs);
    const dot = el("circle", { r: 5, class: "bl-dot" }, bs);
    el("circle", { cx, cy, r: 3, class: "bl-center" }, bs);

    let v = [0, 0, 1], busy = false;
    const th = $("#bl-theta"), ph = $("#bl-phi");
    function render(syncSliders = true) {
      const [x, y, z] = v;
      const [sx, sy] = P(x, y, z);
      vec.setAttribute("x2", sx.toFixed(1)); vec.setAttribute("y2", sy.toFixed(1));
      dot.setAttribute("cx", sx.toFixed(1)); dot.setAttribute("cy", sy.toFixed(1));
      proj.setAttribute("points", [P(0, 0, 0), P(x, y, 0), P(x, y, z)].map((p) => p.map((q) => q.toFixed(1)).join(",")).join(" "));
      const theta = Math.acos(Math.max(-1, Math.min(1, z)));
      let phi = Math.atan2(y, x); if (phi < 0) phi += 2 * Math.PI;
      if (Math.sin(theta) < 1e-6) phi = 0;
      if (syncSliders) { th.value = Math.round(theta / D); ph.value = Math.round(phi / D) % 360; }
      const a = Math.cos(theta / 2), b = Math.sin(theta / 2);
      $("#bl-theta-out").textContent = `${Math.round(theta / D)}°`;
      $("#bl-phi-out").textContent = `${Math.round(phi / D) % 360}°`;
      $("#bl-alpha").textContent = f3(a);
      $("#bl-beta").textContent = cfmt(b * Math.cos(phi), b * Math.sin(phi));
      $("#bl-p0").textContent = `${(a * a * 100).toFixed(1)}%`;
      $("#bl-p1").textContent = `${(b * b * 100).toFixed(1)}%`;
      $("#bl-bar0").style.width = `${a * a * 100}%`;
      $("#bl-bar1").style.width = `${b * b * 100}%`;
    }
    const fromAngles = () => { const t = th.value * D, p = ph.value * D; v = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)]; render(false); };
    th.addEventListener("input", fromAngles); ph.addEventListener("input", fromAngles);
    const rot = (u, k, a) => {                                   // Rodrigues' rotation of u about unit axis k
      const c = Math.cos(a), s = Math.sin(a), d = k[0] * u[0] + k[1] * u[1] + k[2] * u[2];
      const cr = [k[1] * u[2] - k[2] * u[1], k[2] * u[0] - k[0] * u[2], k[0] * u[1] - k[1] * u[0]];
      return [0, 1, 2].map((i) => u[i] * c + cr[i] * s + k[i] * d * (1 - c));
    };
    const AX = { X: [[1, 0, 0], Math.PI], Y: [[0, 1, 0], Math.PI], Z: [[0, 0, 1], Math.PI],
      H: [[Math.SQRT1_2, 0, Math.SQRT1_2], Math.PI], S: [[0, 0, 1], Math.PI / 2], T: [[0, 0, 1], Math.PI / 4] };
    const hist = $("#bl-history");
    $$("[data-bgate]").forEach((b) => b.addEventListener("click", () => {
      if (busy) return;
      const [k, ang] = AX[b.dataset.bgate], v0 = v.slice();
      hist.textContent = (hist.textContent === "—" ? "" : hist.textContent + " → ") + b.dataset.bgate;
      if (reduce()) { v = rot(v0, k, ang); render(); return; }
      busy = true; const t0 = performance.now(), T = 650;
      const step = (now) => {
        const u = Math.min(1, (now - t0) / T), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        v = rot(v0, k, ang * e); render();
        if (u < 1) requestAnimationFrame(step); else busy = false;
      };
      requestAnimationFrame(step);
    }));
    const PRE = { "0": [0, 0, 1], "1": [0, 0, -1], "+": [1, 0, 0], "-": [-1, 0, 0], "+i": [0, 1, 0], "-i": [0, -1, 0] };
    $$("[data-bstate]").forEach((b) => b.addEventListener("click", () => { v = PRE[b.dataset.bstate].slice(); hist.textContent = "—"; render(); }));
    render();
  }

  /* ---------- Superposition sampler ---------- */
  const sp = $("#sup");
  if (sp) {
    const th = $("#sup-theta");
    let counts = [0, 0];
    const p0 = () => Math.cos((th.value * Math.PI) / 360) ** 2;
    function draw(last) {
      const a = Math.cos((th.value * Math.PI) / 360), b = Math.sin((th.value * Math.PI) / 360);
      $("#sup-theta-out").textContent = `${th.value}°`;
      $("#sup-state").textContent = `${f3(a)}|0⟩ + ${f3(b)}|1⟩`;
      $("#sup-p0").textContent = `${(a * a * 100).toFixed(1)}%`; $("#sup-p1").textContent = `${(b * b * 100).toFixed(1)}%`;
      $("#sup-b0").style.width = `${a * a * 100}%`; $("#sup-b1").style.width = `${b * b * 100}%`;
      const n = counts[0] + counts[1];
      $("#sup-n").textContent = n;
      $("#sup-c0").textContent = counts[0]; $("#sup-c1").textContent = counts[1];
      $("#sup-h0").style.width = n ? `${(counts[0] / n) * 100}%` : "0";
      $("#sup-h1").style.width = n ? `${(counts[1] / n) * 100}%` : "0";
      if (last !== undefined) {
        const o = $("#sup-last");
        o.textContent = `Last result: ${last}. The state is now |${last}⟩. Measuring it again would give ${last} every time.`;
      }
    }
    th.addEventListener("input", () => { counts = [0, 0]; $("#sup-last").textContent = "Measure to collapse the state."; draw(); });
    $$("[data-shots]").forEach((b) => b.addEventListener("click", () => {
      const k = parseInt(b.dataset.shots, 10); let last;
      for (let i = 0; i < k; i++) { last = Math.random() < p0() ? 0 : 1; counts[last]++; }
      draw(last);
    }));
    $("#sup-reset").addEventListener("click", () => { counts = [0, 0]; $("#sup-last").textContent = "Measure to collapse the state."; draw(); });
    draw();
  }

  /* ---------- Interference phasors ---------- */
  const itf = $("#itf");
  if (itf) {
    const phi = $("#itf-phi"), U = 110;
    const set = (id, x1, y1, x2, y2) => { const l = $("#" + id); l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); };
    function panel(prefix, ox, oy, sign) {
      const p = (phi.value * Math.PI) / 180;
      const ax = ox + 0.5 * U, ay = oy;
      const bx = ax + sign * 0.5 * U * Math.cos(p), by = ay - sign * 0.5 * U * Math.sin(p);
      set(prefix + "-a", ox, oy, ax, ay); set(prefix + "-b", ax, ay, bx, by); set(prefix + "-r", ox, oy, bx, by);
      const re = 0.5 + sign * 0.5 * Math.cos(p), im = sign * 0.5 * Math.sin(p);
      return re * re + im * im;
    }
    function draw() {
      $("#itf-phi-out").textContent = `${phi.value}°`;
      const p0 = panel("itf0", 70, 120, 1), p1 = panel("itf1", 330, 120, -1);
      $("#itf-p0").textContent = `${(p0 * 100).toFixed(1)}%`; $("#itf-p1").textContent = `${(p1 * 100).toFixed(1)}%`;
      $("#itf-b0").style.width = `${p0 * 100}%`; $("#itf-b1").style.width = `${p1 * 100}%`;
    }
    phi.addEventListener("input", draw);
    let sweeping = false;
    $("#itf-sweep").addEventListener("click", (e) => {
      if (sweeping) { sweeping = false; e.target.textContent = "▶ Sweep φ"; return; }
      sweeping = true; e.target.textContent = "❚❚ Stop";
      let last = performance.now();
      const step = (now) => {
        if (!sweeping) return;
        phi.value = (parseFloat(phi.value) + ((now - last) / 1000) * (reduce() ? 20 : 60)) % 360; last = now;
        draw(); requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    draw();
  }

  /* ---------- Circuit lab ---------- */
  const lab = $("#lab-demo");
  if (lab) {
    const N = 3, MAX = 16;
    let ops = QSim.PRESETS.bell.slice(), counts = null;
    const gSel = $("#lab-gate"), tSel = $("#lab-target"), cSel = $("#lab-control");
    const twoQ = () => gSel.value === "CNOT" || gSel.value === "CZ";
    const syncControls = () => { $("#lab-control-wrap").hidden = !twoQ(); };
    gSel.addEventListener("change", syncControls);
    $("#lab-add").addEventListener("click", () => {
      const msg = $("#lab-msg");
      if (ops.length >= MAX) { msg.textContent = `Up to ${MAX} gates in this lab.`; return; }
      const t = +tSel.value;
      if (twoQ()) {
        const c = +cSel.value;
        if (c === t) { msg.textContent = "Control and target must be different qubits."; return; }
        ops.push({ g: gSel.value, c, t });
      } else ops.push({ g: gSel.value, t });
      msg.textContent = ""; counts = null; render();
    });
    $("#lab-undo").addEventListener("click", () => { ops.pop(); counts = null; render(); });
    $("#lab-clear").addEventListener("click", () => { ops = []; counts = null; render(); });
    $("#lab-shots").addEventListener("click", () => { counts = QSim.sample(QSim.probs(QSim.run(N, ops)), 1000); render(); });
    $$("[data-lpreset]").forEach((b) => b.addEventListener("click", () => { ops = QSim.PRESETS[b.dataset.lpreset].slice(); counts = null; render(); }));

    function drawCircuit() {
      const svg = $("#lab-svg"), w = Math.max(560, 110 + ops.length * 50 + 60);
      svg.setAttribute("viewBox", `0 0 ${w} 170`);
      svg.style.minWidth = `${Math.min(w, 900)}px`;
      svg.innerHTML = "";
      const y = (q) => 35 + q * 50;
      for (let q = 0; q < N; q++) {
        el("line", { x1: 70, x2: w - 20, y1: y(q), y2: y(q), class: "lab-wire" }, svg);
        const t = el("text", { x: 8, y: y(q) + 5, class: "lab-q" }, svg); t.textContent = `q${q} |0⟩`;
      }
      ops.forEach((op, k) => {
        const x = 105 + k * 50;
        if (op.g === "CNOT" || op.g === "CZ") {
          el("line", { x1: x, x2: x, y1: y(op.c), y2: y(op.t), class: "lab-link" }, svg);
          el("circle", { cx: x, cy: y(op.c), r: 6, class: "lab-ctrl" }, svg);
          if (op.g === "CNOT") {
            el("circle", { cx: x, cy: y(op.t), r: 12, class: "lab-targ" }, svg);
            el("line", { x1: x - 12, x2: x + 12, y1: y(op.t), y2: y(op.t), class: "lab-link" }, svg);
            el("line", { x1: x, x2: x, y1: y(op.t) - 12, y2: y(op.t) + 12, class: "lab-link" }, svg);
          } else el("circle", { cx: x, cy: y(op.t), r: 6, class: "lab-ctrl" }, svg);
        } else {
          el("rect", { x: x - 16, y: y(op.t) - 16, width: 32, height: 32, rx: 6, class: "lab-gate g-" + op.g }, svg);
          const t = el("text", { x, y: y(op.t) + 5, "text-anchor": "middle", class: "lab-gtxt" }, svg); t.textContent = op.g;
        }
      });
      for (let q = 0; q < N; q++) {
        const x = w - 40;
        el("rect", { x: x - 14, y: y(q) - 13, width: 28, height: 26, rx: 5, class: "lab-meas" }, svg);
        el("path", { d: `M${x - 8},${y(q) + 6} A9,9 0 0 1 ${x + 8},${y(q) + 6}`, class: "lab-link" }, svg);
        el("line", { x1: x, y1: y(q) + 6, x2: x + 7, y2: y(q) - 6, class: "lab-link" }, svg);
      }
    }
    function render() {
      drawCircuit();
      const st = QSim.run(N, ops), p = QSim.probs(st);
      const rows = st.amp.map(([re, im], i) => {
        const bits = i.toString(2).padStart(N, "0");
        const pct = p[i] * 100, nz = p[i] > 1e-9;
        const shots = counts ? `<td class="num">${counts[i]}</td>` : "";
        return `<tr class="${nz ? "nz" : ""}"><td><code>|${bits}⟩</code></td><td class="num">${cfmt(re, im)}</td>
          <td><div class="pbar"><span style="width:${pct}%"></span></div></td><td class="num">${clean(pct).toFixed(1)}%</td>${shots}</tr>`;
      }).join("");
      $("#lab-table").innerHTML = `<thead><tr><th>Basis |q2 q1 q0⟩</th><th>Amplitude</th><th>Probability</th><th></th>${counts ? "<th>1000 shots</th>" : ""}</tr></thead><tbody>${rows}</tbody>`;
      $("#lab-ops").textContent = ops.length ? ops.map((o) => (o.g === "CZ" ? `CZ(q${o.c},q${o.t})` : o.c !== undefined ? `${o.g}(q${o.c}→q${o.t})` : `${o.g}(q${o.t})`)).join("  ·  ") : "empty circuit: state stays |000⟩";
    }
    syncControls(); render();
  }
})();
