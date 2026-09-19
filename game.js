/**
 * Farm Coil — classic snake with original farm / leaf aesthetic.
 */
(function () {
  "use strict";

  const COLS = 20;
  const ROWS = 20;
  const STORAGE_KEY = "farmCoilHighScore";
  const BASE_MS = 140;
  const MIN_MS = 70;
  const SPEED_STEP = 3; // ms faster per leaf

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
  let deathLines = [
    "Coil crumpled. Back to the barn?",
    "Oof — fence 1, coil 0.",
    "That leaf wasn’t worth it.",
    "You grew too bold. Respect the rows.",
    "Splat. The fields remember.",
    "Nice try, field hand. Try again?",
  ];

  highEl.textContent = String(highScore);

  function resizeCanvas() {
    // Keep internal resolution crisp relative to display size
    const wrap = canvas.parentElement;
    const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    cell = canvas.width / COLS;
  }

  function resetGame() {
    const midY = Math.floor(ROWS / 2);
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
    let tries = 0;
    do {
      food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      tries++;
    } while (occupied.has(food.x + "," + food.y) && tries < 500);
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
    // re-trigger pop animation
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
      "Press <kbd>P</kbd> / <kbd>Esc</kbd> or <kbd>Enter</kbd> to resume"
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

  function setDirection(name) {
    if (!DIRS[name]) return;
    if (state === "playing" && OPPOSITE[dir] === name) return;
    nextDir = name;
  }

  function step() {
    dir = nextDir;
    const head = snake[0];
    const d = DIRS[dir];
    const nx = head.x + d.x;
    const ny = head.y + d.y;

    // Walls
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      die();
      return;
    }
    // Self — allow moving into the tail cell that will vacate (unless growing)
    const willGrow = food && nx === food.x && ny === food.y;
    for (let i = 0; i < snake.length - (willGrow ? 0 : 1); i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        die();
        return;
      }
    }

    snake.unshift({ x: nx, y: ny });
    if (willGrow) {
      score += 10;
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

    // Soft field gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#8fbf72");
    g.addColorStop(0.5, "#6fa85a");
    g.addColorStop(1, "#5a9448");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Checker / crop rows
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }

    // Soft vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(30,22,16,0.22)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // Fence border
    const border = Math.max(2, cell * 0.08);
    ctx.strokeStyle = "#3d2b1f";
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, w - border, h - border);
  }

  function drawLeaf(cx, cy, size, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Leaf body
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.bezierCurveTo(size * 0.55, -size * 0.25, size * 0.5, size * 0.35, 0, size * 0.55);
    ctx.bezierCurveTo(-size * 0.5, size * 0.35, -size * 0.55, -size * 0.25, 0, -size * 0.55);
    ctx.closePath();

    const lg = ctx.createLinearGradient(-size * 0.3, -size * 0.3, size * 0.3, size * 0.3);
    lg.addColorStop(0, "#7ec96a");
    lg.addColorStop(1, "#3d8a30");
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = "rgba(30,80,20,0.45)";
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();

    // Vein
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.4);
    ctx.lineTo(0, size * 0.4);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.stroke();

    ctx.restore();
  }

  function drawJointSegment(x, y, index, isHead) {
    const px = x * cell + cell / 2;
    const py = y * cell + cell / 2;
    const r = cell * 0.38;

    ctx.save();
    ctx.translate(px, py);

    // Paper wrap body — warm cream / tan rolled look
    const paper = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    if (isHead) {
      paper.addColorStop(0, "#f5e6c8");
      paper.addColorStop(0.55, "#d4b878");
      paper.addColorStop(1, "#a88848");
    } else {
      const t = index / Math.max(1, snake.length);
      paper.addColorStop(0, "#efe0b8");
      paper.addColorStop(0.5, "#c9a868");
      paper.addColorStop(1, "#8f7040");
      // slight green tint toward tail tip
      if (t > 0.7) {
        // redraw tint overlay below
      }
    }

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = paper;
    ctx.fill();

    // Spiral paper wrap lines
    ctx.beginPath();
    ctx.strokeStyle = "rgba(80,55,25,0.28)";
    ctx.lineWidth = Math.max(1, cell * 0.04);
    for (let a = -0.8; a < 0.9; a += 0.45) {
      ctx.moveTo(-r * 0.7, a * r);
      ctx.quadraticCurveTo(0, a * r + r * 0.15, r * 0.7, a * r);
    }
    ctx.stroke();

    // Outline
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(60,40,15,0.55)";
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.stroke();

    if (isHead) {
      // Tiny ember tip glow at front
      const d = DIRS[dir];
      const tipX = d.x * r * 0.85;
      const tipY = d.y * r * 0.85;
      const glow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, r * 0.55);
      glow.addColorStop(0, "rgba(255,160,60,0.85)");
      glow.addColorStop(0.4, "rgba(220,80,30,0.45)");
      glow.addColorStop(1, "rgba(180,40,10,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tipX, tipY, r * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Chill little eyes
      const eyeOff = cell * 0.12;
      const eyeR = Math.max(1.5, cell * 0.07);
      const ex = -d.y * eyeOff;
      const ey = d.x * eyeOff;
      const fx = d.x * cell * 0.08;
      const fy = d.y * cell * 0.08;

      ctx.fillStyle = "#1e1610";
      ctx.beginPath();
      ctx.arc(fx + ex, fy + ey, eyeR, 0, Math.PI * 2);
      ctx.arc(fx - ex, fy - ey, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Eye shine
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(fx + ex - eyeR * 0.3, fy + ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
      ctx.arc(fx - ex - eyeR * 0.3, fy - ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function draw() {
    drawField();

    // Food leaf
    if (food) {
      const fx = food.x * cell + cell / 2;
      const fy = food.y * cell + cell / 2;
      // Soft shadow
      ctx.beginPath();
      ctx.ellipse(fx, fy + cell * 0.12, cell * 0.28, cell * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,22,16,0.2)";
      ctx.fill();
      drawLeaf(fx, fy, cell * 0.55, leafAngle);
    }

    // Snake — draw from tail so head is on top
    for (let i = snake.length - 1; i >= 0; i--) {
      drawJointSegment(snake[i].x, snake[i].y, i, i === 0);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    leafAngle += 0.02;

    if (state === "playing") {
      const dt = now - lastTick;
      lastTick = now;
      accum += dt;
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
      "Grow the coil. Grab the leaves. Stay chill.",
      "Press <kbd>Enter</kbd> or <kbd>Space</kbd> to start"
    );
  }

  function updateMuteBtn(muted) {
    const btn = document.getElementById("btn-mute");
    if (btn) btn.textContent = muted ? "Unmute" : "Mute";
  }

  // Buttons
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

  // Touch D-pad
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

  // Overlay click to start
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
