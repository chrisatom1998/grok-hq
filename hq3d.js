// Grok HQ 3D view. Loaded only when the 3D toggle is used. All labels are canvas text.
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const STATUS_COLOR = { working: "#1E86FC", done: "#14C16F", idle: "#959595", waiting_user: "#F59312", error: "#E5484D", unknown: "#777777" };
const FLOOR_H = 2.7, SPACING = 1.7, PER_ROW = 6;

function dark() { return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches; }

function textSprite(lines, opts) {
  // lines: [{text, color, bold}] drawn with fillText only (plain text, never HTML)
  const c = document.createElement("canvas"), W = opts.cw || 512, H = 64 * lines.length + 16;
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = opts.bg; roundRect(g, 4, 4, W - 8, H - 8, 22); g.fill();
  g.textAlign = "center"; g.textBaseline = "middle";
  lines.forEach((l, i) => {
    g.font = (l.bold ? "600 " : "") + (l.size || 38) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    g.fillStyle = l.color;
    let t = String(l.text);
    while (g.measureText(t).width > W - 40 && t.length > 2) t = t.slice(0, -2) + "…";
    g.fillText(t, W / 2, 8 + 64 * i + 32);
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 2;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  const w = opts.width || 1.6; sp.scale.set(w, w * H / W, 1);
  sp.renderOrder = 10;
  return sp;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function disposeTree(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }

function starShape(n, ro, ri) { const s = new THREE.Shape(); for (let i = 0; i < 2 * n; i++) { const r = i % 2 ? ri : ro, a = Math.PI / 2 + i * Math.PI / n; i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a)); } s.closePath(); return s; }

function buildBody(shape, mat) {
  const g = new THREE.Group(), add = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const ext = s => { const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1 }); geo.center(); return geo; };
  switch (shape) {
    case "sphere": add(new THREE.IcosahedronGeometry(0.42, 1)); break;
    case "cloud": add(new THREE.IcosahedronGeometry(0.3, 1), -0.22, -0.05); add(new THREE.IcosahedronGeometry(0.3, 1), 0.22, -0.05); add(new THREE.IcosahedronGeometry(0.34, 1), 0, 0.12); break;
    case "rounded_square": add(new THREE.BoxGeometry(0.7, 0.7, 0.55)); break;
    case "star4": add(ext(starShape(4, 0.5, 0.2))); break;
    case "star6": add(ext(starShape(6, 0.48, 0.28))); break;
    case "clover": [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]].forEach(p => add(new THREE.IcosahedronGeometry(0.24, 1), p[0], p[1])); break;
    case "bubble": add(new THREE.IcosahedronGeometry(0.4, 1)); { const t = add(new THREE.ConeGeometry(0.12, 0.3, 5), -0.22, -0.38); t.rotation.z = -0.5; } break;
    case "flower": for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(new THREE.IcosahedronGeometry(0.17, 0), 0.27 * Math.cos(a), 0.27 * Math.sin(a)); } add(new THREE.IcosahedronGeometry(0.22, 1)); break;
    case "drop": { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, y = 0.5 - t; pts.push(new THREE.Vector2(Math.sin(t * Math.PI * 0.85) * 0.38 * Math.sqrt(t + 0.01), y)); } pts.push(new THREE.Vector2(0, -0.5)); add(new THREE.LatheGeometry(pts, 10)); } break;
    case "pill": { const m = add(new THREE.CapsuleGeometry(0.24, 0.45, 3, 10)); m.rotation.z = Math.PI / 2; } break;
    case "triangle": add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)); break;
    case "pentagon": add(new THREE.CylinderGeometry(0.44, 0.44, 0.35, 5).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)); break;
    case "hexagon": add(new THREE.CylinderGeometry(0.44, 0.44, 0.35, 6).rotateX(Math.PI / 2)); break;
    case "cone": add(new THREE.ConeGeometry(0.4, 0.8, 7)); break;
    case "trio": add(new THREE.IcosahedronGeometry(0.22, 1), 0, 0.2); add(new THREE.IcosahedronGeometry(0.22, 1), -0.24, -0.18); add(new THREE.IcosahedronGeometry(0.22, 1), 0.24, -0.18); break;
    default: add(new THREE.IcosahedronGeometry(0.42, 1));
  }
  return g;
}

