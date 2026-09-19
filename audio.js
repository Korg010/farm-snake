/**
 * Farm Coil — original Web Audio sounds (no external media).
 * Chiptune-ish field loop + silly descending death tones.
 */
(function (global) {
  "use strict";

  const AudioFX = {
    ctx: null,
    muted: false,
    loopNodes: null,
    loopPlaying: false,
    master: null,

    ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    },

    resume() {
      const ctx = this.ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },

    setMuted(m) {
      this.muted = !!m;
      if (this.master) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime, 0.05);
      }
    },

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    },

    /** Soft square blip when eating a leaf */
    eat() {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      this.resume();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.08);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.13);
    },

    /** Descending silly "whoopsie" death tones */
    death() {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      this.resume();
      this.stopLoop();
      const t = ctx.currentTime;
      const notes = [392, 330, 262, 196, 147];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = i % 2 === 0 ? "triangle" : "square";
        const start = t + i * 0.11;
        o.frequency.setValueAtTime(freq, start);
        o.frequency.exponentialRampToValueAtTime(freq * 0.7, start + 0.14);
        g.gain.setValueAtTime(0.001, start);
        g.gain.linearRampToValueAtTime(0.14, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        o.connect(g);
        g.connect(this.master);
        o.start(start);
        o.stop(start + 0.18);
      });
      // Final silly wobble
      const wob = ctx.createOscillator();
      const wg = ctx.createGain();
      wob.type = "sawtooth";
      const wt = t + notes.length * 0.11;
      wob.frequency.setValueAtTime(120, wt);
      wob.frequency.linearRampToValueAtTime(60, wt + 0.35);
      wg.gain.setValueAtTime(0.08, wt);
      wg.gain.exponentialRampToValueAtTime(0.001, wt + 0.4);
      wob.connect(wg);
      wg.connect(this.master);
      wob.start(wt);
      wob.stop(wt + 0.42);
    },

    /** Tiny UI click */
    click() {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      this.resume();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.06);
    },

    /**
     * Lightweight chiptune-ish loop — original melody, no samples.
     * Soft pulse + bass under a short pentatonic phrase.
     */
    startLoop() {
      const ctx = this.ensure();
      if (!ctx || this.muted || this.loopPlaying) return;
      this.resume();
      this.stopLoop();

      const tempo = 0.28; // seconds per sixteenth-ish step
      const melody = [
        // C major-ish farm ditty (Hz)
        262, 0, 294, 330, 392, 330, 294, 262,
        330, 0, 392, 440, 392, 330, 294, 262,
        294, 330, 349, 330, 294, 262, 247, 262,
        392, 0, 330, 0, 294, 262, 0, 0,
      ];
      const bass = [
        131, 0, 0, 0, 98, 0, 0, 0,
        110, 0, 0, 0, 131, 0, 0, 0,
        98, 0, 0, 0, 87, 0, 0, 0,
        131, 0, 110, 0, 98, 0, 87, 0,
      ];

      const scheduleAhead = 0.15;
      let step = 0;
      let nextTime = ctx.currentTime + 0.05;
      let timerId = null;
      const oscillators = [];

      const playNote = (freq, when, dur, type, vol) => {
        if (!freq) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.001, when);
        g.gain.linearRampToValueAtTime(vol, when + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(when);
        o.stop(when + dur + 0.02);
        oscillators.push(o);
      };

      const tick = () => {
        if (!this.loopPlaying) return;
        const now = ctx.currentTime;
        while (nextTime < now + scheduleAhead) {
          const i = step % melody.length;
          playNote(melody[i], nextTime, tempo * 0.85, "square", 0.045);
          playNote(bass[i], nextTime, tempo * 0.9, "triangle", 0.06);
          nextTime += tempo;
          step++;
        }
        timerId = setTimeout(tick, 40);
      };

      this.loopPlaying = true;
      this.loopNodes = {
        stop() {
          clearTimeout(timerId);
          oscillators.forEach((o) => {
            try { o.stop(); } catch (_) { /* already stopped */ }
          });
        },
      };
      tick();
    },

    stopLoop() {
      this.loopPlaying = false;
      if (this.loopNodes) {
        this.loopNodes.stop();
        this.loopNodes = null;
      }
    },
  };

  global.FarmCoilAudio = AudioFX;
})(window);
