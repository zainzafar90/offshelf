import { writeFileSync } from "node:fs";

const SR = 48000, DUR = 30, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 1234567;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } };

// Pad: four chords, slow attack, gentle detune
const chords = [[45, 52, 55, 59, 60], [41, 48, 52, 57, 64], [48, 55, 59, 64, 67], [43, 50, 55, 59, 62]];
for (let i = 0; i < N; i++) {
  const t = i / SR, idx = Math.min(3, Math.floor(t / 7.5)), local = t - idx * 7.5;
  const env = Math.min(1, local / 1.8) * Math.min(1, (7.5 - local) / 1.2 + .25);
  const master = Math.min(1, t / 2.5) * Math.min(1, (DUR - t) / 1.5) * (t > 3.9 && t < 4.3 ? .4 : 1);
  let v = 0;
  for (const m of chords[idx]) { const f = hz(m); v += Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * f * 1.004 * t + 1.3); }
  const x = v * .012 * env * master;
  L[i] += x * (1 + .15 * Math.sin(t * .7)); R[i] += x * (1 - .15 * Math.sin(t * .7));
}

// Events
function kick(t0, gain = .5, base = 52) {
  for (let j = 0; j < SR * .45; j++) { const t = j / SR, f = base + 90 * Math.exp(-t * 28); add(Math.floor(t0 * SR) + j, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 7) * gain); }
}
function boom(t0, gain = .9) {
  kick(t0, gain, 38);
  let lp = 0; for (let j = 0; j < SR * 1.6; j++) { const t = j / SR; lp += (rand() - lp) * .03; add(Math.floor(t0 * SR) + j, lp * Math.exp(-t * 2.6) * gain * 1.2, 0); }
}
function click(t0, gain = .35, pan = 0) {
  for (let j = 0; j < SR * .03; j++) { const t = j / SR; add(Math.floor(t0 * SR) + j, (rand() * Math.exp(-t * 900) + Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 180) * .5) * gain, pan); }
}
function tick(t0, gain = .12, pan = 0) {
  let prev = 0; for (let j = 0; j < SR * .02; j++) { const t = j / SR, n = rand(); add(Math.floor(t0 * SR) + j, (n - prev) * Math.exp(-t * 400) * gain, pan); prev = n; }
}
function pop(t0, gain = .18, f0 = 900, pan = 0) {
  for (let j = 0; j < SR * .12; j++) { const t = j / SR, f = f0 * Math.exp(-t * 14); add(Math.floor(t0 * SR) + j, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 40) * gain, pan); }
}
function chime(t0, notes, gain = .16, decay = 2.2) {
  for (const [m, d] of notes) for (let j = 0; j < SR * 2.8; j++) {
    const t = j / SR, f = hz(m); add(Math.floor((t0 + d) * SR) + j, (Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(2 * Math.PI * f * 2.01 * t)) * Math.exp(-t * decay) * Math.min(1, t * 400) * gain, (m % 5 - 2) * .15);
  }
}
function whoosh(t0, t1, gain = .35, up = true, pan = 0) {
  const n = Math.floor((t1 - t0) * SR); let lp = 0, lp2 = 0;
  for (let j = 0; j < n; j++) {
    const x = j / n, env = up ? Math.pow(x, 1.6) * (1 - Math.pow(x, 12)) : Math.sin(Math.PI * x) * (1 - x * .3);
    const cut = .01 + .22 * (up ? x : Math.sin(Math.PI * x));
    lp += (rand() - lp) * cut; lp2 += (lp - lp2) * cut;
    add(Math.floor(t0 * SR) + j, lp2 * env * gain * 2.2, pan * (x - .5) * 2);
  }
}
function riser(t0, t1, gain = .06) {
  const n = Math.floor((t1 - t0) * SR); let ph = 0;
  for (let j = 0; j < n; j++) { const x = j / n, f = 300 + 900 * x * x; ph += 2 * Math.PI * f / SR; add(Math.floor(t0 * SR) + j, Math.sin(ph) * x * gain); }
}

// 1 · ignition
chime(.2, [[81, 0]], .07, 3);
whoosh(.5, 1.6, .18, false);
whoosh(.95, 2.1, .16, false, 1);
whoosh(3.15, 4.1, .55, true);
boom(4.1, .85);
// 2 · the problem
whoosh(5.7, 6.35, .35, false, -1);
for (let i = 0; i < 18; i++) tick(6.2 + i * .045 + .28, .16, (i % 5 - 2) * .3);
for (let j = 0; j < 18; j++) pop(7.3 + j * .032 + .2, .1, 700 + (j % 4) * 120, (j % 3 - 1) * .4);
whoosh(8.35, 9.1, .28, false, 1);
kick(8.4, .35, 44);
// 3 · save
whoosh(8.95, 9.7, .3, false);
click(10.25, .4, .4); pop(10.42, .14, 1300, .4);
click(11.35, .4, .3);
riser(11.5, 12.45, .05);
for (let i = 0; i < 3; i++) tick(11.5 + (i + .5) * .32, .12, .3);
chime(12.45, [[76, 0], [83, .06], [88, .12]], .12, 2.4);
whoosh(11.75, 12.9, .22, false, -1);
whoosh(13.3, 14.2, .3, false);
kick(14.2, .3, 60);
// 4 · library
for (let i = 1; i < 9; i++) tick(14.35 + i * .085 + .15, .12, (i % 3 - 1) * .5);
for (let i = 0; i < 5; i++) click(15.85 + i * .14, .12, -.2);
whoosh(16.7, 17.2, .14, false);
for (let i = 0; i < 5; i++) click(17.6 + i * .06, .08, -.2);
chime(18.6, [[91, 0], [95, .05]], .08, 4);
whoosh(19.2, 19.9, .4, true);
// 5 · read
click(22.7, .35, .5);
whoosh(22.8, 23.7, .32, false, 1);
for (let i = 0; i < 4; i++) tick(20.35 + i * .3, .05);
// 6 · yours
whoosh(24.5, 25.25, .3, false, -1);
whoosh(25.45, 25.8, .18, false, 1);
for (let i = 0; i < 16; i++) tick(26.1 + i * .053, .07, (i % 2 ? .3 : -.3));
whoosh(27.0, 27.5, .45, true);
// 7 · resolve
boom(27.5, .7);
chime(28.3, [[69, 0], [76, .08], [81, .16], [88, .26]], .1, 1.1);
for (let i = 0; i < 8; i++) tick(28.35 + i * .045, .05);

// pulse: 120 bpm from the dive to the collapse
for (let b = 4.6; b < 27; b += .5) kick(b, b > 19.7 && b < 24.5 ? .12 : .2, 50);
for (let b = 9.25; b < 24.5; b += .5) tick(b, .035, .2);

// master: soft clip + normalize
let peak = 0;
for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const g = .89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
writeFileSync(new URL("reel.wav", import.meta.url), buf);
console.log("wrote reel.wav, peak", peak.toFixed(2));