function buildAvatar(name, look) {
  const mat = new THREE.MeshStandardMaterial({ color: look.color, flatShading: true, roughness: 0.55, metalness: 0.05, emissive: 0x000000 });
  const root = new THREE.Group(), body = buildBody(look.shape, mat);
  root.add(body);
  const front = look.shape === "rounded_square" ? 0.29 : look.shape === "pill" ? 0.24 : 0.36, ey = look.shape === "trio" ? 0.2 : 0.07;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 }), eyeGeo = new THREE.SphereGeometry(0.055, 8, 6);
  [-0.12, 0.12].forEach(x => { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, ey, front); body.add(e); });
  const dk = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
  if (look.accessory === "glasses") {
    [-0.12, 0.12].forEach(x => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 14), dk); r.position.set(x, ey, front + 0.04); body.add(r); });
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), dk); br.position.set(0, ey, front + 0.04); body.add(br);
  } else if (look.accessory === "antenna") {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0x888888 })); st.position.y = 0.55; body.add(st);
    const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: 0xE5484D, emissive: 0x551111 })); tip.position.y = 0.75; body.add(tip);
  } else if (look.accessory === "bow") {
    const bm = new THREE.MeshStandardMaterial({ color: 0xF93498, flatShading: true });
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), bm); c.rotation.z = s * Math.PI / 2; c.position.set(s * 0.1, 0.5, 0); body.add(c); });
    const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), bm); k.position.y = 0.5; body.add(k);
  } else if (look.accessory === "stem") {
    const gm = new THREE.MeshStandardMaterial({ color: 0x14C16F, flatShading: true });
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 5), gm); st.position.y = 0.52; body.add(st);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), gm); lf.scale.set(1.6, 0.5, 1); lf.position.set(0.1, 0.62, 0); body.add(lf);
  }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9, emissive: 0x000000 }));
  pad.position.y = -0.62; root.add(pad);
  const olMat = new THREE.MeshBasicMaterial({ color: dark() ? 0xffffff : 0x1E86FC, side: THREE.BackSide, transparent: true, opacity: 0.85, depthWrite: false });
  const outline = buildBody(look.shape, olMat); outline.scale.setScalar(1.14); outline.visible = false; body.add(outline);
  body.traverse(o => { o.userData.bot = name; }); pad.userData.bot = name;
  return { root, body, mat, pad, outline };
}

const STATUS_HEX = { working: 0x1E86FC, done: 0x14C16F, idle: 0x959595, waiting_user: 0xF59312, error: 0xE5484D, unknown: 0x777777 };
const easeInOut = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

function wrapText(t, max, lines) {
  const words = String(t).split(/\s+/), out = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w; else if ((cur + " " + w).length <= max) cur += " " + w; else { out.push(cur); cur = w; }
    if (out.length === lines) break;
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].slice(0, max - 1) + "…";
  return out;
}

// Fade an object tree. Original opacity/transparency are remembered per material. Effects (bubbles) manage their own opacity.
function setOpacity(obj, f) {
  obj.traverse(o => {
    if (o.userData.fx || !o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      const u = m.userData;
      if (u.o0 === undefined) { u.o0 = m.opacity; u.t0 = m.transparent; u.d0 = m.depthWrite; }
      const tr = u.t0 || f < 0.999;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = u.o0 * f;
      m.depthWrite = f < 0.999 ? false : u.d0;
    });
  });
}

