// Wigglefeast audio (#9): sound effects and a music loop, all generated with Web Audio (no files).
// main.js says what happened (play('eat'), boost(true), music(true), ...); this file decides how it
// sounds. Until unlock() runs from a user gesture nothing plays, and without Web Audio every call
// is a no-op, so the game always runs, silently if it must.
(function (root) {
  'use strict';
  const Ctx = root.AudioContext || root.webkitAudioContext;
  const MASTER = 0.7; // overall level with sound on
  const EAT_PER_SEC = 12; // eating pops allowed per second; extra ones are skipped
  const LOG_SIZE = 50;

  let ac = null, master = null, musicBus = null, noiseBuf = null;
  let soundOn = true, musicOn = true, quietOn = false, musicWanted = false, boostNodes = null;
  let eatTokens = EAT_PER_SEC, eatAt = 0;
  const played = [];

  const now = () => (root.performance ? root.performance.now() : Date.now());
  const audible = () => !!ac && soundOn && !quietOn;
  function record(name) {
    played.push({ name, at: now() });
    if (played.length > LOG_SIZE) played.shift();
  }
  function ramp(param, value, secs = 0.05) {
    const t = ac.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + secs);
  }

  // ---- Building blocks -------------------------------------------------------------------------
  // A short tone with an attack/decay envelope and an optional pitch glide.
  function tone({ type = 'sine', f0, f1 = f0, t = 0, dur = 0.15, vol = 0.3, attack = 0.005, out = master, at }) {
    const start = at !== undefined ? at : ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + dur + 0.02);
  }
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    return s;
  }
  // A burst of filtered noise (chomps, swooshes).
  function burst({ t = 0, dur = 0.12, vol = 0.3, type = 'bandpass', f0 = 1200, f1 = f0, q = 1 }) {
    const at = ac.currentTime + t, s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(master);
    s.start(at);
    s.stop(at + dur + 0.02);
  }

  // ---- The sounds (the recipes the owner approved in the prototype) ----------------------------
  const RECIPES = {
    eat({ size = 0.2 } = {}) { // size 0 (smallest food) .. 1 (biggest): smaller is higher
      const base = 880 - 420 * size, jitter = 1 + (Math.random() - 0.5) * 0.12;
      tone({ f0: base * 1.6 * jitter, f1: base * jitter, dur: 0.07 + 0.05 * size, vol: 0.16 + 0.1 * size });
    },
    powerup() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, t: i * 0.07, dur: 0.22, vol: 0.22 })); },
    special() {
      [1319, 1568, 1976, 2637].forEach((f, i) => tone({ f0: f, t: i * 0.05, dur: 0.35, vol: 0.14 }));
      tone({ type: 'triangle', f0: 659, dur: 0.4, vol: 0.12 });
    },
    kill() {
      burst({ dur: 0.09, vol: 0.35, type: 'lowpass', f0: 2500, f1: 300, q: 2 });
      tone({ type: 'square', f0: 140, f1: 70, dur: 0.12, vol: 0.12 });
      [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f0: f, t: 0.12 + i * 0.08, dur: 0.18, vol: 0.18 }));
    },
    death() {
      const at = ac.currentTime, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(330, at);
      o.frequency.exponentialRampToValueAtTime(70, at + 0.9);
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(2400, at);
      f.frequency.exponentialRampToValueAtTime(200, at + 0.9);
      g.gain.setValueAtTime(0.22, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.0);
      o.connect(f).connect(g).connect(master);
      o.start(at);
      o.stop(at + 1.05);
    },
    click() { tone({ type: 'square', f0: 1800, f1: 1200, dur: 0.03, vol: 0.06 }); },
    start() {
      burst({ dur: 0.35, vol: 0.18, f0: 400, f1: 3000, q: 1.2 });
      tone({ type: 'triangle', f0: 392, f1: 784, dur: 0.3, vol: 0.14 });
    },
  };

  // ---- Music: notes scheduled on the audio clock, a little ahead, so timer jitter can't make the
  // beat stumble. An 8-note pentatonic arpeggio over a 4-note bass line at 96 bpm, very quiet.
  const BEAT = 60 / 96, NOTES = [262, 330, 392, 440, 523, 440, 392, 330], BASS = [131, 131, 110, 98];
  const LOOKAHEAD = 0.2;
  let musicTimer = null, nextBar = 0, bar = 0;
  function scheduleMusic() {
    if (!ac) return;
    // While suspended (quiet) the audio clock stands still, so nothing new is scheduled.
    while (nextBar < ac.currentTime + LOOKAHEAD) {
      for (let k = 0; k < 4; k++) {
        tone({ type: 'triangle', f0: NOTES[(bar * 4 + k) % NOTES.length], at: nextBar + (k * BEAT) / 2, dur: BEAT * 0.9, vol: 0.05, attack: 0.01, out: musicBus });
      }
      tone({ f0: BASS[bar % BASS.length], at: nextBar, dur: BEAT * 2, vol: 0.08, attack: 0.05, out: musicBus });
      bar++;
      nextBar += BEAT * 2;
    }
  }
  const musicPlaying = () => !!ac && musicWanted && musicOn;
  function syncMusic() {
    if (!ac) return;
    if (musicPlaying()) {
      if (!musicTimer) {
        nextBar = ac.currentTime + 0.05;
        ramp(musicBus.gain, 1, 0.3);
        scheduleMusic();
        musicTimer = setInterval(scheduleMusic, 100);
      }
    } else if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
      ramp(musicBus.gain, 0, 0.15); // notes already scheduled fade out with the bus
    }
  }

  // ---- Boost whoosh ----------------------------------------------------------------------------
  function syncBoost(on) {
    if (!ac) return;
    if (on && !boostNodes) {
      const t = ac.currentTime, s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'bandpass';
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(1400, t + 0.25);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.12);
      const lfo = ac.createOscillator(), lg = ac.createGain(); // a slow wobble, so a long boost isn't static
      lfo.frequency.value = 5;
      lg.gain.value = 250;
      lfo.connect(lg).connect(f.frequency);
      s.connect(f).connect(g).connect(master);
      s.start(t);
      lfo.start(t);
      boostNodes = { s, g, lfo };
      if (audible()) record('boost');
    } else if (!on && boostNodes) {
      const { s, g, lfo } = boostNodes, t = ac.currentTime;
      ramp(g.gain, 0.0001, 0.15);
      s.stop(t + 0.2);
      lfo.stop(t + 0.2);
      boostNodes = null;
    }
  }

  // ---- API ------------------------------------------------------------------------------------
  let boostWanted = false;
  const api = {
    // From a user gesture (click, tap, key): browsers only let audio start after one.
    unlock() {
      if (!Ctx) return;
      try {
        if (!ac) {
          ac = new Ctx();
          master = ac.createGain();
          master.gain.value = soundOn ? MASTER : 0;
          master.connect(ac.destination);
          musicBus = ac.createGain();
          musicBus.gain.value = 0;
          musicBus.connect(master);
          syncMusic();
          syncBoost(boostWanted);
        }
        if (!quietOn && ac.state !== 'running') ac.resume(); // also after an interruption (iOS calls)
      } catch (e) { ac = null; } // no audio after all: stay silent
    },
    play(name, opts) {
      if (!audible() || !RECIPES[name]) return;
      if (name === 'eat') {
        const t = now();
        eatTokens = Math.min(EAT_PER_SEC, eatTokens + ((t - eatAt) / 1000) * EAT_PER_SEC);
        eatAt = t;
        if (eatTokens < 1) return;
        eatTokens -= 1;
      }
      RECIPES[name](opts);
      record(name);
    },
    boost(on) { on = !!on; if (on !== boostWanted) { boostWanted = on; syncBoost(on); } },
    music(on) { on = !!on; if (on !== musicWanted) { musicWanted = on; syncMusic(); } },
    setSound(on) {
      soundOn = !!on;
      if (ac) ramp(master.gain, soundOn ? MASTER : 0, 0.05);
    },
    setMusic(on) { musicOn = !!on; syncMusic(); },
    // Paused, standing by for another window, or hidden: suspend everything; resume where it was.
    quiet(on) {
      on = !!on;
      if (on === quietOn) return;
      quietOn = on;
      if (!ac) return;
      try { on ? ac.suspend() : ac.resume(); } catch (e) { /* ignore */ }
    },
    log: () => played.slice(),
    state: () => ({
      available: !!Ctx,
      unlocked: !!ac,
      sound: soundOn,
      music: musicOn,
      quiet: quietOn,
      musicPlaying: musicPlaying() && soundOn && !quietOn,
      boosting: !!boostNodes && soundOn && !quietOn,
    }),
  };
  root.WormAudio = api;
})(typeof window !== 'undefined' ? window : globalThis);
