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
  body.traverse(o => { o.userData.bot = name; }); pad.userData.bot = name;
  return { root, body, mat, pad };
}

export function mount(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "3D view of your bots");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 3; controls.maxDistance = 60;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 12, 8); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  let tower = new THREE.Group(); scene.add(tower);
  const bots = new Map(); // name -> {root, body, mat, pad, label, bang, key, step, baseY}
  let sig = "", active = false, raf = 0, firstFit = true, selected = null;
  const pop = container.querySelector("#v3pop"), clock = new THREE.Clock();

  function applyTheme() { const d = dark(); scene.background = new THREE.Color(d ? 0x121316 : 0xdfe6ee); ground.material.color.set(d ? 0x24272d : 0xc9d0d8); }
  applyTheme();
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); sig = ""; sync(); });

  function labelFor(name, st) {
    const d = dark();
    return textSprite([{ text: name, color: d ? "#ececf0" : "#1d1d1f", bold: true }, { text: st.label + (st.step ? " · " + st.step : ""), color: STATUS_COLOR[st.key], size: 30 }],
      { bg: d ? "rgba(28,30,35,0.88)" : "rgba(255,255,255,0.9)", width: 2.0 });
  }
  function setStatus(b, name) {
    const st = window.HQ.status(name);
    if (b.key === st.key && b.step === st.step) return;
    b.key = st.key; b.step = st.step;
    if (b.label) { b.root.remove(b.label); disposeTree(b.label); }
    b.label = labelFor(name, st); b.label.position.y = 1.25; b.root.add(b.label);
    b.pad.material.color.set(STATUS_COLOR[st.key]);
    b.mat.color.set(st.key === "error" ? "#E5484D" : b.color);
    b.mat.emissive.set(0x000000); b.mat.emissiveIntensity = 1;
    if (b.bang) { b.root.remove(b.bang); disposeTree(b.bang); b.bang = null; }
    if (st.key === "waiting_user") { b.bang = textSprite([{ text: "!", color: "#000", bold: true, size: 54 }], { bg: "#F59312", width: 0.4, cw: 80 }); b.bang.position.y = 1.72; b.root.add(b.bang); }
    if (st.key === "error") b.mat.emissive.set(0x400808);
    b.root.userData.status = st.key;
  }

  function rebuild(M) {
    scene.remove(tower); disposeTree(tower); tower = new THREE.Group(); scene.add(tower); bots.clear();
    const floors = M.order.slice().reverse(); // ground floor first (Ops)
    const maxPer = Math.max(1, ...floors.map(g => Math.min(PER_ROW, M.floors[g].length)));
    const width = Math.max(4.5, maxPer * SPACING + 1.2);
    let y = 0;
    const d = dark();
    floors.forEach((g, fi) => {
      const names = M.floors[g], rows = Math.ceil(names.length / PER_ROW), depth = Math.max(3.2, rows * SPACING + 1.2), h = FLOOR_H;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, depth), new THREE.MeshStandardMaterial({ color: d ? 0x2f343c : 0xf3f1ec, roughness: 0.8 }));
      slab.position.set(0, y, 0); tower.add(slab);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), new THREE.MeshStandardMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.BackSide }));
      glass.position.set(0, y + h / 2, 0); tower.add(glass);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: d ? 0x5a6170 : 0x9aa3ae, transparent: true, opacity: 0.6 }));
      edges.position.copy(glass.position); tower.add(edges);
      const sign = textSprite([{ text: "Floor " + (fi + 1) + " · " + g, color: d ? "#9a9aa3" : "#555", bold: true, size: 34 }], { bg: d ? "rgba(18,19,22,0.8)" : "rgba(255,255,255,0.85)", width: 2.2 });
      sign.position.set(-width / 2 + 1.1, y + h - 0.25, depth / 2 + 0.05); tower.add(sign);
      names.forEach((n, i) => {
        const r = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, names.length - r * PER_ROW), col = i % PER_ROW;
        const look = window.HQ.look(n), a = buildAvatar(n, look);
        a.root.position.set((col - (inRow - 1) / 2) * SPACING, y + 0.75, (r - (rows - 1) / 2) * SPACING);
        tower.add(a.root);
        const b = { ...a, color: look.color, baseY: a.root.position.y, phase: Math.random() * 6 };
        bots.set(n, b); setStatus(b, n);
      });
      y += h;
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 3.2), new THREE.MeshStandardMaterial({ color: d ? 0x2f343c : 0xf3f1ec }));
    roof.position.y = y; if (floors.length) tower.add(roof);
    if (firstFit || !floors.length) {
      const H = Math.max(y, 2);
      controls.target.set(0, H / 2, 0);
      const dist = Math.max(6.5, H * 1.05 + width * 0.55);
      camera.position.set(dist * 0.45, H / 2 + dist * 0.3, dist * 0.85);
      controls.update(); firstFit = !floors.length;
    }
  }

  function sync() {
    const M = window.HQ.model();
    const s = JSON.stringify([M.order, M.order.map(g => M.floors[g]), M.names.map(n => window.HQ.look(n))]);
    if (s !== sig) { sig = s; rebuild(M); } else bots.forEach((b, n) => setStatus(b, n));
    if (selected) showPop(selected);
  }

  function showPop(name) {
    selected = name; pop.replaceChildren();
    if (!bots.has(name)) { pop.hidden = true; selected = null; return; }
    const c = window.HQ.card(name), x = document.createElement("button");
    x.className = "x"; x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Close");
    x.addEventListener("click", () => { pop.hidden = true; selected = null; });
    c.prepend(x); pop.appendChild(c); pop.hidden = false;
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects([...bots.values()].flatMap(b => [b.body, b.pad]), true);
    const hit = hits.find(h => h.object.userData.bot);
    if (hit) showPop(hit.object.userData.bot); else { pop.hidden = true; selected = null; }
  });

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  function frame() {
    raf = 0;
    if (!active || document.hidden) return;
    const t = clock.getElapsedTime();
    bots.forEach(b => {
      const k = b.key;
      if (k === "working") {
        b.root.position.y = b.baseY + Math.sin(t * 3 + b.phase) * 0.12;
        b.body.rotation.y = Math.sin(t * 1.5 + b.phase) * 0.35;
        b.mat.emissive.set(b.color); b.mat.emissiveIntensity = 0.25 + 0.2 * (0.5 + 0.5 * Math.sin(t * 4 + b.phase));
      } else if (k === "waiting_user") {
        const p = 0.5 + 0.5 * Math.sin(t * 5);
        b.mat.emissive.set(0xF59312); b.mat.emissiveIntensity = 0.25 + 0.55 * p;
        b.body.scale.setScalar(1 + 0.06 * p); b.root.position.y = b.baseY;
        if (b.bang) b.bang.position.y = 1.72 + 0.08 * Math.sin(t * 5);
      } else {
        b.root.position.y = b.baseY; b.body.scale.setScalar(1);
        b.body.rotation.y += (0 - b.body.rotation.y) * 0.05;
      }
    });
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (active && !document.hidden && !raf) { clock.getDelta(); raf = requestAnimationFrame(frame); } }
  document.addEventListener("visibilitychange", kick);

  window.HQ.onRender(() => { if (active) sync(); });
  const api = {
    setActive(on) { active = on; if (on) { resize(); sync(); kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    // test hooks (names/status only; no topic or feed data beyond what's on screen)
    debug: { count: () => bots.size, status: n => bots.has(n) ? bots.get(n).key : null, running: () => !!raf,
      screenPos: n => { const b = bots.get(n); if (!b) return null; const v = new THREE.Vector3(); b.body.getWorldPosition(v); v.project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; } }
  };
  window.HQ3D = api.debug;
  return api;
}
