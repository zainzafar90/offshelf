(() => {
  /* ---------- math ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const E = {
    lin: x => x,
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    outQuint: x => 1 - Math.pow(1 - x, 5),
    outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
    inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inBack: x => { const c1 = 1.7, c3 = c1 + 1; return c3 * x * x * x - c1 * x * x; },
    spring: x => x >= 1 ? 1 : 1 - Math.exp(-6.2 * x) * Math.cos(10.5 * x),
  };
  const k = (t, a, b, e = E.lin) => e(clamp((t - a) / (b - a)));
  const bump = (t, a, b) => Math.sin(Math.PI * clamp((t - a) / (b - a)));
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let r = Math.imul(seed ^ seed >>> 15, 1 | seed); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; };
  const mix = (c1, c2, x) => { const a = c1.match(/\w\w/g).map(h => parseInt(h, 16)), b = c2.match(/\w\w/g).map(h => parseInt(h, 16)); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], x))).join(",")})`; };

  /* ---------- dom ---------- */
  const $ = id => document.getElementById(id);
  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const show = (e, on) => { e.style.visibility = on ? "visible" : "hidden"; return on; };
  const move = (e, x, y, s = 1, r = 0, o) => { e.style.transform = `translate3d(${x}px,${y}px,0) rotate(${r}deg) scale(${s})`; if (o !== undefined) e.style.opacity = o; };
  let SC = 1;
  const R = e => { const r = e.getBoundingClientRect(), s = $("stage").getBoundingClientRect(); const x = (r.left - s.left) / SC, y = (r.top - s.top) / SC, w = r.width / SC, h = r.height / SC; return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }; };
  function words(container, text) {
    const out = [];
    text.split("|").forEach(line => {
      const row = document.createElement("div");
      line.split(" ").forEach((w, i) => {
        if (i) row.append(" ");
        const it = /^\*.+\*$/.test(w);
        const outer = el(`<span class="w${it ? " it" : ""}"><span class="wi">${it ? w.slice(1, -1) : w}</span></span>`);
        row.append(outer); out.push(outer.firstElementChild);
      });
      container.append(row);
    });
    return out;
  }
  function rise(list, t, start, stagger, dur = .75, exitAt = null, exitStagger = .035) {
    list.forEach((w, i) => {
      const inn = k(t, start + i * stagger, start + i * stagger + dur, E.outExpo);
      const out = exitAt === null ? 0 : k(t, exitAt + i * exitStagger, exitAt + i * exitStagger + .45, E.inExpo);
      w.style.transform = `translate3d(0,${(1 - inn) * 110 - out * 110}%,0) rotate(${(1 - inn) * 6}deg)`;
      w.style.opacity = inn > 0 && out < 1 ? 1 : 0;
    });
  }

  /* ---------- logo: planet and its front arc scale together, the ring widens out of the planet ---------- */
  const LOGO = '<g class="spin"><g class="pl"><circle cx="12" cy="12" r="5.5" fill="#FF8A3D"/></g><ellipse class="ring" cx="12" cy="12" rx="10" ry="3.6" fill="none" stroke="#F2F2EE" stroke-width="2" transform="rotate(-18 12 12)"/><g class="pl"><path d="M6.77 13.7a5.5 5.5 0 0 0 10.46-3.4z" fill="#FF8A3D"/></g></g>';
  const logo = svg => { svg.innerHTML = LOGO; return { spin: svg.querySelector(".spin"), planets: [...svg.querySelectorAll(".pl")], ring: svg.querySelector(".ring") }; };
  function pose(L, planet, ring, spin) {
    L.planets.forEach(g => g.setAttribute("transform", `translate(12 12) scale(${Math.max(planet, 1e-4)}) translate(-12 -12)`));
    L.ring.setAttribute("rx", lerp(5.8, 10, ring)); L.ring.setAttribute("ry", lerp(2.1, 3.6, ring));
    L.ring.setAttribute("stroke-width", lerp(.9, 2, ring));
    L.ring.style.opacity = clamp(ring * 4);
    L.spin.setAttribute("transform", `rotate(${spin} 12 12)`);
  }

  const G = {}, M = {};
  const APP = { x: 96, y: 60, w: 1728, h: 960 };

  async function build() {
    G.L1 = logo($("logo1")); G.L7 = logo($("logo7")); G.LH = logo($("hmark")); pose(G.LH, 1, 1, 0);

    // 2 · the problem
    G.w2a = words($("s2a"), "You found something|*worth* *keeping.*");
    G.w2b = words($("s2b"), "Then the tab closed.");
    $("s2c").innerHTML = "The link rotted.".split("").map(c => `<span class="ch">${c === " " ? "&nbsp;" : c}</span>`).join("");
    G.c2 = [...$("s2c").children];
    G.c2.forEach((c, i) => { const r = rng(100 + i); c._rot = (r() - .5) * 140; c._dx = (r() - .5) * 160; c._g = 4600 + r() * 2400; });
    const r2 = rng(42), favs = ["#3A3D4A", "#4A4E5E", "#FF8A3D", "#5B6072", "#343744", "#6B7085"];
    G.tabs = Array.from({ length: 18 }, (_, i) => {
      const d = el(`<div class="tab"><i class="fav" style="background:${favs[i % favs.length]}"></i><i class="tt" style="width:${100 + r2() * 110}px"></i><span class="tx">×</span></div>`);
      $("tabs").append(d);
      const top = i % 2 === 0;
      return { d, x: 70 + r2() * 1520, y: top ? 96 + r2() * 250 : 716 + r2() * 250, r: (r2() - .5) * 26, sx: (r2() - .5) * 900, delay: i * .045, out: r2() };
    });
    G.tabs.map((tb, i) => [tb.out, i]).sort((a, b) => a[0] - b[0]).forEach(([, idx], j) => { G.tabs[idx].outDelay = j * .032; });

    // 3 · save
    $("wimg").style.backgroundImage = `url(${reelAsset("c-own")})`;
    $("pReady").innerHTML = SNAP["popup-ready"]; $("pSaving").innerHTML = SNAP["popup-saving"]; $("pSaved").innerHTML = SNAP["popup-saved"];
    G.savingText = [...$("pSaving").querySelectorAll("b")].find(b => b.textContent.includes("Saving"));
    G.spinner = $("pSaving").querySelector("svg.animate-spin, .animate-spin");
    G.popLogo = $("pSaved").querySelector("header svg");

    // 4-6 · the real app
    const lib = $("lib");
    lib.innerHTML = SNAP.library; fillAssets(lib);
    $("rdL").firstElementChild.innerHTML = SNAP.reader; $("rdD").firstElementChild.innerHTML = SNAP.reader;
    fillAssets($("rdL")); fillAssets($("rdD"));
    await Promise.all([...document.querySelectorAll("#app img")].map(img => img.decode().catch(() => {})));
    lib.style.zoom = "1";
    const grid = lib.querySelector('[class*="auto-rows-"]');
    [...grid.children].forEach(cell => { cell.style.gridRowEnd = `span ${Math.ceil((cell.firstElementChild.getBoundingClientRect().height + 12) / 4)}`; });
    lib.style.zoom = "";
    G.search = lib.querySelector('input[type="search"]');
    G.count = [...lib.querySelectorAll("span")].find(s => /^\d+ saved$/.test(s.textContent.trim()));
    G.countText = G.count?.textContent;
    G.cards = [...lib.querySelectorAll("article")].map(d => ({ d, own: d.getAttribute("aria-label") === "Software you actually own", match: d.textContent.toLowerCase().includes("local") }));
    G.matches = G.cards.filter(c => c.match).length;
    G.quiet = lib.querySelector('article[aria-label="The quiet web"]');
    G.star = G.quiet.querySelector('button[aria-label="Star"]');
    G.sparks = Array.from({ length: 10 }, (_, i) => { const s = el('<div class="abs spark"></div>'); $("sparks").append(s); return { s, a: i / 10 * Math.PI * 2 }; });
    G.readers = [$("rdL"), $("rdD")].map(root => {
      const h1 = root.querySelector("h1");
      const title = h1.textContent; h1.textContent = "";
      const w = words(h1, title);
      const prose = root.querySelector("[data-reader-prose]");
      const blocks = prose.children.length === 1 ? [...prose.firstElementChild.children] : [...prose.children];
      const outline = [...root.querySelectorAll('nav[aria-label="On this page"] a')];
      return { root, w, prose, blocks, outline, author: h1.previousElementSibling, status: h1.nextElementSibling, scroller: root.querySelector("[data-reader-scroller]"), bar: root.querySelector("div.h-0\\.5 > div"), aa: root.querySelector('button[aria-label="Reading appearance"]') };
    });

    // 6 · yours
    G.l6 = ["No account.", "No cloud.", "No tracking.", "Just your library."].map((line, i) => {
      const row = el(`<div class="big6"><span class="w${i === 3 ? " it" : ""}" style="${i === 3 ? "font-size:1.07em" : ""}"><span class="wi" style="${i === 3 ? "color:#FF8A3D" : ""}">${line}</span></span></div>`);
      $("lines6").append(row); return row.querySelector(".wi");
    });

    // 7 · lockup
    $("word7").innerHTML = '<span class="w"><span class="wi">Offshelf</span></span>';
    G.wm = $("word7").querySelector(".wi");
    G.t7 = words($("tag7"), "Save it. Read it. *Keep* *it.*");
    G.t7.slice(4).forEach(w => { w.style.color = "#FF8A3D"; });
    const gl = (1920 - (300 + 56 + $("word7").offsetWidth)) / 2;
    G.logo7X = gl; $("word7").style.left = gl + 356 + "px";

    // measure everything at rest
    applyApp({ X: APP.x, Y: APP.y, s: 1, o: 1, radius: 18 });
    M.win = R($("win")); M.ext = R($("ext"));
    const pw = 360 * 1.2;
    $("popWrap").style.left = M.ext.cx + 26 - pw + "px"; $("popWrap").style.top = M.win.y + 96 + 8 + "px";
    ["pReady", "pSaving", "pSaved"].forEach(id => { M[id] = R($(id)).h / 1.2; });
    M.save = R([...$("pReady").querySelectorAll("button")].find(b => b.textContent.includes("Save this page")));
    M.plogo = R($("pReady").querySelector("header svg"));
    M.blocks = [...document.querySelectorAll("#win .blk")].map((b, i) => { const r = rng(300 + i); return { b, r: R(b), rot: (r() - .5) * 36, arc: 80 + r() * 160 }; });
    M.own = R(G.cards.find(c => c.own).d);
    M.quiet = R(G.quiet); M.star = R(G.star);
    M.main = R(lib.querySelector("main"));
    G.cards.forEach(c => { c.r = R(c.d); });
    [...G.cards].sort((a, b) => (a.r.y - b.r.y) || (a.r.x - b.r.x)).forEach((c, i) => { c.order = i; });
    M.aa = R(G.readers[0].aa);
    G.readers.forEach(rd => { rd.max = Math.max(0, rd.scroller.scrollHeight - rd.scroller.clientHeight); });
    M.chip = R($("chip6"));
  }

  /* ---------- the app frame: one transform carries scenes 4, 5 and 6 ---------- */
  function applyApp({ X, Y, s, o, radius }) {
    const app = $("app");
    app.style.transform = `translate3d(${X}px,${Y}px,0) scale(${s})`;
    app.style.opacity = o;
    app.style.borderRadius = radius + "px";
  }
  function appState(t) {
    const enter = lerp(.97, 1, k(t, 13.5, 14.4, E.outCubic));
    const cam = 1 + .03 * k(t, 14.5, 19.2, E.inOutCubic) * (1 - k(t, 19.2, 19.85, E.inOutCubic));
    let s = enter * cam, X = 960 - APP.w / 2 * s, Y = 540 - APP.h / 2 * s;
    const pull = k(t, 24.55, 25.2, E.inOutExpo);
    X = lerp(X, 960, pull); Y = lerp(Y, 300, pull); s = lerp(s, .5, pull);
    const q = k(t, 27.05, 27.55, E.inExpo);
    if (q > 0) {
      const cx = lerp(X + APP.w / 2 * s, 960, q), cy = lerp(Y + APP.h / 2 * s, 540, q), s2 = Math.max(s * (1 - q), 1e-4);
      X = cx - APP.w / 2 * s2; Y = cy - APP.h / 2 * s2; s = s2;
    }
    return { X, Y, s, o: k(t, 13.5, 14.0) * (1 - k(t, 27.3, 27.5)), radius: lerp(18, 30, pull) };
  }
  const onApp = (st, p) => ({ x: st.X + (p.x - APP.x) * st.s, y: st.Y + (p.y - APP.y) * st.s });

  /* ---------- scenes ---------- */
  function S1(t) {
    if (!show($("s1"), t < 4.2)) return;
    const planet = .16 * k(t, .15, .55, E.outBack) + .84 * k(t, .6, 1.5, E.inOutExpo);
    pose(G.L1, planet, k(t, .95, 2.05, E.inOutCubic), lerp(-40, 0, k(t, .9, 2.3, E.outCubic)));
    const s = (1 + .04 * k(t, 1.6, 3.2, E.inOutCubic)) * Math.pow(70, k(t, 3.2, 4.1, E.inExpo));
    $("logo1").style.transform = `scale(${s}) rotate(${6 * k(t, 3.2, 4.1, E.inCubic)}deg)`;
    const q = k(t, .2, 1.4, E.outCubic);
    $("sonar").style.transform = `scale(${1 + q * 14})`;
    $("sonar").style.opacity = q > 0 ? 1 - q : 0;
  }
  function S2(t) {
    if (!show($("s2"), t >= 3.95 && t < 9.1)) return;
    $("s2orange").style.opacity = t < 6.4 ? 1 : 0;
    $("s2wipe").style.transform = `rotate(-7deg) scaleY(${k(t, 5.75, 6.3, E.inOutExpo)})`;
    rise(G.w2a, t, 4.2, .075, .8, 5.45, .04);
    G.tabs.forEach(tb => {
      const a = 6.2 + tb.delay, q = k(t, a, a + .9, E.spring);
      const out = k(t, 7.3 + tb.outDelay, 7.62 + tb.outDelay, E.inBack);
      move(tb.d, lerp(tb.x + tb.sx, tb.x, q), lerp(1250, tb.y, q), 1 - clamp(out), lerp(tb.r * 3, tb.r, q) + out * 40, k(t, a, a + .12) * (1 - k(t, 7.5 + tb.outDelay, 7.62 + tb.outDelay)));
    });
    rise(G.w2b, t, 6.55, .08, .75, 7.55, .04);
    move($("s404"), 0, 0, lerp(1.18, 1, k(t, 7.8, 8.9, E.outCubic)), 0, k(t, 7.8, 8.4, E.outCubic) * (1 - k(t, 8.75, 9.05)));
    G.c2.forEach((c, i) => {
      const inn = k(t, 7.85 + i * .025, 8.45 + i * .025, E.outExpo), dt = Math.max(0, t - (8.4 + i * .028));
      move(c, c._dx * dt, (1 - inn) * 200 + .5 * c._g * dt * dt, 1, c._rot * dt * 1.6, inn);
    });
  }
  function S3(t) {
    if (!show($("s3"), t >= 8.9 && t < 14.55)) return;
    const win = $("win"), rise3 = k(t, 8.95, 9.75, E.outExpo), m = k(t, 13.35, 14.2, E.inOutExpo);
    win.style.left = lerp(M.win.x, M.own.x, m) + "px"; win.style.top = lerp(M.win.y, M.own.y, m) + "px";
    win.style.width = lerp(M.win.w, M.own.w, m) + "px"; win.style.height = lerp(M.win.h, M.own.h, m) + "px";
    win.style.borderRadius = lerp(16, 12, m) + "px";
    win.style.background = mix("FBFAF8", "FFFFFF", m);
    win.style.transform = `perspective(1800px) translate3d(0,${(1 - rise3) * 900}px,0) rotateX(${(1 - rise3) * 22}deg) scale(${lerp(.9, 1, rise3)})`;
    win.style.opacity = k(t, 8.95, 9.2) * (1 - k(t, 14.25, 14.5));
    $("wchrome").style.opacity = 1 - k(t, 13.3, 13.55);
    $("wnav").style.opacity = 1 - k(t, 13.3, 13.55);
    // cursor: toolbar icon, then Save
    const p0 = { x: 1780, y: 1010 }, p1 = { x: M.ext.cx - 6, y: M.ext.cy - 4 }, p2 = { x: M.save.cx + 60, y: M.save.cy - 4 }, p3 = { x: M.save.cx + 320, y: M.save.cy + 250 };
    const a = k(t, 9.45, 10.25, E.inOutCubic), b = k(t, 10.8, 11.35, E.inOutCubic), d = k(t, 12.0, 12.9, E.inOutCubic);
    let x = lerp(p0.x, p1.x, a) - Math.sin(Math.PI * a) * 120, y = lerp(p0.y, p1.y, a) - Math.sin(Math.PI * a) * 60;
    if (b > 0) { x = lerp(p1.x, p2.x, b) + Math.sin(Math.PI * b) * 40; y = lerp(p1.y, p2.y, b) + Math.sin(Math.PI * b) * 30; }
    if (d > 0) { x = lerp(p2.x, p3.x, d); y = lerp(p2.y, p3.y, d); }
    move($("cursor1"), x - 5, y - 3, 1 - .18 * (bump(t, 10.25, 10.5) + bump(t, 11.35, 11.6)), 0, k(t, 9.45, 9.6) * (1 - k(t, 12.6, 12.9)));
    const rp = k(t, 10.32, 10.95, E.outCubic);
    move($("ripple"), M.ext.cx, M.ext.cy, .4 + rp * 3.2, 0, rp > 0 ? 1 - rp : 0);
    $("ext").style.transform = `scale(${1 - .16 * bump(t, 10.25, 10.55)})`;
    $("ext").style.background = t > 10.3 && t < 13.2 ? "#E8EAED" : "transparent";
    // the real popup, through its three states
    const pop = k(t, 10.38, 11.05, E.spring), wrap = $("popWrap");
    wrap.style.transformOrigin = "92% 0";
    wrap.style.transform = `scale(${lerp(.6, 1, pop) * (1 - .03 * k(t, 13.05, 13.35))})`;
    wrap.style.opacity = k(t, 10.38, 10.5) * (1 - k(t, 13.05, 13.35));
    const toSaving = k(t, 11.45, 11.6), toSaved = k(t, 12.45, 12.6);
    $("pReady").style.opacity = 1 - toSaving;
    $("pSaving").style.opacity = toSaving * (1 - toSaved);
    $("pSaved").style.opacity = toSaved;
    $("popZoom").style.height = lerp(lerp(M.pReady, M.pSaving, toSaving), M.pSaved, toSaved) + "px";
    if (G.savingText) G.savingText.textContent = `Saving images · ${t < 11.98 ? 1 : t < 12.3 ? 2 : 3} of 3`;
    if (G.spinner) G.spinner.style.transform = `rotate(${t * 420}deg)`;
    if (G.popLogo) G.popLogo.style.transform = `scale(${1 + .45 * bump(t, 12.45, 12.85)})`;
    // the page's words and picture fly into the logo
    M.blocks.forEach((o, i) => {
      const s0 = 11.75 + i * .075, q = k(t, s0, s0 + .78, E.inOutCubic);
      move(o.b, (M.plogo.cx - o.r.cx) * q, (M.plogo.cy - o.r.cy) * q - Math.sin(Math.PI * q) * o.arc, lerp(1, .03, E.inCubic(q)), o.rot * q, 1 - k(t, s0 + .55, s0 + .78));
    });
  }
  function S4(t, st) {
    if (!show($("s4"), t >= 13.5 && t < 27.6)) { $("expand").style.visibility = "hidden"; return; }
    applyApp(st);
    show($("lib"), t < 19.86);
    // cascade: the saved card is already here (the browser became it)
    G.cards.forEach(c => {
      const s0 = 14.25 + c.order * .09, q = c.own ? 1 : k(t, s0, s0 + .85, E.spring), o = c.own ? k(t, 14.2, 14.3) : k(t, s0, s0 + .2);
      const typed = k(t, 16.7, 17.15, E.outCubic) * (1 - k(t, 17.95, 18.35, E.inOutCubic));
      const dim = c.match ? 0 : typed;
      move(c.d, 0, (1 - q) * 70, lerp(.93, 1, q) * (1 - .03 * dim), 0, o * (1 - .82 * dim));
    });
    const word = "local", n = Math.floor(k(t, 15.85, 16.55) * word.length + 1e-3) - Math.floor(k(t, 17.6, 17.9) * word.length + 1e-3);
    G.search.value = word.slice(0, Math.max(0, n));
    if (G.count) G.count.textContent = k(t, 16.7, 17.15) > .5 && t < 18.1 ? `${G.matches} saved` : G.countText;
    // star, with the product tooltip
    const sb = onApp(st, { x: M.star.cx, y: M.star.cy });
    const tip = k(t, 18.3, 18.45, E.outCubic) * (1 - k(t, 19.0, 19.12));
    const tipBox = $("tipStar").getBoundingClientRect();
    move($("tipStar"), (sb.x - tipBox.width / 2 / SC) / 1.2, (sb.y - 50) / 1.2 + (1 - tip) * 4, 1, 0, tip);
    const starred = t >= 18.6;
    G.star.querySelector("svg").setAttribute("fill", starred ? "currentColor" : "none");
    G.star.style.color = starred ? "var(--foreground)" : "";
    G.star.style.transform = `scale(${1 + .5 * bump(t, 18.58, 18.9)})`;
    const sp = k(t, 18.6, 19.1, E.outCubic);
    G.sparks.forEach(s => move(s.s, sb.x + Math.cos(s.a) * sp * 44, sb.y + Math.sin(s.a) * sp * 44, 1 - sp * .6, 0, sp > 0 && sp < 1 ? 1 - sp : 0));
    // the card opens into the reader panel
    const ex = k(t, 19.2, 19.85, E.inOutExpo), ep = $("expand");
    if (show(ep, ex > 0 && t < 20.05)) {
      const from = { x: M.quiet.x - APP.x, y: M.quiet.y - APP.y, w: M.quiet.w, h: M.quiet.h }, to = { x: M.main.x - APP.x, y: M.main.y - APP.y, w: M.main.w, h: M.main.h };
      ep.style.left = lerp(from.x, to.x, ex) + "px"; ep.style.top = lerp(from.y, to.y, ex) + "px";
      ep.style.width = lerp(from.w, to.w, ex) + "px"; ep.style.height = lerp(from.h, to.h, ex) + "px";
      ep.style.borderRadius = lerp(12, 14.4, ex) + "px";
      ep.style.background = mix("FFFFFF", "F7F7F6", ex);
      ep.style.opacity = 1 - k(t, 19.86, 20.05);
    }
  }
  function S5(t, st) {
    const on = t >= 19.84 && t < 27.6;
    show($("rdL"), on && t < 23.7);
    show($("rdD"), on && t >= 22.8);
    if (!show($("s5"), on && t < 24.5)) { if (!on) return; }
    const scroll = k(t, 21.3, 22.9, E.inOutCubic), size = lerp(20, 23, k(t, 23.75, 24.35, E.inOutCubic));
    G.readers.forEach(rd => {
      move(rd.author, 0, (1 - k(t, 19.88, 20.4, E.outExpo)) * 16, 1, 0, k(t, 19.88, 20.15));
      rd.w.forEach((w, i) => { const q = k(t, 19.92 + i * .06, 20.7 + i * .06, E.outExpo); w.style.transform = `translate3d(0,${(1 - q) * 110}%,0)`; w.style.opacity = q > 0 ? 1 : 0; });
      if (rd.status) rd.status.style.opacity = k(t, 20.25, 20.55);
      rd.blocks.forEach((b, j) => {
        const q = k(t, 20.3 + j * .16, 21.1 + j * .16, E.outCubic), cut = q * 130 - 15;
        b.style.webkitMaskImage = `linear-gradient(to bottom, #000 ${cut}%, transparent ${cut + 15}%)`;
        b.style.transform = `translate3d(0,${(1 - q) * 14}px,0)`;
      });
      rd.prose.style.fontSize = size + "px";
      rd.scroller.scrollTop = Math.min(rd.max, 560) * scroll;
      if (rd.bar) rd.bar.style.width = lerp(3, 58, scroll) + "%";
      const active = scroll > .62 ? 1 : 0;
      rd.outline.forEach((a, i) => {
        const on2 = i === active;
        a.classList.toggle("bg-muted", on2); a.classList.toggle("text-foreground", on2); a.classList.toggle("text-muted-foreground", !on2);
      });
    });
    // cursor opens Reading appearance, then the page turns dark from that button
    const aa = onApp(st, { x: M.aa.cx, y: M.aa.cy }), c1 = k(t, 21.9, 22.55, E.inOutCubic);
    move($("cursor2"), lerp(1500, aa.x - 5, c1) - Math.sin(Math.PI * c1) * 80, lerp(860, aa.y - 3, c1) + Math.sin(Math.PI * c1) * 40, 1 - .18 * bump(t, 22.7, 22.9), 0, k(t, 21.9, 22.05) * (1 - k(t, 23.4, 23.6)));
    const tip = k(t, 22.35, 22.5) * (1 - k(t, 22.75, 22.85)), tipBox = $("tipAa").getBoundingClientRect();
    move($("tipAa"), (aa.x - tipBox.width / 2 / SC) / 1.2, (aa.y + 30) / 1.2, 1, 0, tip);
    const rad = k(t, 22.8, 23.65, E.inOutExpo) * 2300;
    $("rdD").style.clipPath = `circle(${rad}px at ${M.aa.cx - APP.x}px ${M.aa.cy - APP.y}px)`;
  }
  function S6(t, st) {
    if (!show($("s6"), t >= 24.8 && t < 27.7)) return;
    document.querySelectorAll(".wf").forEach((p, i) => { p.style.strokeDasharray = "1 1"; p.style.strokeDashoffset = 1 - k(t, 24.95 + i * .08, 25.45 + i * .08, E.outCubic); });
    $("wslash").style.strokeDasharray = "1 1"; $("wslash").style.strokeDashoffset = 1 - k(t, 25.45, 25.75, E.inOutCubic);
    $("wifi").style.opacity = 1 - k(t, 26.95, 27.25);
    G.l6.forEach((w, i) => {
      const s0 = i === 3 ? 25.95 : 25.15 + i * .16, q = k(t, s0, s0 + .8, E.outExpo), out = k(t, 26.95 + i * .05, 27.35 + i * .05, E.inExpo);
      w.style.transform = `translate3d(0,${(1 - q) * 110 - out * 110}%,0)`;
      w.style.opacity = q > 0 && out < 1 ? 1 : 0;
    });
    const n = k(t, 26.1, 26.95, E.outCubic);
    $("stats6").innerHTML = `<b>${Math.round(42 * n)}</b> pages · <b>${Math.round(318 * n)}</b> images · <b>0</b> servers`;
    $("stats6").style.opacity = k(t, 26.05, 26.25) * (1 - k(t, 26.95, 27.2));
    const corner = onApp(st, { x: APP.x + 28, y: APP.y + 28 }), bq = k(t, 25.5, 26.1, E.spring);
    move($("chip6"), corner.x, corner.y + (1 - bq) * 14, lerp(.6, 1, bq), 0, k(t, 25.5, 25.6) * (1 - k(t, 26.95, 27.15)));
    $("chip6").style.transformOrigin = "0 0";
  }
  function S7(t) {
    if (!show($("s7"), t >= 27.3)) return;
    const planet = .2 * k(t, 27.35, 27.6, E.outBack) + .8 * k(t, 27.6, 28.1, E.outExpo);
    pose(G.L7, planet, k(t, 27.75, 28.4, E.inOutCubic), lerp(-30, 0, k(t, 27.7, 28.5, E.outCubic)));
    const slide = k(t, 28.05, 28.75, E.inOutExpo), lx = lerp(810, G.logo7X, slide), push = 1 + .025 * k(t, 28.6, 30, E.inOutCubic);
    move($("logo7"), (lx - 810) * push, 0, push);
    const wq = k(t, 28.25, 29.05, E.outExpo);
    G.wm.style.transform = `translate3d(0,${(1 - wq) * 105}%,0)`;
    G.wm.style.letterSpacing = lerp(.14, 0, k(t, 28.25, 29.5, E.outQuint)) + "em";
    G.wm.style.opacity = wq > 0 ? 1 : 0;
    move($("word7"), 0, 0, push);
    rise(G.t7, t, 28.85, .07, .7);
  }
  const SCENES = [[0, "01 — IGNITION", ""], [4.1, "02 — THE PROBLEM", ""], [8.95, "03 — SAVE", "One click keeps the words, the images and the thread."], [13.9, "04 — LIBRARY", "Everything you save, in one calm place."], [19.7, "05 — READ", "Read it your way. Light, dark, serif, bigger."], [24.6, "06 — YOURS", ""], [27.4, "07 — OFFSHELF", ""]];
  function HUD(t) {
    const ink = k(t, 3.95, 4.1) * (1 - k(t, 5.9, 6.2)), hud = $("hud");
    hud.style.color = mix("F2F2EE", "15171F", ink);
    hud.style.opacity = 1 - k(t, 27.3, 27.7);
    G.LH.ring.setAttribute("stroke", ink > .5 ? "#15171F" : "#F2F2EE");
    let i = 0; SCENES.forEach((s, j) => { if (t >= s[0]) i = j; });
    const q = i ? k(t, SCENES[i][0], SCENES[i][0] + .45, E.outExpo) : 1;
    const [a, b] = $("hscene").children;
    a.textContent = i ? SCENES[i - 1][1] : ""; b.textContent = SCENES[i][1];
    a.style.transform = `translateY(${-q * 22}px)`; b.style.transform = `translateY(${(1 - q) * 22}px)`;
    const [ca, cb] = $("cap").children;
    ca.textContent = i ? SCENES[i - 1][2] : ""; cb.textContent = SCENES[i][2];
    ca.style.transform = `translateY(${-q * 30}px)`; cb.style.transform = `translateY(${(1 - q) * 30}px)`;
    ca.style.opacity = 1 - q; cb.style.opacity = q;
    const f = Math.round(t * 60);
    $("htc").textContent = `00:${String(Math.floor(f / 60)).padStart(2, "0")}.${String(f % 60).padStart(2, "0")}`;
    $("hbar").style.width = t / 30 * 100 + "%";
    $("hbar").style.background = ink > .5 ? "#15171F" : "#FF8A3D";
  }

  window.render = t => {
    const st = appState(t);
    S1(t); S2(t); S3(t); S4(t, st); S5(t, st); S6(t, st); S7(t); HUD(t);
  };

  window.ready = (async () => {
    await document.fonts.ready;
    await Promise.all(['400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '700 40px "Inter Variable"', '400 13px "Inter Variable"', '600 13px "Inter Variable"'].map(f => document.fonts.load(f)));
    const params = new URLSearchParams(location.search);
    if (!params.has("render")) { SC = Math.min(innerWidth / 1920, innerHeight / 1080); $("stage").style.transform = `scale(${SC})`; }
    await build();
    render(0);
    if (!params.has("render")) {
      const t0 = performance.now(), start = parseFloat(params.get("t") || "0");
      const loop = now => { render((start + (now - t0) / 1000) % 30); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    return true;
  })();
})();
