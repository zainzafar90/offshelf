// Flat generated artwork for the snapshot images (covers + avatars). No external images.
(function () {
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
  function linear(ctx, w, h, angle, stops) {
    const r = angle * Math.PI / 180, cx = w / 2, cy = h / 2, d = Math.abs(w * Math.cos(r)) / 2 + Math.abs(h * Math.sin(r)) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(r) * d, cy - Math.sin(r) * d, cx + Math.cos(r) * d, cy + Math.sin(r) * d);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  const COVERS = {
    "c-own": (ctx, w, h) => {
      ctx.fillStyle = linear(ctx, w, h, 100, [[0, "#FFD1B0"], [.45, "#FF8A3D"], [1, "#B24A1F"]]); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#15171F"; ctx.fillRect(0, h * .72, w, h * .28);
      ctx.fillStyle = "#FFF3EA"; ctx.beginPath(); ctx.arc(w * .68, h * .5, h * .2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#F2F2EE"; [.16, .24, .32].forEach((y, i) => ctx.fillRect(w * .1, h * (.2 + i * .09), w * (.26 - i * .06), h * .028));
    },
    "c-quiet": (ctx, w, h) => {
      ctx.fillStyle = linear(ctx, w, h, 90, [[0, "#DCE3EA"], [1, "#8C9AAB"]]); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#5E6B7C"; ctx.beginPath(); ctx.moveTo(0, h * .78); ctx.lineTo(w * .3, h * .56); ctx.lineTo(w * .52, h * .7); ctx.lineTo(w * .78, h * .5); ctx.lineTo(w, h * .66); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = "#3E4958"; ctx.beginPath(); ctx.moveTo(0, h * .9); ctx.lineTo(w * .4, h * .72); ctx.lineTo(w * .7, h * .84); ctx.lineTo(w, h * .76); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = "#F6F7F8"; ctx.beginPath(); ctx.arc(w * .24, h * .3, h * .09, 0, Math.PI * 2); ctx.fill();
    },
    "c-local": (ctx, w, h) => {
      ctx.fillStyle = linear(ctx, w, h, 110, [[0, "#EFE7DA"], [1, "#C8B79C"]]); ctx.fillRect(0, 0, w, h);
      const cols = ["#8E7B5E", "#A8946F", "#6F604A", "#B9A57F", "#5A4E3C"];
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(w * (.18 + i * .1), h * (.3 + (i % 2) * .06), w * .075, h * (.5 - (i % 2) * .06)); });
      ctx.fillStyle = "#4A3F31"; ctx.fillRect(w * .12, h * .8, w * .76, h * .035);
    },
    "c-calm": (ctx, w, h) => {
      ctx.fillStyle = linear(ctx, w, h, 90, [[0, "#E4ECE4"], [1, "#9DB3A2"]]); ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#5F7D68"; ctx.lineWidth = h * .02;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(w * .5, h * 1.05, h * (.3 + i * .16), Math.PI, 0); ctx.stroke(); }
      ctx.fillStyle = "#2F4236"; ctx.beginPath(); ctx.arc(w * .5, h * .38, h * .07, 0, Math.PI * 2); ctx.fill();
    },
  };
  COVERS["c-shotA"] = (ctx, w, h) => {
    ctx.fillStyle = "#EEF1F4"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#fff"; ctx.fillRect(w * .06, h * .08, w * .88, h * .84);
    ctx.fillStyle = "#15171F"; ctx.fillRect(w * .1, h * .14, w * .34, h * .05); ctx.fillStyle = "#C9CFD6";
    for (let i = 0; i < 6; i++) ctx.fillRect(w * .1, h * (.26 + i * .08), w * (.62 - (i % 3) * .12), h * .025);
    ctx.fillStyle = "#FF8A3D"; ctx.fillRect(w * .1, h * .78, w * .2, h * .07);
  };
  COVERS["c-shotB"] = (ctx, w, h) => {
    ctx.fillStyle = "#1B1D26"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#2A2D38";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(w * (.08 + c * .29), h * (.1 + r * .28), w * .26, h * .24);
    ctx.fillStyle = "#FF8A3D"; ctx.fillRect(w * .08, h * .1, w * .26, h * .24);
  };
  const AVATARS = { "a-nz": ["#3B4252", "#C9CED8"], "a-mc": ["#C2532A", "#FFD1B0"], "a-ap": ["#27313A", "#9FB0C0"], "a-lr": ["#5E513F", "#E4D6BF"] };
  function avatar([bg, fg]) {
    const [c, ctx] = canvas(160, 160);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(80, 64, 30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(80, 150, 56, 44, 0, Math.PI, 0); ctx.fill();
    return c.toDataURL("image/png");
  }
  const cache = {};
  window.reelAsset = id => {
    if (cache[id]) return cache[id];
    if (AVATARS[id]) return cache[id] = avatar(AVATARS[id]);
    const [c, ctx] = canvas(1280, 720);
    (COVERS[id] || COVERS["c-quiet"])(ctx, 1280, 720);
    return cache[id] = c.toDataURL("image/jpeg", .92);
  };
  window.fillAssets = root => root.querySelectorAll('img[src^="reel-asset:"]').forEach(im => { im.src = window.reelAsset(im.getAttribute("src").slice(11)); });
})();
