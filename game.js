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

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#8fbf72");
    g.addColorStop(0.5, "#6fa85a");
    g.addColorStop(1, "#5a9448");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }

    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(30,22,16,0.22)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    const border = Math.max(2, cell * 0.08);
    ctx.strokeStyle = "#3d2b1f";
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, w - border, h - border);
  }

  /**
   * Original cannabis / medical-marijuana style leaf:
   * odd number of leaflets, serrated edges, center stem — canvas only.
   */
  function drawLeaf(cx, cy, size, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const leafletCount = 7;
    const spreads = [-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05];
    const lenScale = [0.55, 0.72, 0.88, 1.0, 0.88, 0.72, 0.55];
    const widthScale = [0.38, 0.42, 0.48, 0.52, 0.48, 0.42, 0.38];

    // Soft glow so it pops on the field
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(80, 160, 60, 0.2)";
    ctx.fill();

    for (let i = 0; i < leafletCount; i++) {
      drawLeaflet(
        spreads[i],
        size * 0.92 * lenScale[i],
        size * 0.28 * widthScale[i],
        i === 3
      );
    }

    // Petiole / center stem down into the cell
    ctx.beginPath();
    ctx.moveTo(0, size * 0.02);
    ctx.quadraticCurveTo(size * 0.04, size * 0.28, 0, size * 0.42);
    ctx.strokeStyle = "#2a5c22";
    ctx.lineWidth = Math.max(1.2, size * 0.07);
    ctx.lineCap = "round";
    ctx.stroke();

    // Small bud node at leaflet junction
    ctx.beginPath();
    ctx.arc(0, size * 0.02, size * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "#3d7a32";
    ctx.fill();

    ctx.restore();
  }

  function drawLeaflet(spreadAngle, length, halfW, isCenter) {
    ctx.save();
    ctx.rotate(spreadAngle);

    const teeth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);

    // Right serrated edge (base → tip, tip is -Y)
    for (let t = 1; t <= teeth; t++) {
      const u0 = (t - 1) / teeth;
      const u1 = t / teeth;
      const uMid = (u0 + u1) / 2;
      const env = (u) => {
        // Widest ~30% from base, taper to sharp tip
        const peak = 0.3;
        const w =
          u <= peak
            ? halfW * (0.15 + 0.85 * (u / peak))
            : halfW * Math.max(0.02, 1 - ((u - peak) / (1 - peak)));
        return w;
      };
      const yMid = -length * uMid;
      const y1 = -length * u1;
      // Tooth peak then notch
      ctx.lineTo(env(uMid) * 1.22, yMid);
      ctx.lineTo(env(u1) * 0.72, y1);
    }
    ctx.lineTo(0, -length); // tip

    // Left serrated edge (tip → base)
    for (let t = teeth; t >= 1; t--) {
      const u0 = t / teeth;
      const u1 = (t - 1) / teeth;
      const uMid = (u0 + u1) / 2;
      const env = (u) => {
        const peak = 0.3;
        const w =
          u <= peak
            ? halfW * (0.15 + 0.85 * (u / peak))
            : halfW * Math.max(0.02, 1 - ((u - peak) / (1 - peak)));
        return w;
      };
      const yMid = -length * uMid;
      const y1 = -length * u1;
      ctx.lineTo(-env(uMid) * 1.22, yMid);
      ctx.lineTo(-env(u1) * 0.72, y1);
    }
    ctx.closePath();

    const lg = ctx.createLinearGradient(-halfW, -length * 0.3, halfW, 0);
    if (isCenter) {
      lg.addColorStop(0, "#6ec45a");
      lg.addColorStop(0.45, "#3f9a32");
      lg.addColorStop(1, "#2a6e24");
    } else {
      lg.addColorStop(0, "#5bb34a");
      lg.addColorStop(0.5, "#348a2c");
      lg.addColorStop(1, "#246620");
    }
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 60, 18, 0.55)";
    ctx.lineWidth = Math.max(0.8, length * 0.025);
    ctx.stroke();

    // Center vein
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.06);
    ctx.lineTo(0, -length * 0.92);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = Math.max(0.8, length * 0.035);
    ctx.stroke();

    // Side veins
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = Math.max(0.6, length * 0.02);
    for (let v = 1; v <= 3; v++) {
      const uy = 0.2 + v * 0.18;
      const y = -length * uy;
      const reach = halfW * (0.55 - v * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(reach, y - length * 0.06);
      ctx.moveTo(0, y);
      ctx.lineTo(-reach, y - length * 0.06);
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
    const pad = cell * 0.06;
    const px = x * cell + pad;
    const py = y * cell + pad;
    const s = cell - pad * 2;
    const rad = cell * 0.18;

    // Bridge toward next segment so the coil reads as one connected snake
    if (index < snake.length - 1) {
      const n = snake[index + 1];
      const dx = n.x - x;
      const dy = n.y - y;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const bridgeW = dx !== 0 ? cell - pad * 2 : s * 0.72;
        const bridgeH = dy !== 0 ? cell - pad * 2 : s * 0.72;
        const ox = dx !== 0 ? Math.min(x, n.x) * cell + pad : px + (s - bridgeW) / 2;
        const oy = dy !== 0 ? Math.min(y, n.y) * cell + pad : py + (s - bridgeH) / 2;
        roundRectPath(ox, oy, bridgeW, bridgeH, rad * 0.6);
        ctx.fillStyle = index === 0 ? "#d4b878" : "#c9a868";
        ctx.fill();
      }
    }

    const paper = ctx.createLinearGradient(px, py, px + s, py + s);
    if (isHead) {
      paper.addColorStop(0, "#f5e6c8");
      paper.addColorStop(0.55, "#d4b878");
      paper.addColorStop(1, "#a88848");
    } else {
      paper.addColorStop(0, "#efe0b8");
      paper.addColorStop(0.5, "#c9a868");
      paper.addColorStop(1, "#8f7040");
    }

    roundRectPath(px, py, s, s, rad);
    ctx.fillStyle = paper;
    ctx.fill();

    // Paper wrap lines
    ctx.save();
    ctx.beginPath();
    roundRectPath(px, py, s, s, rad);
    ctx.clip();
    ctx.strokeStyle = "rgba(80,55,25,0.28)";
    ctx.lineWidth = Math.max(1, cell * 0.04);
    for (let a = 0.2; a < 0.9; a += 0.28) {
      ctx.beginPath();
      ctx.moveTo(px + s * 0.1, py + s * a);
      ctx.quadraticCurveTo(px + s * 0.5, py + s * a + s * 0.08, px + s * 0.9, py + s * a);
      ctx.stroke();
    }
    ctx.restore();

    roundRectPath(px, py, s, s, rad);
    ctx.strokeStyle = "rgba(60,40,15,0.55)";
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.stroke();

    if (isHead) {
      const cx = px + s / 2;
      const cy = py + s / 2;
      const d = DIRS[dir];
      const tipX = cx + d.x * s * 0.38;
      const tipY = cy + d.y * s * 0.38;
      const glow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, s * 0.4);
      glow.addColorStop(0, "rgba(255,160,60,0.85)");
      glow.addColorStop(0.4, "rgba(220,80,30,0.45)");
      glow.addColorStop(1, "rgba(180,40,10,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tipX, tipY, s * 0.4, 0, Math.PI * 2);
      ctx.fill();

      const eyeOff = cell * 0.12;
      const eyeR = Math.max(1.5, cell * 0.07);
      const ex = -d.y * eyeOff;
      const ey = d.x * eyeOff;
      const fx = cx + d.x * cell * 0.06;
      const fy = cy + d.y * cell * 0.06;

      ctx.fillStyle = "#1e1610";
      ctx.beginPath();
      ctx.arc(fx + ex, fy + ey, eyeR, 0, Math.PI * 2);
      ctx.arc(fx - ex, fy - ey, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(fx + ex - eyeR * 0.3, fy + ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
      ctx.arc(fx - ex - eyeR * 0.3, fy - ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    drawField();

    if (food) {
      const fx = food.x * cell + cell / 2;
      const fy = food.y * cell + cell / 2;
      ctx.beginPath();
      ctx.ellipse(fx, fy + cell * 0.14, cell * 0.32, cell * 0.14, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,22,16,0.22)";
      ctx.fill();
      // Slightly larger so the multi-leaflet silhouette reads on the grid
      drawLeaf(fx, fy - cell * 0.02, cell * 0.72, leafAngle);
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
      "Classic Snake: eat the leaves, grow the coil, don’t hit the fence or yourself.",
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
