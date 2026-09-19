/**
 * Farm Coil — classic Snake on a grid with original farm / cannabis-leaf aesthetic.
 */
(function () {
  "use strict";

  const COLS = 20;
  const ROWS = 20;
  const STORAGE_KEY = "farmCoilHighScore";
  const BASE_MS = 140;
  const MIN_MS = 70;
  const SPEED_STEP = 3; // ms faster per leaf eaten (length beyond start)
  const SCORE_PER_FOOD = 10;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high-score");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const overlayHint = document.getElementById("overlay-hint");
  const overlayEyebrow = document.getElementById("overlay-eyebrow");

  let cell = canvas.width / COLS;
  let state = "start"; // start | playing | paused | dead
  let snake = [];
  let dir = "right";
  let nextDir = "right";
  let food = null;
  let score = 0;
  let highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let lastTick = 0;
  let accum = 0;
  let raf = null;
  let leafAngle = 0;
  const deathLines = [
    "Coil crumpled. Back to the barn?",
    "Oof — fence 1, coil 0.",
    "That leaf wasn’t worth it.",
    "You grew too bold. Respect the rows.",
    "Splat. The fields remember.",
    "Nice try, field hand. Try again?",
  ];

  highEl.textContent = String(highScore);

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    cell = canvas.width / COLS;
  }

  function resetGame() {
    const midY = Math.floor(ROWS / 2);
    // Head + 2 body segments — classic starting length of 3
    snake = [
      { x: 6, y: midY },
      { x: 5, y: midY },
      { x: 4, y: midY },
    ];
    dir = "right";
    nextDir = "right";
    score = 0;
    scoreEl.textContent = "0";
    placeFood();
  }

  function placeFood() {
    const occupied = new Set(snake.map((s) => s.x + "," + s.y));
    const empty = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(x + "," + y)) empty.push({ x, y });
      }
    }
    if (empty.length === 0) {
      food = null;
      return;
    }
    food = empty[Math.floor(Math.random() * empty.length)];
  }

  function tickInterval() {
    const grown = Math.max(0, snake.length - 3);
    return Math.max(MIN_MS, BASE_MS - grown * SPEED_STEP);
  }

  function showOverlay(eyebrow, title, msg, hint) {
    overlayEyebrow.textContent = eyebrow;
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlayHint.innerHTML = hint;
    overlay.classList.remove("hidden");
    const card = document.getElementById("overlay-card");
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function startPlaying() {
    if (state === "playing") return;
    if (state === "dead" || state === "start") resetGame();
    state = "playing";
    hideOverlay();
    FarmCoilAudio.resume();
    FarmCoilAudio.startLoop();
    lastTick = performance.now();
    accum = 0;
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    FarmCoilAudio.stopLoop();
    FarmCoilAudio.click();
    showOverlay(
      "Take a breath",
      "Paused",
      "The coil waits in the rows.",
      "Press <kbd>P</kbd> / <kbd>Esc</kbd> or <kbd>Enter</kbd> / <kbd>Space</kbd> to resume"
    );
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    hideOverlay();
    FarmCoilAudio.startLoop();
    lastTick = performance.now();
    accum = 0;
  }

  function die() {
    state = "dead";
    FarmCoilAudio.stopLoop();
    FarmCoilAudio.death();
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_KEY, String(highScore));
      highEl.textContent = String(highScore);
    }
    const line = deathLines[Math.floor(Math.random() * deathLines.length)];
    showOverlay(
      "Game over",
      "Coil down!",
      line + (score > 0 ? " Score: " + score + "." : ""),
      "Press <kbd>Enter</kbd> / <kbd>Space</kbd> or <kbd>R</kbd> to restart"
    );
  }

  /**
   * Classic Snake: cannot reverse into yourself in one tick.
   * Compare against the direction that will be used this tick (nextDir once set,
   * else committed dir) so opposite presses never 180° you into your neck.
   */
  function setDirection(name) {
    if (!DIRS[name]) return;
    if (state !== "playing") {
      nextDir = name;
      return;
    }
    const against = nextDir;
    if (OPPOSITE[against] === name) return;
    if (OPPOSITE[dir] === name) return;
    nextDir = name;
  }

  function step() {
    dir = nextDir;
    const head = snake[0];
    const d = DIRS[dir];
    const nx = head.x + d.x;
    const ny = head.y + d.y;

    // Classic: die on walls (no wrap)
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      die();
      return;
    }

    const willGrow = food && nx === food.x && ny === food.y;
    // Self collision — tail cell is free unless we grow this tick
    const checkLen = snake.length - (willGrow ? 0 : 1);
    for (let i = 0; i < checkLen; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        die();
        return;
      }
    }

    snake.unshift({ x: nx, y: ny });
    if (willGrow) {
      score += SCORE_PER_FOOD;
      scoreEl.textContent = String(score);
      FarmCoilAudio.eat();
      placeFood();
    } else {
      snake.pop();
    }
  }

  /* ——— Drawing ——— */

  function drawField() {
    const w = canvas.width;
    const h = canvas.height;

    // Deeper, muted field so bright lime food reads clearly (not camouflaged)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#5a7a48");
    g.addColorStop(0.5, "#4a6a3c");
    g.addColorStop(1, "#3d5a32");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(20, 30, 14, 0.18)";
          ctx.fillRect(x * cell, y * cell, cell, cell);
        } else {
          ctx.fillStyle = "rgba(255, 255, 220, 0.04)";
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }

    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(20,14,10,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    const border = Math.max(2, cell * 0.08);
    ctx.strokeStyle = "#2a1c14";
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, w - border, h - border);
  }

  /**
   * Cannabis leaf food — almost full cell, bright lime on muted field.
   * Seven serrated leaflets, dark outline, pale veins, soft glow.
   */
  function drawLeaf(cx, cy, size, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Soft outer glow / shadow so it pops on the green field
    ctx.beginPath();
    ctx.arc(0, size * 0.05, size * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, size * 0.68, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.7);
    glow.addColorStop(0, "rgba(180, 255, 80, 0.45)");
    glow.addColorStop(0.55, "rgba(100, 220, 60, 0.22)");
    glow.addColorStop(1, "rgba(80, 200, 40, 0)");
    ctx.fillStyle = glow;
    ctx.fill();

    const spreads = [-1.12, -0.74, -0.37, 0, 0.37, 0.74, 1.12];
    const lenScale = [0.58, 0.76, 0.92, 1.05, 0.92, 0.76, 0.58];
    const widthScale = [0.42, 0.48, 0.54, 0.58, 0.54, 0.48, 0.42];

    for (let i = 0; i < 7; i++) {
      drawLeaflet(
        spreads[i],
        size * lenScale[i],
        size * 0.34 * widthScale[i],
        i === 3
      );
    }

    // Petiole
    ctx.beginPath();
    ctx.moveTo(0, size * 0.04);
    ctx.quadraticCurveTo(size * 0.05, size * 0.32, 0, size * 0.48);
    ctx.strokeStyle = "#0d3a12";
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.lineCap = "round";
    ctx.stroke();

    // Bud node
    ctx.beginPath();
    ctx.arc(0, size * 0.02, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = "#1a5c20";
    ctx.fill();
    ctx.strokeStyle = "#06240a";
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.stroke();

    ctx.restore();
  }

  function drawLeaflet(spreadAngle, length, halfW, isCenter) {
    ctx.save();
    ctx.rotate(spreadAngle);

    const teeth = 7;
    function env(u) {
      const peak = 0.28;
      if (u <= peak) return halfW * (0.12 + 0.88 * (u / peak));
      return halfW * Math.max(0.015, 1 - ((u - peak) / (1 - peak)) * 0.98);
    }

    ctx.beginPath();
    ctx.moveTo(0, length * 0.02);

    for (let t = 1; t <= teeth; t++) {
      const u0 = (t - 1) / teeth;
      const u1 = t / teeth;
      const uMid = (u0 + u1) / 2;
      ctx.lineTo(env(uMid) * 1.35, -length * uMid);
      ctx.lineTo(env(u1) * 0.62, -length * u1);
    }
    ctx.lineTo(0, -length);

    for (let t = teeth; t >= 1; t--) {
      const u0 = t / teeth;
      const u1 = (t - 1) / teeth;
      const uMid = (u0 + u1) / 2;
      ctx.lineTo(-env(uMid) * 1.35, -length * uMid);
      ctx.lineTo(-env(u1) * 0.62, -length * u1);
    }
    ctx.closePath();

    // Bright lime / emerald fill — high contrast vs muted field
    const lg = ctx.createLinearGradient(-halfW, -length * 0.4, halfW * 0.6, length * 0.1);
    if (isCenter) {
      lg.addColorStop(0, "#d4ff4a");
      lg.addColorStop(0.35, "#7CFC00");
      lg.addColorStop(0.7, "#32CD32");
      lg.addColorStop(1, "#228B22");
    } else {
      lg.addColorStop(0, "#b8ff40");
      lg.addColorStop(0.4, "#66EE22");
      lg.addColorStop(0.75, "#2EAA28");
      lg.addColorStop(1, "#1a7a1e");
    }
    ctx.fillStyle = lg;
    ctx.fill();

    // Dark outline — makes silhouette scream at a glance
    ctx.strokeStyle = "#06240a";
    ctx.lineWidth = Math.max(1.8, length * 0.055);
    ctx.lineJoin = "round";
    ctx.stroke();

    // Lighter veins
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.04);
    ctx.lineTo(0, -length * 0.9);
    ctx.strokeStyle = "rgba(255, 255, 210, 0.75)";
    ctx.lineWidth = Math.max(1.2, length * 0.045);
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 220, 0.45)";
    ctx.lineWidth = Math.max(0.8, length * 0.028);
    for (let v = 1; v <= 4; v++) {
      const uy = 0.16 + v * 0.16;
      const y = -length * uy;
      const reach = halfW * (0.7 - v * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(reach, y - length * 0.07);
      ctx.moveTo(0, y);
      ctx.lineTo(-reach, y - length * 0.07);
      ctx.stroke();
    }

    ctx.restore();
  }

  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /**
   * Classic grid snake: filled cell-sized rounded blocks, lightly connected.
   * Farm "rolled paper" coloring kept for theme.
   */
  function drawJointSegment(x, y, index, isHead) {
    // Fill almost the whole cell — classic chunky snake
    const pad = cell * 0.04;
    const px = x * cell + pad;
    const py = y * cell + pad;
    const s = cell - pad * 2;
    const rad = cell * 0.22;

    // Bridge toward next segment so the coil reads as one connected snake
    if (index < snake.length - 1) {
      const n = snake[index + 1];
      const dx = n.x - x;
      const dy = n.y - y;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const bridgeW = dx !== 0 ? cell - pad * 2 : s * 0.78;
        const bridgeH = dy !== 0 ? cell - pad * 2 : s * 0.78;
        const ox = dx !== 0 ? Math.min(x, n.x) * cell + pad : px + (s - bridgeW) / 2;
        const oy = dy !== 0 ? Math.min(y, n.y) * cell + pad : py + (s - bridgeH) / 2;
        roundRectPath(ox, oy, bridgeW, bridgeH, rad * 0.5);
        ctx.fillStyle = isHead ? "#e8c878" : "#d4b060";
        ctx.fill();
      }
    }

    const paper = ctx.createLinearGradient(px, py, px + s, py + s);
    if (isHead) {
      paper.addColorStop(0, "#fff4d4");
      paper.addColorStop(0.4, "#e8c878");
      paper.addColorStop(0.75, "#c9a040");
      paper.addColorStop(1, "#8a6028");
    } else {
      const t = Math.min(1, index / 8);
      paper.addColorStop(0, "#f0e0b0");
      paper.addColorStop(0.45, "#d4b060");
      paper.addColorStop(1, t > 0.5 ? "#7a5830" : "#9a7040");
    }

    roundRectPath(px, py, s, s, rad);
    ctx.fillStyle = paper;
    ctx.fill();

    // Soft drop shadow under segment for depth
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.restore();

    // Paper wrap lines
    ctx.save();
    ctx.beginPath();
    roundRectPath(px, py, s, s, rad);
    ctx.clip();
    ctx.strokeStyle = "rgba(60,40,15,0.35)";
    ctx.lineWidth = Math.max(1.2, cell * 0.045);
    for (let a = 0.18; a < 0.92; a += 0.26) {
      ctx.beginPath();
      ctx.moveTo(px + s * 0.08, py + s * a);
      ctx.quadraticCurveTo(px + s * 0.5, py + s * a + s * 0.07, px + s * 0.92, py + s * a);
      ctx.stroke();
    }
    ctx.restore();

    roundRectPath(px, py, s, s, rad);
    ctx.strokeStyle = isHead ? "rgba(40,25,8,0.75)" : "rgba(50,35,12,0.6)";
    ctx.lineWidth = Math.max(1.5, cell * 0.055);
    ctx.stroke();

    if (isHead) {
      const hx = px + s / 2;
      const hy = py + s / 2;
      const d = DIRS[dir];
      const tipX = hx + d.x * s * 0.4;
      const tipY = hy + d.y * s * 0.4;

      // Ember tip glow
      const glow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, s * 0.48);
      glow.addColorStop(0, "rgba(255,220,80,0.95)");
      glow.addColorStop(0.25, "rgba(255,120,30,0.9)");
      glow.addColorStop(0.55, "rgba(220,50,10,0.5)");
      glow.addColorStop(1, "rgba(180,40,10,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tipX, tipY, s * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Solid ember core
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(2, s * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = "#ffee88";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(1.5, s * 0.07), 0, Math.PI * 2);
      ctx.fillStyle = "#ff6622";
      ctx.fill();

      // Eyes — big and readable
      const eyeOff = cell * 0.16;
      const eyeR = Math.max(2.2, cell * 0.1);
      const ex = -d.y * eyeOff;
      const ey = d.x * eyeOff;
      const fx = hx + d.x * cell * 0.04;
      const fy = hy + d.y * cell * 0.04;

      ctx.fillStyle = "#fffef5";
      ctx.beginPath();
      ctx.arc(fx + ex, fy + ey, eyeR * 1.15, 0, Math.PI * 2);
      ctx.arc(fx - ex, fy - ey, eyeR * 1.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1a1008";
      ctx.beginPath();
      ctx.arc(fx + ex + d.x * eyeR * 0.25, fy + ey + d.y * eyeR * 0.25, eyeR * 0.62, 0, Math.PI * 2);
      ctx.arc(fx - ex + d.x * eyeR * 0.25, fy - ey + d.y * eyeR * 0.25, eyeR * 0.62, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(fx + ex - eyeR * 0.35, fy + ey - eyeR * 0.35, eyeR * 0.28, 0, Math.PI * 2);
      ctx.arc(fx - ex - eyeR * 0.35, fy - ey - eyeR * 0.35, eyeR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    drawField();

    if (food) {
      const fx = food.x * cell + cell / 2;
      const fy = food.y * cell + cell / 2;
      // Ground shadow under leaf
      ctx.beginPath();
      ctx.ellipse(fx, fy + cell * 0.28, cell * 0.42, cell * 0.16, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 8, 4, 0.4)";
      ctx.fill();
      // Almost full cell — leaf must scream at a glance
      drawLeaf(fx, fy - cell * 0.02, cell * 0.95, leafAngle);
    }

    for (let i = snake.length - 1; i >= 0; i--) {
      drawJointSegment(snake[i].x, snake[i].y, i, i === 0);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    leafAngle += 0.018;

    if (state === "playing") {
      const dt = now - lastTick;
      lastTick = now;
      // Clamp huge frame gaps (tab switch) so we don't multi-step through walls
      accum += Math.min(dt, tickInterval() * 3);
      const interval = tickInterval();
      while (accum >= interval) {
        accum -= interval;
        step();
        if (state !== "playing") break;
      }
    }

    draw();
  }

  /* ——— Input —— */

  function onKey(e) {
    const k = e.key;
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right",
    };

    if (map[k]) {
      e.preventDefault();
      if (state === "start" || state === "dead") {
        startPlaying();
        setDirection(map[k]);
      } else if (state === "paused") {
        resumeGame();
        setDirection(map[k]);
      } else {
        setDirection(map[k]);
      }
      return;
    }

    if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (state === "start" || state === "dead") startPlaying();
      else if (state === "paused") resumeGame();
      return;
    }

    if (k === "p" || k === "P" || k === "Escape") {
      e.preventDefault();
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      return;
    }

    if (k === "r" || k === "R") {
      e.preventDefault();
      FarmCoilAudio.stopLoop();
      resetGame();
      state = "start";
      showStart();
      return;
    }

    if (k === "m" || k === "M") {
      e.preventDefault();
      updateMuteBtn(FarmCoilAudio.toggleMute());
      return;
    }
  }

  function showStart() {
    showOverlay(
      "Welcome to the fields",
      "Farm Coil",
      "Eat the cannabis leaves. Grow. Don’t hit walls or yourself.",
      "Press <kbd>Enter</kbd> or <kbd>Space</kbd> to start · Arrows / WASD to move"
    );
  }

  function updateMuteBtn(muted) {
    const btn = document.getElementById("btn-mute");
    if (btn) btn.textContent = muted ? "Unmute" : "Mute";
  }

  document.getElementById("btn-pause").addEventListener("click", () => {
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
    else if (state === "start" || state === "dead") startPlaying();
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    FarmCoilAudio.click();
    FarmCoilAudio.stopLoop();
    resetGame();
    state = "start";
    showStart();
    draw();
  });

  document.getElementById("btn-mute").addEventListener("click", () => {
    updateMuteBtn(FarmCoilAudio.toggleMute());
  });

  document.getElementById("toggle-controls").addEventListener("click", () => {
    const body = document.getElementById("controls-body");
    const btn = document.getElementById("toggle-controls");
    const collapsed = body.classList.toggle("collapsed");
    btn.textContent = collapsed ? "Show" : "Hide";
    btn.setAttribute("aria-expanded", String(!collapsed));
  });

  document.querySelectorAll(".touch-btn").forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      const d = btn.getAttribute("data-dir");
      if (state === "start" || state === "dead") {
        startPlaying();
        setDirection(d);
      } else if (state === "paused") {
        resumeGame();
        setDirection(d);
      } else {
        setDirection(d);
      }
    };
    btn.addEventListener("pointerdown", fire);
  });

  overlay.addEventListener("click", (e) => {
    if (e.target.closest("kbd")) return;
    if (state === "start" || state === "dead") startPlaying();
    else if (state === "paused") resumeGame();
  });

  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", () => {
    resizeCanvas();
    draw();
  });

  // Boot
  resizeCanvas();
  resetGame();
  showStart();
  draw();
  raf = requestAnimationFrame(loop);
})();
