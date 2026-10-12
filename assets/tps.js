/* ==========================================================
   Topic: 1M TPS vs 1K TPS explorer (topics/tps-architecture.html)
   1. Motion + label preferences   2. Tabs and component details
   3. Illustrative animation engine 4. Throughput simulator (explicit model)
   ========================================================== */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const fmt = (n, d = 0) => (Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "∞");
  const dur = (s) => {
    if (!Number.isFinite(s)) return "never (capacity ≤ arrivals)";
    if (s < 1) return "< 1 s";
    if (s < 120) return `${fmt(s)} s`;
    if (s < 7200) return `${fmt(s / 60, 1)} min`;
    return `${fmt(s / 3600, 1)} h`;
  };

  /* ---------- 1. Motion and label preferences ---------- */
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = store.get("tps-reduce-motion", null);
  if (reduce === null) reduce = mq.matches;               // follow the OS until the user chooses
  function applyMotion() {
    document.body.classList.toggle("reduce-motion", reduce);
    $$("[data-reduce-toggle]").forEach((b) => {
      b.setAttribute("aria-pressed", String(reduce));
      b.textContent = reduce ? "Reduced motion: on" : "Reduced motion: off";
    });
  }
  $$("[data-reduce-toggle]").forEach((b) => b.addEventListener("click", () => {
    reduce = !reduce; store.set("tps-reduce-motion", reduce); applyMotion();
    if (reduce) anim.pause();
  }));
  let labelsOn = true;
  $$("[data-labels-toggle]").forEach((b) => b.addEventListener("click", () => {
    labelsOn = !labelsOn;
    document.body.classList.toggle("labels-off", !labelsOn);
    $$("[data-labels-toggle]").forEach((x) => {
      x.setAttribute("aria-pressed", String(labelsOn));
      x.textContent = labelsOn ? "Labels: on" : "Labels: off";
    });
  }));

  /* ---------- 2. Tabs and component details ---------- */
  function setupTabs(list, onChange) {
    const tabs = $$('[role="tab"]', list);
    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (onChange) onChange(tab.dataset.arch);
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const keys = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
        if (e.key in keys) { e.preventDefault(); select(tabs[keys[e.key]], true); }
      });
    });
    return select;
  }

  const L = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  const INFO = {
    intro1k: { title: "Recommended 1,000 TPS architecture", sub: "Select any component (click, or Tab then Enter) to see its purpose, failure modes and trade-offs.",
      purpose: "Accept requests at the edge as fast as clients send them, but complete work only as fast as each downstream system can sustainably absorb it. Ingress, buffering and processing scale independently.",
      fail: ["Treating the queue as capacity: it only stores work", "Workers scaling beyond what legacy systems can absorb", "Async contracts imposed on operations that need an immediate answer"],
      trade: ["More moving parts than a direct call", "Eventual completion: clients need a status endpoint or callback", "Needs idempotency and reconciliation to be correct"] },
    intro1m: { title: "1M TPS distributed architecture (conceptual)", sub: "Select a component for details. Verified benchmark facts are listed separately below the diagram.",
      purpose: "Reach very high throughput by partitioning state and work into many independent shards that execute in parallel, coordinated by a consensus protocol.",
      fail: ["Hot partitions concentrate load on one shard", "Cross-shard work adds latency and coordination", "Operational complexity: hundreds of nodes, upgrades, monitoring"],
      trade: ["Only pays off when work is partitionable and the platform owns its state", "Not applicable when the bottleneck is a legacy system you cannot shard"] },
    clients: { title: "Corporate clients & applications", sub: "Callers: ERP, treasury systems, partner platforms, internal apps.",
      purpose: "Originate transactions. Their retry behaviour largely decides whether an overload stays contained or becomes a retry storm.",
      fail: ["Aggressive retries without backoff multiply load during incidents", "Retrying a timed-out payment without an idempotency key creates duplicates", "Ignoring 202 semantics and treating 'accepted' as 'completed'"],
      trade: ["Publish a client contract: idempotency keys, Retry-After, exponential backoff with jitter", "Per-client quotas protect everyone from one noisy caller"] },
    waf: { title: "AWS WAF (where applicable)", sub: "Optional edge protection in front of API Gateway.",
      purpose: "Filter malicious or abusive traffic before it consumes API capacity: IP reputation, rate-based rules, managed rule groups, geo rules.",
      fail: ["Overly broad rules block legitimate corporate traffic", "Rate-based rules act per IP: shared corporate egress IPs can trip them"],
      trade: ["Adds per-request cost and rule maintenance", "Not a substitute for per-client throttling in API Gateway"],
      aws: "Associate a web ACL with the API stage; start rules in count mode, then switch to block." },
    apigw: { title: "Amazon API Gateway", sub: "Managed ingress: TLS, routing, authorizers, throttling, usage plans.",
      purpose: "Accept and route requests with managed, independently scaling capacity; enforce per-client and per-route throttling; return 429 when limits are exceeded.",
      fail: ["Account- and stage-level throttles (region quotas) reached during bursts → 429s", "Integration timeout reached on long synchronous calls (default 29 s for REST integrations; check current quotas)", "Misconfigured usage plans let one client consume the shared budget"],
      trade: ["Very high request capacity, but it says nothing about downstream capacity", "REST vs HTTP API: feature set (usage plans, request validation, caching) vs cost and latency"],
      aws: "Use usage plans + API keys or authorizer context for per-client quotas; enable request validation; alarm on 4XX/5XX and Latency." },
    auth: { title: "Authentication, authorization, validation, rate limiting", sub: "Usually API Gateway features plus a Lambda or Cognito/JWT authorizer.",
      purpose: "Reject bad requests cheaply and early: identity, entitlements, schema validation and quotas all happen before any work is queued.",
      fail: ["Authorizer that calls a slow identity system becomes a bottleneck itself", "Cached authorizer decisions outliving revoked permissions", "Validation drift between API schema and backend expectations"],
      trade: ["Authorizer caching lowers latency but delays revocation", "Strict validation shifts errors to clients (good) but needs versioned contracts"],
      aws: "Cache authorizer results with a short TTL; request validators on REST APIs; per-client rate limits via usage plans." },
    lambda: { title: "AWS Lambda: ingress / orchestration", sub: "Thin handler: validate, enforce idempotency, record state, enqueue, respond.",
      purpose: "For async operations: persist the transaction (ACCEPTED), enqueue it and return 202 + correlation ID in milliseconds. For sync operations: call the downstream adapter with a bounded wait.",
      fail: ["Regional concurrency quota (shared by every function in the account/region) exhausted → throttles", "Sync handlers waiting on slow downstreams hold concurrency until timeout", "Partial failure between 'status written' and 'message sent' (use an outbox or make both steps idempotent)"],
      trade: ["Concurrency needed ≈ TPS × average duration (Little's law): 1,000 TPS × 50 ms ≈ 50 concurrent", "Reserved concurrency protects this function but caps it too"],
      aws: "Keep ingress work tiny; set reserved concurrency; Powertools for AWS Lambda offers an idempotency utility backed by DynamoDB." },
    eventbridge: { title: "Amazon EventBridge (optional)", sub: "Use when routing or fan-out rules are useful; skip for simple point-to-point queues.",
      purpose: "Route transactions to per-downstream queues by type or attributes, and fan out the same event to several consumers (audit, analytics) without coupling the ingress code.",
      fail: ["Rule mistakes silently drop or mis-route events (monitor FailedInvocations, use archives/DLQs on targets)", "Extra hop adds latency"],
      trade: ["Decoupling and flexible routing vs one more service and its quotas", "Direct SQS send from Lambda is simpler when routing is static"] },
    sqs: { title: "Amazon SQS: per-downstream queues", sub: "Standard or FIFO, chosen by ordering and deduplication needs.",
      purpose: "Durably buffer accepted work and decouple arrival rate from processing rate. Separate queues per downstream isolate a slow system from the rest.",
      fail: ["Backlog grows without bound when arrivals exceed completion: watch ApproximateAgeOfOldestMessage", "Visibility timeout shorter than processing time → duplicate deliveries", "Messages expire at the retention limit if the backlog is never drained"],
      trade: ["Standard: at-least-once delivery, best-effort ordering, very high throughput", "FIFO: ordering per message group + deduplication window, lower per-queue throughput (high-throughput mode raises it; check current quotas)", "A queue absorbs bursts; it does not create processing capacity"],
      aws: "Set the visibility timeout to at least 6× the consumer Lambda timeout (AWS guidance); add a redrive policy to a DLQ." },
    dlq: { title: "Dead-letter queues", sub: "One per source queue, after maxReceiveCount failed receives.",
      purpose: "Move repeatedly failing ('poison') messages out of the main flow so they stop consuming worker and downstream capacity.",
      fail: ["Unmonitored DLQs: failed transactions silently pile up", "Redriving before fixing the cause just fails again", "Retention expiry deletes evidence"],
      trade: ["Isolation vs ordering: a dead-lettered message breaks FIFO sequence for its group", "Needs runbooks, alarms and a redrive/replay process"],
      aws: "Alarm on ApproximateNumberOfMessagesVisible > 0; use SQS DLQ redrive to move messages back after a fix." },
    workers: { title: "Controlled worker tier", sub: "Lambda (SQS event source mapping) or containers, with a concurrency budget per downstream.",
      purpose: "Pull work at a controlled rate. The concurrency cap per queue is the throttle that protects each downstream system.",
      fail: ["Unbounded scale-out overwhelms the legacy system (more workers ≠ more throughput)", "Batch failures re-process successful items unless partial batch responses are used", "Long timeouts tie up concurrency during downstream brown-outs"],
      trade: ["Worker capacity (TPS) ≈ concurrency ÷ average processing time", "Lambda: simple, scales fast; containers: long-lived connections and pools"],
      aws: "Use the event source mapping's maximum concurrency setting per queue, ReportBatchItemFailures, and a sensible batch size/window." },
    adapter: { title: "Downstream-specific adapters", sub: "One adapter per system: protocol translation + protection.",
      purpose: "Encapsulate each system's quirks (protocol, auth, error codes, idempotency support) and enforce its rate limit, timeout, circuit breaker and connection pool.",
      fail: ["Per-instance rate limiters multiply with scale-out (use a shared limiter or concurrency caps)", "Wrong error classification: retrying non-retryable errors, or giving up on transient ones", "Timeouts that leave the outcome unknown"],
      trade: ["More code to own, but failure handling stays explicit and testable", "Shared circuit-breaker state needs a store or approximation"] },
    legacy: { title: "Legacy core / transaction-processing system", sub: "Example capacity: ~300 TPS sustainable (illustrative).",
      purpose: "System of record. Usually the binding constraint: fixed connection limits, batch windows, vertical scaling only.",
      fail: ["Overload causes latency spikes, then timeouts, then errors: often non-linear", "Timeouts with unknown outcome (did it post?)", "Maintenance windows / batch runs reduce capacity at certain hours"],
      trade: ["Increasing its capacity is usually slow and expensive: protect it rather than flood it", "Rate and concurrency limits must come from measured capacity, not guesses"] },
    corp: { title: "Corporate banking application", sub: "Example capacity: ~600 TPS sustainable (illustrative).",
      purpose: "Domain application (payments initiation, account services). Often scales better than the core, but has its own limits.",
      fail: ["Shared database contention with other channels", "Session/connection pool exhaustion"],
      trade: ["If requests can be partitioned (e.g. by customer), parallel instances may raise capacity: only if the app and its data support it"] },
    partner: { title: "External service / partner API", sub: "Example capacity: ~200 TPS contracted quota (illustrative).",
      purpose: "Third-party dependency with contractual rate limits and variable latency you don't control.",
      fail: ["429s from the partner when the quota is exceeded", "Latency spikes and outages outside your control", "Changing error semantics"],
      trade: ["Strict per-partner rate limit and circuit breaker", "Isolate in its own queue so partner issues never block internal flows"] },
    status: { title: "Transaction status / result store", sub: "Amazon DynamoDB or an existing durable database.",
      purpose: "Single source of truth for each transaction: idempotency key, status (ACCEPTED → PROCESSING → SUCCEEDED / FAILED / RECONCILIATION_REQUIRED), timestamps, result.",
      fail: ["Non-conditional updates let a late retry overwrite a newer state", "Hot partition keys if keyed by client instead of transaction ID", "PII retention not governed"],
      trade: ["One extra write per transition: small latency, large gain in traceability", "Choose TTLs for idempotency records vs audit retention"],
      aws: "DynamoDB conditional writes for idempotency and state transitions; streams can drive callbacks." },
    statusapi: { title: "Client status API or callback", sub: "GET /transactions/{correlationId} or a signed webhook.",
      purpose: "Lets clients learn the outcome of asynchronously processed transactions without holding a connection open.",
      fail: ["Polling storms if clients poll too aggressively (rate-limit, return Retry-After)", "Callbacks lost when the client endpoint is down (retry with backoff + DLQ)"],
      trade: ["Polling is simple and robust; callbacks are efficient but need delivery guarantees and signing"] },
    sync: { title: "Synchronous path", sub: "For operations that need an immediate, definitive answer.",
      purpose: "Some operations (balance checks, real-time authorisations, instant payment confirmations) can't become async unless the business contract changes. They call the downstream directly with strict limits.",
      fail: ["Unbounded waits cascade: callers time out while work continues", "Overload turns into timeouts instead of fast, clear rejections"],
      trade: ["Bounded wait + explicit timeout + fast 429/503 with Retry-After when capacity is exhausted", "Reserve separate concurrency so sync traffic can't be starved by async workers (or the reverse)"] },
    resp202: { title: "HTTP 202 Accepted + correlation ID", sub: "The async acceptance contract.",
      purpose: "Confirms the transaction is durably recorded and queued, not that it is complete. The client uses the correlation ID to query status or match the callback.",
      fail: ["Clients interpreting 202 as success", "Returning 202 before the message is durably stored (lost transactions)"],
      trade: ["Only return 202 after the status record and queue message are both durable", "Document the maximum time-to-completion the business accepts"] },
    cloudwatch: { title: "Amazon CloudWatch", sub: "Metrics, dashboards, alarms (cross-cutting).",
      purpose: "Make throughput and saturation visible: arrival vs completion rates, queue depth and age, worker concurrency, downstream latency and error rates.",
      fail: ["Alarming on averages hides tail latency", "No alarm on queue age: backlog discovered by customers"],
      trade: ["Custom metrics per downstream cost money but are essential", "Use embedded metric format from Lambda for cheap high-cardinality metrics"],
      aws: "Key metrics: SQS ApproximateAgeOfOldestMessage and ApproximateNumberOfMessagesVisible; Lambda ConcurrentExecutions, Throttles, Errors, Duration; API Gateway 4XXError, 5XXError, Latency." },
    secrets: { title: "AWS Secrets Manager & AWS KMS", sub: "Credentials and encryption (cross-cutting).",
      purpose: "Store downstream credentials and certificates with rotation; encrypt queues, tables and logs with managed or customer-managed keys.",
      fail: ["Fetching secrets on every invocation adds latency and API calls (cache them)", "Rotation breaking legacy connections that pin credentials"],
      trade: ["Customer-managed KMS keys give control and audit, at some cost and request quota considerations"] },
    gen: { title: "Clients / transaction generators", sub: "Conceptual. In the referenced benchmark, load comes from a transaction generator built into the node software.",
      purpose: "Produce a very high, uniform stream of simple transactions (native token transfers).",
      fail: ["Generator itself becomes the bottleneck if not distributed"],
      trade: ["Synthetic, uniform load differs from real enterprise traffic mixes"] },
    netingress: { title: "Distributed network ingress", sub: "Conceptual: RPC endpoints and peer-to-peer gossip across many nodes.",
      purpose: "Spread incoming transactions across the network so no single entry point limits throughput.",
      fail: ["Uneven load across entry nodes", "Network bandwidth between regions"],
      trade: ["Every node participates: no central gateway, but much more infrastructure"] },
    routing: { title: "Transaction routing", sub: "Conceptual: each account belongs to a shard; a transaction goes to its sender's shard.",
      purpose: "Partition the workload so each shard handles only its own slice of accounts and state.",
      fail: ["Hot accounts concentrate load on a single shard", "Re-sharding changes routing while traffic flows"],
      trade: ["Works because native transfers partition cleanly by account: most enterprise workloads don't"] },
    shard: { title: "Sharded execution group", sub: "Conceptual: each shard executes its transactions in parallel with the others and owns its slice of state.",
      purpose: "Horizontal scale-out: add shards to add throughput, as long as work and state partition cleanly.",
      fail: ["Node failure within a shard", "State growth per shard", "Skew: one busy shard limits overall throughput"],
      trade: ["Per the README, the benchmark ran 70 shards with two chunk producers per shard on 140 nodes"] },
    consensus: { title: "Consensus / coordination", sub: "Conceptual: block production and finality across shards.",
      purpose: "Agree on a single ordered history and propagate results, so independent shards remain one consistent ledger.",
      fail: ["Slow or partitioned validators delay finality", "Coordination overhead grows with network size"],
      trade: ["Needed for a trustless ledger. An enterprise platform with a system of record usually gets ordering and durability from its database instead"] },
    results: { title: "Transaction results", sub: "Conceptual: outcomes and receipts become final and queryable.",
      purpose: "Expose final outcomes to clients and indexers.",
      fail: ["Finality latency vs throughput trade-offs"],
      trade: ["High throughput does not imply low latency for each transaction"] },
  };

  const panel = $("#info-panel");
  function showInfo(id) {
    const d = INFO[id];
    if (!d || !panel) return;
    $$(".wb .node.selected, .chip-btn.selected").forEach((e) => e.classList.remove("selected"));
    $$(`[data-node="${id}"]`).forEach((e) => e.classList.add("selected"));
    panel.innerHTML = `<h4>${d.title}</h4><div class="sub">${d.sub}</div><dl>
      <div><dt>Purpose</dt><dd>${d.purpose}</dd></div>
      <div><dt class="fail">Failure modes</dt><dd>${L(d.fail)}</dd></div>
      <div><dt class="trade">Operational trade-offs</dt><dd>${L(d.trade)}</dd></div>
      ${d.aws ? `<div><dt class="aws">AWS notes</dt><dd>${d.aws}</dd></div>` : ""}</dl>`;
  }
  $$("[data-node]").forEach((el) => {
    el.addEventListener("click", () => showInfo(el.dataset.node));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showInfo(el.dataset.node); }
    });
  });
  const archList = $("#arch-tabs");
  if (archList) setupTabs(archList, (arch) => showInfo(arch === "1m" ? "intro1m" : "intro1k"));
  showInfo("intro1k");

  /* ---------- 3. Illustrative animation engine ---------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  class Dot {
    constructor(layer, x, y, r, cls) {
      this.el = document.createElementNS(SVGNS, "circle");
      this.el.setAttribute("r", r);
      this.x = x; this.y = y; this.route = null; this.wait = 0;
      this.set(cls); layer.appendChild(this.el); this.place();
    }
    set(cls) { this.el.setAttribute("class", "dot " + cls); }
    go(points, speed, then) { this.route = points.map((p) => p.slice()); this.speed = speed; this.then = then || null; }
    hold(sec, then) { this.wait = sec; this.afterWait = then; }
    step(dt) {
      if (this.wait > 0) {
        this.wait -= dt;
        if (this.wait <= 0) { this.wait = 0; const f = this.afterWait; this.afterWait = null; if (f) f(this); }
        return;
      }
      if (!this.route) return;
      let move = this.speed * dt;
      while (move > 0 && this.route.length) {
        const [tx, ty] = this.route[0];
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        if (d <= move) { this.x = tx; this.y = ty; move -= d; this.route.shift(); }
        else { this.x += (dx / d) * move; this.y += (dy / d) * move; move = 0; }
      }
      this.place();
      if (!this.route.length) { this.route = null; const f = this.then; this.then = null; if (f) f(this); }
    }
    place() { this.el.setAttribute("cx", this.x.toFixed(1)); this.el.setAttribute("cy", this.y.toFixed(1)); }
    fadeOut() { this.el.classList.add("fade"); this.removeIn = 0.45; this.route = null; }
  }

  class Scene {
    constructor(svg) { this.svg = svg; this.layer = svg.querySelector(".particles"); this.dots = []; this.t = 0; }
    add(d) { this.dots.push(d); return d; }
    tick(dt) {
      this.t += dt;
      this.update(dt);
      for (const d of this.dots) {
        if (d.removeIn !== undefined) { d.removeIn -= dt; if (d.removeIn <= 0) d.el.remove(); }
        else d.step(dt);
      }
      this.dots = this.dots.filter((d) => !(d.removeIn !== undefined && d.removeIn <= 0));
    }
    clear() { this.dots.forEach((d) => d.el.remove()); this.dots = []; this.t = 0; }
  }

  /* 1K scene: rate-limited ingress, per-downstream queues, capped workers, retries, DLQ */
  class Scene1K extends Scene {
    constructor(svg) {
      super(svg);
      this.lanes = [
        { id: "A", y: 90, workers: 2, svc: 1.7, fail: 0.05, share: 0.3 },   // legacy core: slow
        { id: "B", y: 220, workers: 3, svc: 0.8, fail: 0.02, share: 0.4 },  // corporate banking
        { id: "C", y: 350, workers: 2, svc: 1.0, fail: 0.22, share: 0.3 },  // partner API: flaky
      ];
      this.reset();
    }
    reset() {
      this.clear();
      this.acc = 0; this.tokens = 5; this.dlq = [];
      this.s = { arrived: 0, throttled: 0, accepted: 0, completed: 0, retries: 0, dlq: 0 };
      for (const l of this.lanes) { l.queue = []; l.slots = new Array(l.workers).fill(null); }
    }
    rate() { return this.t % 14 < 4 ? 6 : 2; }               // bursts of 6/s, baseline 2/s (visual units)
    update(dt) {
      this.tokens = Math.min(5, this.tokens + 4.5 * dt);     // API Gateway token bucket: 4.5/s, burst 5
      this.acc += this.rate() * dt;
      while (this.acc >= 1) { this.acc -= 1; this.spawn(); }
      for (const l of this.lanes) this.updateLane(l, dt);
    }
    pick() {
      let r = Math.random();
      for (const l of this.lanes) { if (r < l.share) return l; r -= l.share; }
      return this.lanes[this.lanes.length - 1];
    }
    spawn() {
      this.s.arrived++;
      const d = this.add(new Dot(this.layer, 14, 220 + (Math.random() * 14 - 7), 6, "req"));
      d.go([[170, 220]], 260, () => {
        if (this.tokens < 1) {                               // over the rate limit: 429
          this.s.throttled++; d.set("throttle");
          d.go([[170, 244], [24, 244]], 200, (x) => x.fadeOut());
          return;
        }
        this.tokens -= 1; this.s.accepted++;
        const lane = this.pick();
        d.go([[300, 220], [370, 220], [370, lane.y], [404, lane.y]], 260, () => this.enqueue(lane, d));
      });
    }
    enqueue(l, d) { d.set("queued"); d.queued = true; l.queue.push(d); }
    updateLane(l, dt) {
      l.queue.forEach((d, i) => {                            // queued messages glide toward their slot
        const tx = i < 14 ? 588 - i * 13 : 412;
        d.x += (tx - d.x) * Math.min(1, dt * 6); d.y = l.y; d.place();
        d.el.classList.toggle("hide", i >= 14);
      });
      const more = this.svg.querySelector(`[data-more="${l.id}"]`);
      if (more) more.textContent = l.queue.length > 14 ? `+${l.queue.length - 14}` : "";
      for (let k = 0; k < l.slots.length; k++) {
        if (l.slots[k] || !l.queue.length) continue;
        const d = l.queue.shift(); d.queued = false; d.el.classList.remove("hide");
        l.slots[k] = d; d.set("proc");
        const wx = 658 + k * 26, dx = 802 + k * 30;
        d.go([[wx, l.y], [dx, l.y]], 300, () =>
          d.hold(l.svc * (0.7 + Math.random() * 0.6), () => this.finish(l, k, d, dx)));
      }
    }
    finish(l, k, d, dx) {
      l.slots[k] = null;
      if (Math.random() < l.fail) {
        d.attempts = (d.attempts || 0) + 1;
        if (d.attempts >= 3) {                               // maxReceiveCount reached: dead-letter
          this.s.dlq++; d.set("dlq");
          const idx = this.dlq.length;
          this.dlq.push(d);
          if (this.dlq.length > 14) { this.dlq.shift().fadeOut(); }
          const slot = Math.min(idx, 13);
          d.go([[dx, l.y + 26], [760, l.y + 26], [760, 416], [588 - slot * 13, 416]], 220, () => this.packDlq());
        } else {                                             // retry after visibility timeout
          this.s.retries++; d.set("retry");
          d.go([[922, l.y - 12], [922, l.y - 46], [560, l.y - 46], [560, l.y]], 170, () => this.enqueue(l, d));
        }
        return;
      }
      this.s.completed++; d.set("ok");
      d.go([[952, l.y]], 260, (x) => x.fadeOut());
    }
    packDlq() { this.dlq.forEach((d, i) => { if (!d.route) { d.x = 588 - i * 13; d.y = 416; d.place(); } }); }
    stats() {
      const q = this.lanes.map((l) => l.queue.length);
      return { arrived: this.s.arrived, accepted: this.s.accepted, throttled: this.s.throttled, completed: this.s.completed,
        retries: this.s.retries, dlq: this.s.dlq, qa: q[0], qb: q[1], qc: q[2] };
    }
  }

  /* 1M scene: many generators, routing to shards, parallel execution, cross-shard receipts */
  class Scene1M extends Scene {
    constructor(svg) {
      super(svg);
      this.shards = [];
      [350, 550].forEach((x0) => [40, 175, 310].forEach((y0) => this.shards.push({ x0, y0, busy: 0 })));
      this.reset();
    }
    reset() { this.clear(); this.acc = 0; this.s = { submitted: 0, cross: 0, finalized: 0 }; this.shards.forEach((s) => { s.busy = 0; }); }
    update(dt) {
      this.acc += 16 * dt;
      while (this.acc >= 1) { this.acc -= 1; if (this.dots.length < 190) this.spawn(); }
    }
    node(s) { return Math.random() < 0.5 ? [s.x0 + 50, s.y0 + 55] : [s.x0 + 120, s.y0 + 55]; }
    spawn() {
      this.s.submitted++;
      const s = this.shards[Math.floor(Math.random() * this.shards.length)];
      const d = this.add(new Dot(this.layer, 14, 205 + Math.random() * 30, 5, "req"));
      const entry = s.x0 === 350 ? [[335, 220], [335, s.y0 + 55]] : [[335, 220], [335, 24], [535, 24], [535, s.y0 + 55]];
      d.go([[160, 220], [275, 220], ...entry, this.node(s)], 340, () => this.execute(d, s, false));
    }
    execute(d, s, isReceipt) {
      s.busy++; d.set(isReceipt ? "receipt" : "proc");
      d.hold(isReceipt ? 0.35 : 0.5 + Math.random() * 0.4, () => {
        s.busy--;
        if (!isReceipt && Math.random() < 0.5) {            // cross-shard: receipt executes on the receiver's shard
          let t = s; while (t === s) t = this.shards[Math.floor(Math.random() * this.shards.length)];
          this.s.cross++; d.el.setAttribute("r", 4);
          const [x1, y1] = this.node(t), p = [];
          const cx = (d.x + x1) / 2 + (Math.random() < 0.5 ? 70 : -70), cy = (d.y + y1) / 2;
          for (let i = 1; i <= 10; i++) {
            const u = i / 10;
            p.push([(1 - u) ** 2 * d.x + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * d.y + 2 * (1 - u) * u * cy + u * u * y1]);
          }
          d.go(p, 260, () => this.execute(d, t, true));
          return;
        }
        d.go([[s.x0 + 85, s.y0 + 117], [795, s.y0 + 117], [795, 220]], 320, () => {
          d.set("ok"); this.s.finalized++;
          d.go([[930, 220]], 320, (x) => x.fadeOut());
        });
      });
    }
    stats() {
      const executing = this.shards.reduce((a, s) => a + s.busy, 0);
      return { submitted: this.s.submitted, executing, cross: this.s.cross, finalized: this.s.finalized,
        busyShards: this.shards.filter((s) => s.busy > 0).length };
    }
  }

  const anim = { scenes: {}, cur: "1k", playing: false, speed: 1, last: 0, visible: true, statT: 0 };
  const svg1k = $("#stage-1k"), svg1m = $("#stage-1m");
  if (svg1k && svg1m) {
    anim.scenes["1k"] = new Scene1K(svg1k);
    anim.scenes["1m"] = new Scene1M(svg1m);
    const prime = (sc) => { for (let i = 0; i < 300; i++) sc.tick(0.05); };   // a meaningful still frame
    Object.values(anim.scenes).forEach(prime);

    const playBtn = $("#anim-play");
    const setPlayUI = () => {
      playBtn.textContent = anim.playing ? "❚❚ Pause" : "▶ Play";
      playBtn.setAttribute("aria-label", anim.playing ? "Pause animation" : "Play animation");
    };
    anim.play = () => { if (anim.playing) return; anim.playing = true; anim.last = performance.now(); setPlayUI(); requestAnimationFrame(loop); };
    anim.pause = () => { anim.playing = false; setPlayUI(); };
    function loop(ts) {
      if (!anim.playing) return;
      const dt = Math.min(0.05, (ts - anim.last) / 1000) * anim.speed;
      anim.last = ts;
      if (anim.visible && !document.hidden) {
        anim.scenes[anim.cur].tick(dt);
        anim.statT += dt;
        if (anim.statT > 0.25) { anim.statT = 0; renderStats(); }
      }
      requestAnimationFrame(loop);
    }
    function renderStats() {
      const st = anim.scenes[anim.cur].stats();
      $$(`#stats-${anim.cur} [data-stat]`).forEach((el) => { el.textContent = fmt(st[el.dataset.stat]); });
    }
    playBtn.addEventListener("click", () => (anim.playing ? anim.pause() : anim.play()));
    $("#anim-reset").addEventListener("click", () => {
      anim.scenes[anim.cur].reset();
      if (!anim.playing) prime(anim.scenes[anim.cur]);
      renderStats();
    });
    $$("#anim-arch button").forEach((b) => b.addEventListener("click", () => {
      anim.cur = b.dataset.arch;
      $$("#anim-arch button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      svg1k.closest(".stage-wrap").hidden = anim.cur !== "1k";
      svg1m.closest(".stage-wrap").hidden = anim.cur !== "1m";
      $("#stats-1k").hidden = anim.cur !== "1k"; $("#stats-1m").hidden = anim.cur !== "1m";
      $$("[data-explain]").forEach((e) => { e.hidden = e.dataset.explain !== anim.cur; });
      renderStats();
    }));
    $$("#anim-speed button").forEach((b) => b.addEventListener("click", () => {
      anim.speed = parseFloat(b.dataset.speed);
      $$("#anim-speed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { anim.visible = es.some((e) => e.isIntersecting); }, { threshold: 0.05 })
        .observe($("#flow-stage"));
    }
    renderStats(); setPlayUI();
    if (!reduce) anim.play();
  } else {
    anim.pause = () => {};
  }
  applyMotion();

  /* ---------- 4. Throughput simulator ---------- */
  const NAMES = ["Legacy core (A)", "Corporate banking (B)", "Partner API (C)"];
  const sim = $("#sim");

  function readParams() {
    const v = (id) => parseFloat($("#" + id).value);
    return {
      tps: v("in-tps"), cap: [v("cap-a"), v("cap-b"), v("cap-c")], conc: v("conc"), ms: v("ms"),
      burst: v("burst"), q0: v("q0"), after: v("after"), mix: [v("mix-a"), v("mix-b"), v("mix-c")],
      timeout: v("timeout"), partitions: v("partitions"), shape: $("#shape").value,
      arch: parseInt($('input[name="sim-arch"]:checked').value, 10),
      part: [$("#part-a").checked, $("#part-b").checked, $("#part-c").checked],
    };
  }

  /* The model. Every formula is documented in the "Model and assumptions" block on the page. */
  function model(p) {
    const t = p.ms / 1000;                                    // average processing time (s)
    const W = p.conc / t;                                     // worker capacity (TPS) = concurrency / time
    const mSum = p.mix.reduce((a, b) => a + b, 0) || 1;
    const m = p.mix.map((x) => x / mSum);                     // traffic share per downstream
    const D = p.cap.map((c, i) => (p.arch === 4 && p.part[i] ? c * p.partitions : c));  // effective downstream capacity
    const serial = p.shape === "serial";
    const sync = p.arch === 1;

    // Lanes: each lane gets a share of arrivals and a completion capacity.
    let lanes = [];
    let concFactor = 1;                                       // sync only: concurrency exhaustion factor
    const util = [0, 0, 0];

    // Synchronous capacity depends on load (requests that wait for a slow system hold concurrency).
    const syncCaps = (lambda) => {
      if (serial) {
        const Ds = Math.min(...D);
        const c = Math.min(lambda, Ds), e = lambda - c;
        const demand = c * t + e * p.timeout;
        const f = demand > 0 ? Math.min(1, p.conc / demand) : 1;
        return { caps: [c * f], f };
      }
      const a = m.map((x) => lambda * x);
      const c = a.map((x, i) => Math.min(x, D[i]));
      const e = a.map((x, i) => x - c[i]);
      const demand = c.reduce((s, x) => s + x * t, 0) + e.reduce((s, x) => s + x * p.timeout, 0);
      const f = demand > 0 ? Math.min(1, p.conc / demand) : 1;
      return { caps: c.map((x) => x * f), f };
    };

    if (sync) {
      const burstCaps = syncCaps(p.tps), afterCaps = syncCaps(p.after);
      concFactor = burstCaps.f;
      lanes = (serial ? [1] : m).map((share, i) => ({
        label: serial ? "Serial chain A → B → C" : NAMES[i], share, sync: true,
        capBurst: burstCaps.caps[i], capAfter: afterCaps.caps[i], cap: burstCaps.caps[i],
      }));
      if (serial) D.forEach((d, i) => { util[i] = (p.tps * concFactor) / d; });
      else m.forEach((x, i) => { util[i] = (p.tps * x * concFactor) / D[i]; });
    } else if (serial) {
      const Ds = Math.min(...D);
      const R = Math.min(W, Ds);
      const limitBy = W < Ds ? "workers" : "downstream";
      lanes = [{ label: "Serial chain A → B → C", share: 1, cap: R, limitBy }];
      const backlog = p.tps > R || p.q0 > 0;
      D.forEach((d, i) => { util[i] = (p.arch === 2 && backlog ? W : Math.min(p.tps, R)) / d; });
      if (p.arch !== 2 && backlog) D.forEach((d, i) => { util[i] = R / d; });
    } else if (p.arch === 2) {
      // One shared queue + shared workers: work advances in mix proportion, so the branch with the
      // least capacity relative to its share gates everything (head-of-line blocking).
      const gate = Math.min(...D.map((d, i) => (m[i] > 0 ? d / m[i] : Infinity)));
      const R = Math.min(W, gate);
      lanes = [{ label: "Shared queue (all downstreams)", share: 1, cap: R, limitBy: W < gate ? "workers" : "downstream" }];
      const backlog = p.tps > R || p.q0 > 0;
      m.forEach((x, i) => { util[i] = ((backlog ? W : p.tps) * x) / D[i]; });   // unlimited workers hammer each system
    } else {
      // Per-downstream queues and worker limits. Concurrency is budgeted per downstream, demand first:
      // base_i = min(D_i, a_i) × t (shared in proportion if N is short); any remaining concurrency
      // goes to branches that can still use it to drain backlog, up to D_i × t.
      const base = D.map((d, i) => Math.min(d, p.tps * m[i]) * t);
      const baseSum = base.reduce((a, b) => a + b, 0);
      let conc;
      if (baseSum >= p.conc) conc = base.map((b) => (baseSum > 0 ? (p.conc * b) / baseSum : 0));
      else {
        const extra = D.map((d, i) => d * t - base[i]);
        const extraSum = extra.reduce((a, b) => a + b, 0);
        const spare = p.conc - baseSum;
        conc = base.map((b, i) => b + (extraSum > 0 ? Math.min(extra[i], (spare * extra[i]) / extraSum) : 0));
      }
      lanes = m.map((share, i) => {
        const Wi = conc[i] / t, cap = Math.min(D[i], Wi);
        return { label: NAMES[i], share, cap, Wi, limitBy: Wi < D[i] ? "workers" : "downstream" };
      });
      lanes.forEach((l, i) => {
        const a = p.tps * l.share, backlog = a > l.cap || p.q0 * l.share > 0;
        util[i] = (backlog ? l.cap : a) / D[i];
      });
    }

    // Per-lane steady state during the burst, queue depth at the end of the burst, drain time after it.
    let accepted = 0, completed = 0, rejected = 0, growth = 0, qEnd = 0, drain = 0;
    lanes.forEach((l) => {
      const a = p.tps * l.share, a2 = p.after * l.share;
      if (l.sync) {
        l.completed = Math.min(a, l.capBurst); l.rejected = a - l.completed;
        accepted += l.completed; completed += l.completed; rejected += l.rejected;
        l.q = 0; l.drain = 0;
        return;
      }
      const q0 = p.q0 * l.share;
      l.completed = a >= l.cap || q0 > 0 ? l.cap : a;
      l.growth = Math.max(0, a - l.cap);
      l.q = Math.max(0, q0 + (a - l.cap) * p.burst);
      l.drain = l.q > 0 ? (l.cap > a2 ? l.q / (l.cap - a2) : Infinity) : 0;
      accepted += a; completed += l.completed; growth += l.growth; qEnd += l.q;
      drain = Math.max(drain, l.drain);
    });

    // Time series for the charts.
    const T = p.burst;
    let H;
    if (sync) H = T + Math.max(T * 0.5, 20);
    else H = T + (Number.isFinite(drain) ? Math.min(Math.max(drain * 1.15, T * 0.3, 10), 3600) : Math.max(T, 60));
    const N = 240, dt = H / N;
    const series = { t: [], inc: [], done: [], q: [], H, T, truncated: Number.isFinite(drain) && drain * 1.15 > 3600 };
    const st = lanes.map((l) => ({ q: sync ? 0 : p.q0 * l.share }));
    for (let k = 0; k <= N; k++) {
      const time = k * dt, lam = time < T ? p.tps : p.after;
      let inc = 0, done = 0, q = 0;
      lanes.forEach((l, i) => {
        const a = lam * l.share;
        inc += a;
        if (l.sync) { done += Math.min(a, time < T ? l.capBurst : l.capAfter); return; }
        const d = Math.min(l.cap, a + st[i].q / dt);
        st[i].q = Math.max(0, st[i].q + (a - d) * dt);
        done += d; q += st[i].q;
      });
      series.t.push(time); series.inc.push(inc); series.done.push(done); series.q.push(q);
    }

    // Bottleneck diagnosis.
    const bn = { level: "ok", title: "", items: [] };
    const overloaded = util.map((u, i) => ({ u, i })).filter((x) => x.u > 1.0001);
    if (sync) {
      if (rejected > 0.5) {
        bn.level = "bad";
        bn.title = `Synchronous overload: about ${fmt(rejected)} TPS time out or are rejected`;
        if (concFactor < 0.999) bn.items.push(`Concurrency exhausted: requests waiting on overloaded systems hold workers for up to ${p.timeout} s, starving healthy branches (only ${fmt(concFactor * 100)}% of capacity usable).`);
        lanes.forEach((l, i) => { if (!serial && p.tps * l.share > D[i] + 0.5) bn.items.push(`${l.label} is overloaded: demand ${fmt(p.tps * l.share)} TPS vs sustainable ${fmt(D[i])} TPS.`); });
        if (serial) bn.items.push(`Serial chain is limited by the slowest system: ${fmt(Math.min(...D))} TPS.`);
        bn.items.push("Latency rises toward the timeout before requests fail. Callers see slow failures, not fast rejections, unless you shed load early (429/503).");
      } else if (Math.max(...util) > 0.8) {
        bn.level = "warn"; bn.title = "Near saturation: latency is rising";
        bn.items.push("Above ~80% utilization, queueing delay inside the downstream grows sharply. Keep headroom for bursts.");
      }
    } else if (growth > 0.5 || (p.q0 > 0 && qEnd > 0)) {
      const worst = lanes.reduce((a, l) => (l.growth > (a ? a.growth : -1) ? l : a), null);
      bn.level = Number.isFinite(drain) ? "warn" : "bad";
      const what = worst.limitBy === "workers" ? `worker capacity (${fmt(worst.Wi || W)} TPS)` : "downstream capacity";
      bn.title = `Bottleneck: ${worst.label}, limited by ${what}`;
      bn.items.push(`Backlog grows by ${fmt(growth)} msg/s during the burst; queue depth reaches ~${fmt(qEnd)} messages.`);
      bn.items.push(Number.isFinite(drain) ? `Drains in about ${dur(drain)} once arrivals drop to ${fmt(p.after)} TPS.` : `Never drains: arrivals after the burst (${fmt(p.after)} TPS) meet or exceed capacity. Add capacity or shed load.`);
    }
    if (!sync && p.arch === 2 && overloaded.length) {
      bn.level = "bad";
      bn.items.push(`Unbounded shared workers push ${overloaded.map((x) => `${NAMES[x.i]} to ${fmt(x.u * 100)}%`).join(", ")} of capacity: errors and retries waste work. Use per-downstream limits (option 3).`);
      if (!bn.title) bn.title = "Downstream overload: shared workers exceed what the system can absorb";
    }
    if (p.arch === 4 && p.part.some(Boolean)) bn.items.push("Partitioning only helps where the system and its data genuinely support parallel, independent processing.");
    if (!bn.title) {
      const heads = lanes.map((l) => (p.tps * l.share > 0 ? (l.sync ? l.capBurst : l.cap) / (p.tps * l.share) - 1 : Infinity));
      const head = Math.min(...heads), tight = lanes[heads.indexOf(head)];
      if (head < 0.2) {
        bn.level = "warn";
        bn.title = `At capacity: ${tight.label} runs at ${fmt(100 / (1 + head))}% with ${fmt(Math.max(0, head) * 100)}% headroom`;
        bn.items.push("Keeping up today, but any burst or slowdown on this path becomes backlog (async) or timeouts (sync). Plan 20–30% headroom.");
      } else {
        bn.title = `No bottleneck at this load: ${Number.isFinite(head) ? `${fmt(head * 100)}%` : "ample"} headroom on the tightest path`;
        if (Math.max(...util) > 0.8) { bn.level = "warn"; bn.items.push("A downstream runs above 80% utilization: little burst headroom."); }
      }
    }
    return { W, t, m, D, util, lanes, accepted, completed, rejected, growth, qEnd, drain, series, bn, sync, little: p.tps * t };
  }

  function chartLines(svg, s, sync) {
    const w = 360, h = 190, l = 46, r = 10, tp = 10, b = 26;
    const ymax = Math.max(...s.inc, ...s.done, 1) * 1.12;
    const X = (x) => l + (x / s.H) * (w - l - r), Y = (y) => tp + (1 - y / ymax) * (h - tp - b);
    let g = `<rect class="burst" x="${X(0)}" y="${tp}" width="${X(s.T) - X(0)}" height="${h - tp - b}"/>`;
    for (let i = 0; i <= 4; i++) {
      const yv = (ymax / 4) * i;
      g += `<line class="grid" x1="${l}" x2="${w - r}" y1="${Y(yv)}" y2="${Y(yv)}"/><text x="${l - 6}" y="${Y(yv) + 4}" text-anchor="end">${fmt(yv)}</text>`;
    }
    const pts = (arr) => arr.map((v, i) => `${X(s.t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    if (sync) {
      const top = s.inc.map((v, i) => `${X(s.t[i]).toFixed(1)},${Y(v).toFixed(1)}`);
      const bot = s.done.map((v, i) => `${X(s.t[i]).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
      g += `<polygon class="ln-rej" points="${top.concat(bot).join(" ")}"/>`;
    }
    g += `<polyline class="ln-in" points="${pts(s.inc)}"/><polyline class="ln-done" points="${pts(s.done)}"/>`;
    g += `<text x="${X(0)}" y="${h - 8}">0 s</text><text x="${X(s.T)}" y="${h - 8}" text-anchor="middle">burst ends ${fmt(s.T)} s</text><text x="${w - r}" y="${h - 8}" text-anchor="end">${fmt(s.H)} s</text>`;
    svg.innerHTML = g;
  }
  function chartQueue(svg, s, sync) {
    const w = 360, h = 190, l = 52, r = 10, tp = 10, b = 26;
    if (sync) {
      svg.innerHTML = `<text x="${w / 2}" y="${h / 2 - 6}" text-anchor="middle">No queue: synchronous calls can't buffer.</text><text x="${w / 2}" y="${h / 2 + 12}" text-anchor="middle">Excess demand becomes latency, timeouts and rejections.</text>`;
      return;
    }
    const ymax = Math.max(...s.q, 1) * 1.12;
    const X = (x) => l + (x / s.H) * (w - l - r), Y = (y) => tp + (1 - y / ymax) * (h - tp - b);
    let g = `<rect class="burst" x="${X(0)}" y="${tp}" width="${X(s.T) - X(0)}" height="${h - tp - b}"/>`;
    for (let i = 0; i <= 4; i++) {
      const yv = (ymax / 4) * i;
      g += `<line class="grid" x1="${l}" x2="${w - r}" y1="${Y(yv)}" y2="${Y(yv)}"/><text x="${l - 6}" y="${Y(yv) + 4}" text-anchor="end">${fmt(yv)}</text>`;
    }
    const pts = s.q.map((v, i) => `${X(s.t[i]).toFixed(1)},${Y(v).toFixed(1)}`);
    g += `<polygon class="area-q" points="${X(0)},${Y(0)} ${pts.join(" ")} ${X(s.H)},${Y(0)}"/>`;
    g += `<text x="${X(0)}" y="${h - 8}">0 s</text><text x="${w - r}" y="${h - 8}" text-anchor="end">${fmt(s.H)} s${s.truncated ? " (truncated)" : ""}</text>`;
    svg.innerHTML = g;
  }
  function chartUtil(svg, util, D) {
    const w = 360, h = 190, l = 46, r = 10, tp = 12, b = 30;
    const ymax = Math.min(3, Math.max(1.2, Math.max(...util) * 1.1));
    const Y = (y) => tp + (1 - Math.min(y, ymax) / ymax) * (h - tp - b);
    let g = "";
    for (let i = 0; i <= 3; i++) {
      const yv = (ymax / 3) * i;
      g += `<line class="grid" x1="${l}" x2="${w - r}" y1="${Y(yv)}" y2="${Y(yv)}"/><text x="${l - 6}" y="${Y(yv) + 4}" text-anchor="end">${fmt(yv * 100)}%</text>`;
    }
    g += `<line class="limit" x1="${l}" x2="${w - r}" y1="${Y(1)}" y2="${Y(1)}"/>`;
    const bw = (w - l - r) / 3;
    util.forEach((u, i) => {
      const cls = u > 1.0001 ? "bar-bad" : u > 0.8 ? "bar-warn" : "bar-ok";
      const x = l + i * bw + bw * 0.22, y = Y(u);
      g += `<rect class="${cls}" x="${x}" y="${y}" width="${bw * 0.56}" height="${Math.max(0, Y(0) - y)}" rx="3"/>`;
      g += `<text x="${x + bw * 0.28}" y="${Math.max(y - 4, tp + 9)}" text-anchor="middle">${u >= 3 ? "≥300" : fmt(u * 100)}%</text>`;
      g += `<text x="${x + bw * 0.28}" y="${h - 14}" text-anchor="middle">${["A · core", "B · banking", "C · partner"][i]}</text>`;
      g += `<text x="${x + bw * 0.28}" y="${h - 2}" text-anchor="middle">${fmt(D[i])} TPS</text>`;
    });
    svg.innerHTML = g;
  }

  function renderSim() {
    const p = readParams();
    $$("#sim [data-out]").forEach((o) => {
      const inp = $("#" + o.dataset.out);
      o.textContent = fmt(parseFloat(inp.value)) + (o.dataset.unit || "");
    });
    $("#partition-row").hidden = p.arch !== 4;
    const r = model(p);
    const set = (id, val, cls) => { const el = $("#" + id); el.textContent = val; if (cls !== undefined) el.closest(".kpi").className = "kpi " + cls; };
    set("o-in", fmt(p.tps));
    set("o-acc", fmt(r.accepted), r.accepted + 0.5 < p.tps ? "warn" : "");
    set("o-done", fmt(r.completed), r.completed + 0.5 < p.tps ? "warn" : "good");
    set("o-rej", r.sync ? fmt(r.rejected) : "0", r.sync && r.rejected > 0.5 ? "bad" : "");
    set("o-growth", r.sync ? "n/a" : fmt(r.growth), !r.sync && r.growth > 0.5 ? "warn" : "");
    set("o-q", r.sync ? "n/a" : fmt(r.qEnd), !r.sync && r.qEnd > 0 ? "warn" : "");
    set("o-drain", r.sync ? "n/a" : (r.qEnd > 0 ? dur(r.drain) : "0 s"), !r.sync && !Number.isFinite(r.drain) ? "bad" : "");
    set("o-w", fmt(r.W));
    set("o-little", fmt(r.little));
    const bn = $("#bottleneck");
    bn.className = "bottleneck " + r.bn.level;
    bn.innerHTML = `<b>${r.bn.title}</b>${r.bn.items.length ? `<ul>${r.bn.items.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}`;
    chartLines($("#chart-rate"), r.series, r.sync);
    chartQueue($("#chart-queue"), r.series, r.sync);
    chartUtil($("#chart-util"), r.util, r.D);
    // Bind the executive metric cards to the simulator settings.
    const mb = $("#m-burst"); if (mb) mb.textContent = `${fmt(p.tps)} TPS × ${fmt(p.burst)} s`;
    const md = $("#m-down"); if (md) md.textContent = `${fmt(p.cap[0])} · ${fmt(p.cap[1])} · ${fmt(p.cap[2])}`;
  }

  const PRESETS = {
    healthy: { "in-tps": 1000, "cap-a": 1200, "cap-b": 1500, "cap-c": 800, conc: 300, ms: 150, burst: 60, q0: 0, after: 600, arch: 3 },
    legacy: { "in-tps": 1000, "cap-a": 300, "cap-b": 600, "cap-c": 200, conc: 250, ms: 200, burst: 60, q0: 0, after: 300, arch: 3 },
    shared: { "in-tps": 1000, "cap-a": 300, "cap-b": 600, "cap-c": 200, conc: 250, ms: 200, burst: 60, q0: 0, after: 300, arch: 2 },
    sync: { "in-tps": 1000, "cap-a": 300, "cap-b": 600, "cap-c": 200, conc: 250, ms: 200, burst: 60, q0: 0, after: 300, arch: 1 },
    spike: { "in-tps": 3000, "cap-a": 1200, "cap-b": 1500, "cap-c": 800, conc: 400, ms: 150, burst: 30, q0: 5000, after: 500, arch: 3 },
  };
  if (sim) {
    $$("#sim input, #sim select").forEach((el) => el.addEventListener("input", renderSim));
    $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      const pr = PRESETS[b.dataset.preset];
      Object.entries(pr).forEach(([k, v]) => {
        if (k === "arch") { const r = $(`input[name="sim-arch"][value="${v}"]`); if (r) r.checked = true; }
        else $("#" + k).value = v;
      });
      renderSim();
    }));
    renderSim();
  }

  /* ---------- Pattern filter ---------- */
  $$("#pattern-filter button").forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.filter;
    $$("#pattern-filter button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $$(".pattern").forEach((c) => { c.hidden = f !== "all" && !c.dataset.tags.split(" ").includes(f); });
  }));
  $$("[data-expand]").forEach((b) => b.addEventListener("click", () => {
    const open = b.dataset.expand === "open";
    $$(".pattern").forEach((c) => { if (!c.hidden) c.open = open; });
  }));
})();