export function mount(container) {
  const HQ = window.HQ;
  const $ = id => container.querySelector("#" + id);
  const pop = $("v3pop"), tip = $("v3tip"), msg = $("v3msg"), chipsEl = $("v3chips"), q = $("v3q");
  const rotBtn = $("v3rot"), resetBtn = $("v3reset"), pingBtn = $("v3ping"), slider = $("v3slider"), tlabel = $("v3tlabel"), liveBtn = $("v3live");
  const hint = msg.textContent;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;
  container.prepend(renderer.domElement);
  const cv = renderer.domElement;
  cv.setAttribute("aria-label", "3D view of your bots");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const controls = new OrbitControls(camera, cv);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 2.5; controls.maxDistance = 60;
  controls.autoRotateSpeed = 0.8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 12, 8); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  let tower = new THREE.Group(); scene.add(tower);
  const bots = new Map();          // name -> avatar state
  const prev = new Map();          // name -> last live {key, step, t}; survives rebuilds so effects fire only on real changes
  const fx = [];                   // live particle bursts
  let floorsInfo = [], roof = null, signs = [], dims = { H: 2, width: 4.5 }, home = null;
  let sig = "", active = false, raf = 0, firstFit = true, primed = false, lastT = 0;
  let selected = null, hovered = null, focus = null, filter = "all", query = "", replayT = null;
  let autoRot = false, resumeAt = 0, userMoved = false, fly = null, actx = null;
  let ping = false; try { ping = localStorage.getItem("hq.ping") === "1"; } catch (e) {}
  const clock = new THREE.Clock();

  function applyTheme() { const d = dark(); scene.background = new THREE.Color(d ? 0x121316 : 0xdfe6ee); ground.material.color.set(d ? 0x24272d : 0xc9d0d8); }
  applyTheme();
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); sig = ""; sync(); });

  const getStatus = n => replayT == null ? HQ.status(n) : HQ.statusAt(n, replayT);

  function labelFor(name, st) {
    const d = dark();
    return textSprite([{ text: name, color: d ? "#ececf0" : "#1d1d1f", bold: true }, { text: st.label + (st.step ? " · " + st.step : ""), color: STATUS_COLOR[st.key], size: 30 }],
      { bg: d ? "rgba(28,30,35,0.88)" : "rgba(255,255,255,0.9)", width: 2.0 });
  }
  function setStatus(b, name, st) {
    b.st = st;
    if (b.key === st.key && b.step === st.step) return;
    b.key = st.key; b.step = st.step;
    if (b.label) { b.root.remove(b.label); disposeTree(b.label); }
    b.label = labelFor(name, st); b.label.position.y = 1.25; b.root.add(b.label);
    b.pad.material.color.set(STATUS_COLOR[st.key]);
    b.mat.color.set(st.key === "error" ? "#E5484D" : b.color);
    if (b.bang) { b.root.remove(b.bang); disposeTree(b.bang); b.bang = null; }
    if (st.key === "waiting_user") { b.bang = textSprite([{ text: "!", color: "#000", bold: true, size: 54 }], { bg: "#F59312", width: 0.4, cw: 80 }); b.bang.position.y = 1.72; b.root.add(b.bang); }
  }

  // ---------- effects ----------
  function bubble(b, text) {
    if (b.bubble) { b.root.remove(b.bubble.sp); disposeTree(b.bubble.sp); }
    const lines = wrapText(text, 28, 2).map(t => ({ text: t, color: "#1d1d1f", size: 32 }));
    const sp = textSprite(lines, { bg: "rgba(255,255,255,0.96)", width: 2.3 });
    sp.userData.fx = true; sp.position.y = 2.25; b.root.add(sp);
    b.bubble = { sp, born: clock.getElapsedTime(), text: String(text) };
  }
  function burst(b, key) {
    const N = 28, pos = new Float32Array(N * 3), vel = [];
    const o = new THREE.Vector3(); b.root.getWorldPosition(o);
    for (let i = 0; i < N; i++) {
      pos.set([o.x, o.y + 0.1, o.z], i * 3);
      const a = Math.random() * Math.PI * 2, up = 1.2 + Math.random() * 1.6, sp = 0.6 + Math.random() * 1.2;
      vel.push(new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: STATUS_HEX[key] || 0xffffff, size: 0.11, transparent: true, depthWrite: false }));
    scene.add(pts); fx.push({ pts, vel, born: clock.getElapsedTime(), life: 1.1 });
  }
  function playPing() {
    if (!ping || !actx) return;
    try {
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(660, t + 0.3);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.45);
    } catch (e) {}
  }

  // ---------- visibility: floor focus × filters × search ----------
  function matches(n, b) {
    const k = b.st ? b.st.key : "unknown";
    if (filter === "needs" && k !== "waiting_user") return false;
    if (filter === "working" && k !== "working") return false;
    if (filter === "error" && k !== "error") return false;
    if (filter.startsWith("team:") && b.team !== filter.slice(5)) return false;
    if (query && !n.toLowerCase().includes(query)) return false;
    return true;
  }
  function applyVis() {
    floorsInfo.forEach((f, i) => setOpacity(f.group, focus == null || focus === i ? 1 : 0.1));
    if (roof) setOpacity(roof, focus == null ? 1 : 0.1);
    bots.forEach((b, n) => {
      const fo = focus == null || focus === b.floor ? 1 : 0.1, m = matches(n, b) ? 1 : 0.15;
      b.vis = fo * m; setOpacity(b.root, b.vis);
    });
    msg.textContent = focus != null && floorsInfo[focus] ? "Floor " + (focus + 1) + " · " + floorsInfo[focus].name + " — Esc or Reset view for the whole tower" : hint;
  }

  // ---------- chips / filters ----------
  function buildChips(M) {
    const defs = [["all", "All"], ["needs", "Needs you"], ["working", "Working"], ["error", "Error"]].concat(M.order.map(g => ["team:" + g, g]));
    if (!defs.some(d => d[0] === filter)) filter = "all";
    chipsEl.replaceChildren();
    defs.forEach(([f, label]) => {
      const c = document.createElement("button"); c.type = "button"; c.className = "tog sm chip"; c.dataset.f = f;
      const l = document.createElement("span"); l.textContent = label; const ct = document.createElement("span"); ct.className = "ct";
      c.append(l, ct); c.setAttribute("aria-pressed", f === filter ? "true" : "false");
      c.addEventListener("click", () => { filter = f; chipsEl.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.f === f ? "true" : "false")); applyVis(); });
      chipsEl.appendChild(c);
    });
  }
  function chipCounts() {
    const cnt = { all: 0, needs: 0, working: 0, error: 0 };
    bots.forEach(b => { cnt.all++; const k = b.st.key; if (k === "waiting_user") cnt.needs++; if (k === "working") cnt.working++; if (k === "error") cnt.error++; cnt["team:" + b.team] = (cnt["team:" + b.team] || 0) + 1; });
    chipsEl.querySelectorAll(".chip").forEach(c => { c.querySelector(".ct").textContent = " " + (cnt[c.dataset.f] || 0); });
  }
  q.addEventListener("input", () => { query = q.value.trim().toLowerCase(); applyVis(); });
  q.addEventListener("keydown", e => { if (e.key === "Escape") { q.value = ""; query = ""; q.blur(); resetView(); e.stopPropagation(); } });

  // ---------- tower ----------
  function aspectFactor() { return camera.aspect < 1 ? Math.min(2.2, Math.max(1, 0.85 / camera.aspect)) : 1; }
  function computeHome() {
    const H = dims.H, dist = Math.max(6.5, H * 1.05 + dims.width * 0.55) * aspectFactor();
    home = { target: new THREE.Vector3(0, H / 2, 0), pos: new THREE.Vector3(dist * 0.45, H / 2 + dist * 0.3, dist * 0.85) };
  }
  function rebuild(M) {
    scene.remove(tower); disposeTree(tower); tower = new THREE.Group(); scene.add(tower); bots.clear(); floorsInfo = []; signs = [];
    const floors = M.order.slice().reverse(); // ground floor first (Ops)
    const maxPer = Math.max(1, ...floors.map(g => Math.min(PER_ROW, M.floors[g].length)));
    const width = Math.max(4.5, maxPer * SPACING + 1.2);
    let y = 0;
    const d = dark();
    floors.forEach((g, fi) => {
      const names = M.floors[g], rows = Math.ceil(names.length / PER_ROW), depth = Math.max(3.2, rows * SPACING + 1.2), h = FLOOR_H;
      const fg = new THREE.Group(); tower.add(fg);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, depth), new THREE.MeshStandardMaterial({ color: d ? 0x2f343c : 0xf3f1ec, roughness: 0.8 }));
      slab.position.set(0, y, 0); fg.add(slab);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), new THREE.MeshStandardMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.BackSide }));
      glass.position.set(0, y + h / 2, 0); fg.add(glass);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: d ? 0x5a6170 : 0x9aa3ae, transparent: true, opacity: 0.6 }));
      edges.position.copy(glass.position); fg.add(edges);
      const sign = textSprite([{ text: "Floor " + (fi + 1) + " · " + g, color: d ? "#c4c4cc" : "#444", bold: true, size: 34 }], { bg: d ? "rgba(18,19,22,0.85)" : "rgba(255,255,255,0.9)", width: 2.2 });
      sign.position.set(-width / 2 + 1.1, y + h - 0.25, depth / 2 + 0.05); sign.userData.floor = fi; fg.add(sign); signs.push(sign);
      floorsInfo.push({ group: fg, y, h, width, depth, name: g });
      names.forEach((n, i) => {
        const r = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, names.length - r * PER_ROW), col = i % PER_ROW;
        const look = HQ.look(n), a = buildAvatar(n, look);
        a.root.position.set((col - (inRow - 1) / 2) * SPACING, y + 0.75, (r - (rows - 1) / 2) * SPACING);
        tower.add(a.root);
        const b = { ...a, color: look.color, baseY: a.root.position.y, phase: Math.random() * 6, floor: fi, team: g, hs: 1, hop: -9, vis: 1 };
        bots.set(n, b); setStatus(b, n, getStatus(n));
      });
      y += h;
    });
    roof = null;
    if (floors.length) { roof = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 3.2), new THREE.MeshStandardMaterial({ color: d ? 0x2f343c : 0xf3f1ec })); roof.position.y = y; tower.add(roof); }
    if (focus != null && focus >= floorsInfo.length) focus = null;
    if (hovered && !bots.has(hovered)) setHover(null);
    dims = { H: Math.max(y, 2), width };
    computeHome();
    if (firstFit || !floors.length) { controls.target.copy(home.target); camera.position.copy(home.pos); controls.update(); firstFit = !floors.length; }
    buildChips(M);
  }

  function sync() {
    const M = HQ.model();
    const s = JSON.stringify([M.order, M.order.map(g => M.floors[g]), M.names.map(n => HQ.look(n))]);
    if (s !== sig) { sig = s; rebuild(M); } else bots.forEach((b, n) => setStatus(b, n, getStatus(n)));
    if (replayT == null) {
      bots.forEach((b, n) => {
        const st = b.st, p = prev.get(n);
        if (primed && p) {
          if (st.step && st.step !== p.step) bubble(b, st.step);
          if (st.key !== p.key) { burst(b, st.key); if (st.key === "waiting_user") playPing(); }
        }
        prev.set(n, { key: st.key, step: st.step });
      });
      if (bots.size) primed = true;
    }
    chipCounts(); applyVis(); timeline();
    if (selected) showPop(selected, true);
  }

  // ---------- timeline ----------
  const tfmt = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function timeline() {
    const mid = new Date(); mid.setHours(0, 0, 0, 0);
    const today = HQ.history().filter(h => h.t >= mid.getTime());
    liveBtn.setAttribute("aria-pressed", replayT == null ? "true" : "false");
    container.classList.toggle("replay", replayT != null);
    if (!today.length) { slider.disabled = true; tlabel.textContent = "Live · no activity today yet"; return; }
    slider.disabled = false;
    const min = Math.floor(today[0].t / 1000) - 1, max = Math.ceil(Math.max(Date.now(), today[today.length - 1].t) / 1000);
    slider.min = String(min); slider.max = String(max); slider.step = "1";
    if (replayT == null) { slider.value = String(max); tlabel.textContent = "Live · " + today.length + " update" + (today.length === 1 ? "" : "s") + " today"; }
    else { const k = today.filter(h => h.t <= replayT).length; tlabel.textContent = "Replay " + tfmt(replayT) + " · " + k + "/" + today.length; }
  }
  slider.addEventListener("input", () => { const v = +slider.value; replayT = v >= +slider.max ? null : v * 1000; sync(); });
  liveBtn.addEventListener("click", () => { replayT = null; sync(); });

  // ---------- popup ----------
  function btn(text, cls, fn) { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text; b.addEventListener("click", fn); return b; }
  function showPop(name, refresh) {
    if (!bots.has(name)) { closePop(); return; }
    selected = name;
    if (refresh && pop.contains(document.activeElement)) return; // don't yank focus from a button mid-use
    const c = HQ.card(name);
    c.querySelectorAll("a").forEach(a => a.remove());
    const act = document.createElement("div"); act.className = "v3act";
    const link = HQ.chat(name);
    if (link) { const a = document.createElement("a"); a.className = "tog sm pri"; a.href = link; a.textContent = "Open chat"; act.appendChild(a); }
    act.append(btn("Back to tower", "tog sm", resetView), btn("Close", "tog sm", closePop));
    c.appendChild(act); pop.replaceChildren(c); pop.hidden = false;
  }
  function closePop() { pop.hidden = true; pop.replaceChildren(); selected = null; }

  // ---------- camera moves ----------
  function flyTo(pos, target, dur) { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, s: clock.getElapsedTime(), d: dur || 0.9 }; }
  const narrow = () => container.clientWidth < 600;
  function selectBot(n) {
    const b = bots.get(n); if (!b) return;
    b.hop = clock.getElapsedTime();
    const tgt = new THREE.Vector3(); b.root.getWorldPosition(tgt); tgt.y = b.baseY + 0.3;
    const dir = camera.position.clone().sub(controls.target).normalize(); dir.y = Math.max(dir.y, 0.3); dir.normalize();
    const look = tgt.clone(); if (narrow()) look.y -= 0.7; // keep the bot above the bottom sheet on phones
    flyTo(look.clone().add(dir.multiplyScalar(4.2 * Math.min(aspectFactor(), 1.4))), look);
    showPop(n);
  }
  function focusFloor(i) {
    const f = floorsInfo[i]; if (!f) return;
    focus = i; applyVis();
    const tgt = new THREE.Vector3(0, f.y + 1.1, 0), dist = Math.max(5, f.width * 0.95 + 1.5) * aspectFactor();
    flyTo(new THREE.Vector3(dist * 0.3, f.y + 1.1 + dist * 0.28, dist * 0.95), tgt);
  }
  function resetView() { focus = null; applyVis(); closePop(); computeHome(); flyTo(home.pos.clone(), home.target.clone()); }
  resetBtn.addEventListener("click", resetView);

  // ---------- auto-rotate (pauses while you interact) ----------
  function setRot(on) { autoRot = on; rotBtn.setAttribute("aria-pressed", on ? "true" : "false"); resumeAt = 0; }
  rotBtn.addEventListener("click", () => setRot(!autoRot));
  controls.addEventListener("start", () => { fly = null; userMoved = true; resumeAt = Infinity; });
  controls.addEventListener("end", () => { resumeAt = performance.now() + 4000; });

  function setPing(on) { ping = on; pingBtn.setAttribute("aria-pressed", on ? "true" : "false"); pingBtn.textContent = on ? "Ping on" : "Ping off"; try { localStorage.setItem("hq.ping", on ? "1" : "0"); } catch (e) {} }
  pingBtn.addEventListener("click", () => {
    if (!actx && window.AudioContext) { try { actx = new AudioContext(); } catch (e) {} }
    setPing(!ping); if (ping) playPing();
  });
  setPing(ping);

  // ---------- picking, hover, tap ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  function pick(x, y) {
    const r = cv.getBoundingClientRect();
    ptr.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const targets = [...bots.values()].flatMap(b => [b.body, b.pad]).concat(signs);
    const hit = ray.intersectObjects(targets, true).find(h => h.object.userData.bot || h.object.userData.floor !== undefined);
    if (!hit) return null;
    return hit.object.userData.bot ? { bot: hit.object.userData.bot } : { floor: hit.object.userData.floor };
  }
  function setHover(n, e) {
    if (hovered && hovered !== n && bots.has(hovered)) bots.get(hovered).outline.visible = false;
    hovered = n;
    if (!n || !bots.has(n)) { hovered = null; tip.hidden = true; return; }
    bots.get(n).outline.visible = true;
    const st = getStatus(n);
    const nm = document.createElement("div"); nm.className = "name"; nm.textContent = n;
    const ln = document.createElement("div"); const pill = document.createElement("span"); pill.className = "pill s-" + st.key; pill.textContent = st.label; ln.appendChild(pill);
    if (st.t) { const a = document.createElement("span"); a.className = "small"; a.textContent = " · " + HQ.ago(st.t); ln.appendChild(a); }
    tip.replaceChildren(nm, ln);
    if (st.step) { const s = document.createElement("div"); s.className = "step"; s.textContent = st.step; tip.appendChild(s); }
    tip.hidden = false;
    if (e) { const r = container.getBoundingClientRect(); const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 8), y = Math.min(e.clientY - r.top + 14, r.height - tip.offsetHeight - 8); tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; }
  }
  cv.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    if (e.buttons) { setHover(null); cv.style.cursor = "grabbing"; return; }
    const h = pick(e.clientX, e.clientY);
    setHover(h && h.bot || null, e); cv.style.cursor = h ? "pointer" : "";
  });
  cv.addEventListener("pointerleave", () => { setHover(null); cv.style.cursor = ""; });
  cv.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY, e.pointerType]; });
  cv.addEventListener("pointerup", e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), tol = down[2] === "mouse" ? 5 : 12; down = null;
    if (moved > tol) return;
    const h = pick(e.clientX, e.clientY);
    if (h && h.bot) selectBot(h.bot); else if (h) focusFloor(h.floor); else closePop();
  });
  function onKey(e) {
    if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "Escape") { resetView(); return; }
    if (/^[1-9]$/.test(e.key) && +e.key <= floorsInfo.length) focusFloor(+e.key - 1);
  }
  window.addEventListener("keydown", onKey);

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    computeHome();
    if (!userMoved && !fly && focus == null) { controls.target.copy(home.target); camera.position.copy(home.pos); }
  }
  new ResizeObserver(resize).observe(container);

  // ---------- render loop (paused when hidden or in 2D) ----------
  function frame() {
    raf = 0;
    if (!active || document.hidden) return;
    const t = clock.getElapsedTime(), dt = Math.min(0.05, t - lastT); lastT = t;
    bots.forEach((b, n) => {
      const k = b.key; let y = b.baseY, pulse = 1;
      b.mat.emissive.set(0x000000); b.mat.emissiveIntensity = 1;
      if (k === "working") {
        y += Math.sin(t * 3 + b.phase) * 0.12;
        b.body.rotation.y = Math.sin(t * 1.5 + b.phase) * 0.35;
        b.mat.emissive.set(b.color); b.mat.emissiveIntensity = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(t * 4 + b.phase));
      } else if (k === "waiting_user") {
        const p = 0.5 + 0.5 * Math.sin(t * 5);
        b.mat.emissive.set(0xF59312); b.mat.emissiveIntensity = 0.25 + 0.55 * p; pulse = 1 + 0.06 * p;
        if (b.bang) b.bang.position.y = 1.72 + 0.08 * Math.sin(t * 5);
      } else {
        if (k === "error") b.mat.emissive.set(0x400808);
        b.body.rotation.y += (0 - b.body.rotation.y) * 0.05;
      }
      const hov = n === hovered || n === selected;
      if (hov) { if (k !== "working" && k !== "waiting_user" && k !== "error") b.mat.emissive.set(b.color); b.mat.emissiveIntensity = Math.min(1, b.mat.emissiveIntensity * (k === "idle" || k === "done" || k === "unknown" ? 0.35 : 1) + 0.3); }
      b.hs += ((hov ? 1.15 : 1) - b.hs) * Math.min(1, dt * 12);
      const hp = (t - b.hop) / 0.8;
      if (hp >= 0 && hp < 1) { y += Math.sin(Math.PI * hp) * 0.5; b.body.rotation.z = Math.sin(hp * Math.PI * 4) * 0.3 * (1 - hp); } else b.body.rotation.z = 0;
      b.root.position.y = y; b.body.scale.setScalar(b.hs * pulse);
      if (b.bubble) {
        const age = t - b.bubble.born, o = age < 4 ? 1 : Math.max(0, 1 - (age - 4));
        b.bubble.sp.material.opacity = o * b.vis; b.bubble.sp.position.y = 2.25 + Math.min(age, 0.3) * 0.3;
        if (o <= 0) { b.root.remove(b.bubble.sp); disposeTree(b.bubble.sp); b.bubble = null; }
      }
    });
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], age = t - f.born, a = f.pts.geometry.attributes.position;
      if (age > f.life) { scene.remove(f.pts); disposeTree(f.pts); fx.splice(i, 1); continue; }
      f.vel.forEach((v, j) => { v.y -= 4 * dt; a.setXYZ(j, a.getX(j) + v.x * dt, a.getY(j) + v.y * dt, a.getZ(j) + v.z * dt); });
      a.needsUpdate = true; f.pts.material.opacity = 1 - age / f.life;
    }
    if (fly) {
      const k = Math.min(1, (t - fly.s) / fly.d), e = easeInOut(k);
      camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (k >= 1) fly = null;
    }
    controls.autoRotate = autoRot && !fly && performance.now() > resumeAt;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (active && !document.hidden && !raf) { lastT = clock.getElapsedTime(); raf = requestAnimationFrame(frame); } }
  document.addEventListener("visibilitychange", kick);

  HQ.onRender(() => { if (active) sync(); });
  const v = new THREE.Vector3();
  function screenOf(obj) { obj.getWorldPosition(v); v.project(camera); const r = cv.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }
  const api = {
    setActive(on) { active = on; if (on) { resize(); sync(); kick(); } else { if (raf) { cancelAnimationFrame(raf); raf = 0; } setHover(null); } },
    // test hooks: names/status/geometry only, nothing from the topic
    debug: {
      count: () => bots.size, status: n => bots.has(n) ? bots.get(n).key : null, running: () => !!raf,
      screenPos: n => bots.has(n) ? screenOf(bots.get(n).body) : null, signPos: i => signs[i] ? screenOf(signs[i]) : null,
      hovered: () => hovered, selected: () => selected, focus: () => focus, vis: n => bots.has(n) ? bots.get(n).vis : null,
      flying: () => !!fly, scale: n => bots.has(n) ? bots.get(n).hs : null, target: () => controls.target.toArray().map(x => +x.toFixed(2)),
      camDist: () => +camera.position.distanceTo(controls.target).toFixed(2), bubble: n => bots.has(n) && bots.get(n).bubble ? bots.get(n).bubble.text : null,
      bursts: () => fx.length, replay: () => replayT, autoRotate: () => controls.autoRotate, floors: () => floorsInfo.length, ping: () => ping
    }
  };
  window.HQ3D = api.debug;
  return api;
}
