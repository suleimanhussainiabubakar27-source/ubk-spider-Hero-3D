import * as THREE from 'three';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const show = (id, on = true) => $(id).classList.toggle('hidden', !on);

function boot() {
  // ---------- Renderer ----------
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { show('error'); show('menu', false); return; }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  $('game').appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const QUAL = ['low', 'med', 'high'], CAPS = { low: 0.7, med: 1, high: 1.5 };
  const CAMD = [['Near', 7], ['Normal', 10], ['Far', 14]];
  const S = { state: 'menu', score: 0, tokens: 0, mission: 0, q: (navigator.deviceMemory && navigator.deviceMemory <= 3) ? 0 : 1, camD: 1 };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0c8a8, 140, 520);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 16, 10), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(0x3f6fc4) }, bot: { value: new THREE.Color(0xf0c8a8) } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,bot;varying float h;void main(){gl_FragColor=linearToOutputTexel(vec4(mix(bot,top,smoothstep(-0.05,0.6,h)),1.));}' }));
  scene.add(sky);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 800);
  const sun = new THREE.DirectionalLight(0xffe2bd, 2.0);
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 200;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xcfe6ff, 0x4a4f5a, 1.1));

  function applyQuality() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CAPS[QUAL[S.q]]));
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    sun.castShadow = QUAL[S.q] !== 'low';
  }
  addEventListener('resize', applyQuality);

  // ---------- City (procedural, instanced) ----------
  let seed = 7;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = 6, P = 64;
  const boxes = []; // {x0,x1,z0,z1,h}
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x2b2e35 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
  const cnt = (2 * N + 1) ** 2;
  const winMat = () => {
    const on = Array.from({ length: 16 }, () => rnd() < 0.35);
    const mk = lit => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.fillStyle = lit ? '#000' : '#e8ecf2'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const o = on[y * 4 + x]; g.fillStyle = lit ? (o ? '#ffd9a0' : '#000') : (o ? '#c9b48a' : '#4a6a8f'); g.fillRect(x * 32 + 6, y * 32 + 7, 20, 18); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const m = new THREE.MeshLambertMaterial({ map: mk(false), emissiveMap: mk(true), emissive: 0xffffff, emissiveIntensity: 0.55 });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float hz = abs(normal.x) > 0.5 ? isc.z : isc.x;
        vMapUv = uv * vec2(hz, isc.y) / 16.0; vEmissiveMapUv = vMapUv;`);
    };
    return m;
  };
  const bMesh = new THREE.InstancedMesh(unit, winMat(), cnt * 8);
  const slab = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: 0x8d9199 }), cnt);
  const poles = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: 0x333333 }), cnt * 4);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), cnt * 4);
  const trunk = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: 0x5b3a22 }), cnt * 6);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0x2f7d3a }), cnt * 6);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const put = (mesh, i, x, y, z, sx, sy, sz) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
  let bi = 0, si = 0, pi = 0, ti = 0;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const cx = i * P, cz = j * P;
    put(slab, si++, cx, 0, cz, 52, 0.25, 52);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const w = 14 + rnd() * 8, d = 14 + rnd() * 8, h = 18 + Math.pow(rnd(), 1.6) * 125;
      const x = cx + sx * 14, z = cz + sz * 14;
      const hue = 0.56 + rnd() * 0.1, sat = 0.1 + rnd() * 0.2, lit = 0.4 + rnd() * 0.3;
      put(bMesh, bi, x, 0, z, w, h, d); bMesh.setColorAt(bi++, col.setHSL(hue, sat, lit));
      boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
      if (h > 70 && rnd() < 0.6) { // stepped tower top
        const w2 = w * 0.62, d2 = d * 0.62, h2 = 10 + rnd() * 30;
        put(bMesh, bi, x, h, z, w2, h2, d2); bMesh.setColorAt(bi++, col.setHSL(hue, sat, lit * 0.85));
        boxes.push({ x0: x - w2 / 2, x1: x + w2 / 2, z0: z - d2 / 2, z1: z + d2 / 2, h: h + h2 });
      }
      put(poles, pi, cx + sx * 27.5, 0, cz + sz * 27.5, 0.3, 6, 0.3);
      put(lamps, pi++, cx + sx * 27.5, 6.2, cz + sz * 27.5, 1, 1, 1);
    }
    for (let k = 0; k < 6; k++) {
      const x = cx + (k % 2 ? 28.6 : -28.6), z = cz + (k - 2.5) * 9;
      put(trunk, ti, x, 0, z, 0.5, 2, 0.5); put(crown, ti++, x, 2.4, z, 1.5, 1.5, 1.5);
    }
  }
  bMesh.count = bi; bMesh.receiveShadow = true; slab.receiveShadow = true;
  const UPY = new THREE.Vector3(0, 1, 0);
  // road markings + traffic
  const ROADS = []; for (let i = -N - 1; i <= N; i++) ROADS.push(i * P + 32);
  const EXT = N * P + 60, lines = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: 0xe9e2c8 }), ROADS.length * 2 * 110);
  let li = 0;
  for (const r of ROADS) for (let t = -EXT; t < EXT && li < lines.count - 1; t += 9) { put(lines, li++, r, 0, t, 0.3, 0.04, 4); put(lines, li++, t, 0, r, 4, 0.04, 0.3); }
  lines.count = li; lines.instanceMatrix.needsUpdate = true; scene.add(lines);
  const cars = [], carMesh = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial(), 56), cq = new THREE.Quaternion(), cv = new THREE.Vector3(), cs = new THREE.Vector3(2, 1.3, 4.2), cm = new THREE.Matrix4();
  for (let i = 0; i < 56; i++) {
    const dir = rnd() < 0.5 ? 1 : -1;
    cars.push({ alongZ: i % 2 === 0, lane: ROADS[Math.floor(rnd() * ROADS.length)] + dir * 2.6, t: (rnd() * 2 - 1) * EXT, v: dir * (8 + rnd() * 8) });
    carMesh.setColorAt(i, col.setHSL(rnd(), 0.6, 0.45));
  }
  carMesh.instanceColor.needsUpdate = true; scene.add(carMesh);
  function updateCars(dt) {
    cars.forEach((c, i) => {
      c.t += c.v * dt; if (c.t > EXT) c.t = -EXT; else if (c.t < -EXT) c.t = EXT;
      cq.setFromAxisAngle(UPY, c.alongZ ? 0 : Math.PI / 2);
      cm.compose(c.alongZ ? cv.set(c.lane, 0.25, c.t) : cv.set(c.t, 0.25, c.lane), cq, cs); carMesh.setMatrixAt(i, cm);
    });
    carMesh.instanceMatrix.needsUpdate = true;
  }
  for (const mesh of [bMesh, slab, poles, lamps, trunk, crown]) { mesh.instanceMatrix.needsUpdate = true; scene.add(mesh); }
  bMesh.instanceColor.needsUpdate = true;

  const cloudG = new THREE.SphereGeometry(1, 6, 4), cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(cloudG, cloudM); s.scale.set(14 + rnd() * 10, 5, 9); s.position.set(k * 14 - 14, rnd() * 3, 0); c.add(s); }
    c.position.set((rnd() - 0.5) * 900, 190 + rnd() * 60, (rnd() - 0.5) * 900); scene.add(c); clouds.push(c);
  }

  // ---------- Hero (procedural, original design) ----------
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const RED = mat(0xc8102e), DRK = mat(0x181822), TRIM = mat(0xff5468);
  const hero = new THREE.Group(), body = new THREE.Group(); hero.add(body);
  const part = (geo, mt, x, y, z, parent = body, sc) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); if (sc) o.scale.set(sc[0], sc[1], sc[2]); o.castShadow = true; parent.add(o); return o; };
  const grp = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  part(new THREE.CylinderGeometry(0.26, 0.23, 0.26, 10), DRK, 0, 0.93, 0, body, [1, 1, 0.7]);
  part(new THREE.CylinderGeometry(0.37, 0.25, 0.6, 10), RED, 0, 1.3, 0, body, [1, 1, 0.66]);
  part(new THREE.CylinderGeometry(0.265, 0.265, 0.06, 10), TRIM, 0, 1.03, 0, body, [1, 1, 0.7]);
  for (const sd of [-1, 1]) part(new THREE.BoxGeometry(0.05, 0.5, 0.2), DRK, sd * 0.3, 1.3, 0);
  part(new THREE.OctahedronGeometry(0.11), DRK, 0, 1.4, 0.19, body, [1, 1.3, 0.3]);
  part(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 8), DRK, 0, 1.66, 0);
  part(new THREE.SphereGeometry(0.2, 12, 10), RED, 0, 1.82, 0, body, [0.92, 1.1, 1]);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xaaf8ff });
  for (const sd of [-1, 1]) { const e = part(new THREE.BoxGeometry(0.115, 0.055, 0.03), eyeM, sd * 0.085, 1.84, 0.185); e.rotation.z = -sd * 0.4; e.castShadow = false; }
  const arm = sd => {
    const sh = grp(sd * 0.44, 1.52, 0, body); part(new THREE.SphereGeometry(0.13, 8, 6), DRK, 0, 0, 0, sh);
    part(new THREE.CylinderGeometry(0.085, 0.07, 0.32, 8), RED, 0, -0.17, 0, sh);
    const el = grp(0, -0.33, 0, sh); part(new THREE.SphereGeometry(0.07, 6, 5), DRK, 0, 0, 0, el);
    part(new THREE.CylinderGeometry(0.07, 0.055, 0.3, 8), RED, 0, -0.16, 0, el);
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 8), TRIM, 0, -0.3, 0, el);
    part(new THREE.SphereGeometry(0.075, 8, 6), DRK, 0, -0.38, 0, el, [1, 1.2, 1]);
    return [sh, el];
  };
  const leg = sd => {
    const hp = grp(sd * 0.15, 0.88, 0, body); part(new THREE.CylinderGeometry(0.135, 0.1, 0.42, 8), RED, 0, -0.21, 0, hp);
    const kn = grp(0, -0.42, 0, hp); part(new THREE.SphereGeometry(0.095, 6, 5), DRK, 0, 0, 0, kn);
    part(new THREE.CylinderGeometry(0.1, 0.075, 0.38, 8), RED, 0, -0.19, 0, kn);
    part(new THREE.CylinderGeometry(0.085, 0.09, 0.16, 8), DRK, 0, -0.3, 0, kn);
    part(new THREE.BoxGeometry(0.15, 0.1, 0.3), DRK, 0, -0.41, 0.06, kn);
    return [hp, kn];
  };
  const [sL, eL] = arm(-1), [sR, eR] = arm(1), [hL, kL] = leg(-1), [hR, kR] = leg(1);
  scene.add(hero);

  // ---------- Rope ----------
  const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
  ropeMesh.visible = false; scene.add(ropeMesh);

  // ---------- State ----------
  const SPAWN = new THREE.Vector3(32, 0, 32);
  const pos = SPAWN.clone(), vel = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  let rope = false, ropeLen = 0, rp = 1, onGround = false, climb = null, heading = 0, phase = 0, smoothFov = 62, jumpBuf = 0, coyote = 0, landT = 0, stretchT = 0, camIdle = 0;
  const ctg = new THREE.Vector3(32, 1.6, 32), want = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const cam = { yaw: 0.6, pitch: 0.28, dist: 10 };
  const K = { w: 0, a: 0, s: 0, d: 0 }, P_ = { jump: false, web: false, rel: false };
  const joy = { x: 0, y: 0 };

  // ---------- Collision ----------
  const HW = 0.4, HT = 1.8;
  function collide() {
    for (const b of boxes) {
      if (pos.x + HW <= b.x0 || pos.x - HW >= b.x1 || pos.z + HW <= b.z0 || pos.z - HW >= b.z1 || pos.y >= b.h || pos.y + HT <= 0) continue;
      const pxL = pos.x + HW - b.x0, pxR = b.x1 - (pos.x - HW), pzL = pos.z + HW - b.z0, pzR = b.z1 - (pos.z - HW), py = b.h - pos.y;
      const mn = Math.min(pxL, pxR, pzL, pzR);
      if (py < 0.6 || py < mn) { pos.y = b.h; if (vel.y < 0) vel.y = 0; onGround = true; continue; }
      let nx = 0, nz = 0;
      if (mn === pxL) { pos.x -= pxL; nx = -1; if (vel.x > 0) vel.x = 0; }
      else if (mn === pxR) { pos.x += pxR; nx = 1; if (vel.x < 0) vel.x = 0; }
      else if (mn === pzL) { pos.z -= pzL; nz = -1; if (vel.z > 0) vel.z = 0; }
      else { pos.z += pzR; nz = 1; if (vel.z < 0) vel.z = 0; }
      hitN = { x: nx, z: nz };
    }
  }
  let hitN = null;

  // ---------- Web ----------
  const ray = new THREE.Ray(), bx = new THREE.Box3(), tmp = new THREE.Vector3(), org = new THREE.Vector3();
  function release(boost) { if (rope && boost && vel.y > 0) { vel.multiplyScalar(1.1); vel.y += 2; } rope = false; ropeMesh.visible = false; }
  function shoot() {
    release();
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    org.set(pos.x, pos.y + 1.4, pos.z);
    for (const up of [0.8, 1.4, 2.6]) {
      ray.origin.copy(org); ray.direction.set(fx, up, fz).normalize();
      let best = 1e9, bp = null;
      for (const b of boxes) {
        bx.min.set(b.x0, 0, b.z0); bx.max.set(b.x1, b.h, b.z1);
        const h = ray.intersectBox(bx, tmp);
        if (h) { const d = h.distanceTo(org); if (d > 6 && d < 130 && d < best && h.y > pos.y + 6) { best = d; bp = h.clone(); } }
      }
      if (bp) {
        anchor.copy(bp); ropeLen = best; rope = true; climb = null; rp = 0;
        tmp.subVectors(anchor, org).normalize(); vel.addScaledVector(tmp, 5); if (onGround) vel.y += 5;
        ropeMesh.visible = true; vibe(12); return;
      }
    }
    toast('No building in range');
  }

  // ---------- Missions ----------
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 80, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.45, depthWrite: false }));
  beacon.visible = false; scene.add(beacon);
  let target = null, tokenMeshes = [];
  const tokGeo = new THREE.OctahedronGeometry(0.8), tokMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const MISSIONS = [
    { name: 'Rooftop Run', desc: 'Reach the glowing rooftop beacon.', start() {
      let best = null, bd = 1e9;
      for (const b of boxes) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - pos.x, cz - pos.z); if (b.h > 55 && d > 110 && d < bd) { bd = d; best = { x: cx, z: cz, h: b.h }; } }
      target = best; beacon.position.set(best.x, best.h + 40, best.z); beacon.visible = true;
    }, check() { const d = Math.hypot(target.x - pos.x, target.z - pos.z); $('obj').textContent = `Reach the beacon: ${Math.round(d)} m`; return d < 7 && Math.abs(pos.y - target.h) < 4; } },
    { name: 'Energy Hunt', desc: 'Collect 10 energy tokens around the city.', start() {
      beacon.visible = false; clearTokens();
      const tall = boxes.filter(b => b.h > 30);
      for (let i = 0; i < 10; i++) {
        const b = tall[Math.floor(rnd() * tall.length)], t = new THREE.Mesh(tokGeo, tokMat);
        t.position.set((b.x0 + b.x1) / 2 + (rnd() - 0.5) * 6, b.h + 1.5 + (i % 3 ? 0 : 6), (b.z0 + b.z1) / 2 + (rnd() - 0.5) * 6);
        scene.add(t); tokenMeshes.push(t);
      }
    }, check() { $('obj').textContent = `Collect tokens: ${10 - tokenMeshes.length}/10`; return tokenMeshes.length === 0; } },
  ];
  function clearTokens() { tokenMeshes.forEach(t => scene.remove(t)); tokenMeshes = []; }
  function startMission(i) { S.mission = i % MISSIONS.length; MISSIONS[S.mission].start(); toast('Mission: ' + MISSIONS[S.mission].name); }

  // ---------- UI ----------
  let toastT = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; show('toast'); clearTimeout(toastT); toastT = setTimeout(() => show('toast', false), 1800); }
  function vibe(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
  function hud() { $('score').textContent = S.score; $('tokens').textContent = S.tokens; }
  function resetGame() {
    S.score = 0; S.tokens = 0; pos.copy(SPAWN); ctg.set(32, 1.6, 32); vel.set(0, 0, 0); release(); climb = null; clearTokens(); startMission(0); hud();
  }
  function setState(s) {
    S.state = s;
    show('hud', s === 'play'); show('controls', s === 'play'); show('menu', s === 'menu'); show('pause', s === 'pause'); if (s !== 'menu') show('panel', false);
  }
  function play(fresh) { if (fresh) resetGame(); setState('play'); startLoop(); }
  function panel(kind) {
    const b = $('panelBody');
    if (kind === 'how') b.innerHTML = `<h2>How to play</h2><ul><li><b>Joystick / WASD:</b> move</li><li><b>JUMP / Space:</b> jump (also kicks off walls)</li><li><b>WEB / E:</b> shoot a web at a building ahead and swing. Push the stick to build speed.</li><li><b>CUT / Q:</b> release the web and fly. Shoot again mid-air to chain swings.</li><li><b>Walk into a building</b> to climb it. Climb past the roof edge to hop up.</li><li><b>Drag the screen / mouse:</b> rotate camera. Mouse wheel or R/F: zoom.</li><li><b>Esc / II:</b> pause</li></ul>`;
    else if (kind === 'missions') b.innerHTML = `<h2>Missions</h2><ul>${MISSIONS.map((x, i) => `<li><b>${i + 1}. ${x.name}</b> – ${x.desc}</li>`).join('')}<li><b>3. Defeat enemies</b> – coming in Part 2</li></ul>`;
    else b.innerHTML = `<h2>Settings</h2><p><button class="btn" data-a="q">Graphics: ${QUAL[S.q].toUpperCase()}</button></p><p><button class="btn" data-a="cd">Camera: ${CAMD[S.camD][0]}</button></p><p style="opacity:.7">Use LOW on slower phones. Sound options arrive in Part 2.</p>`;
    show('panel'); show('menu', false);
  }
  document.addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.a; if (!a) return;
    if (a === 'play') play(true);
    else if (['how', 'missions', 'settings'].includes(a)) { panel(a); S.lastPanel = a; }
    else if (a === 'back') { show('panel', false); show('menu'); }
    else if (a === 'q') { S.q = (S.q + 1) % 3; applyQuality(); panel('settings'); }
    else if (a === 'cd') { S.camD = (S.camD + 1) % 3; cam.dist = CAMD[S.camD][1]; panel('settings'); }
    else if (a === 'resume') play(false);
    else if (a === 'restart') play(true);
    else if (a === 'menu') { setState('menu'); startLoop(); }
  });
  const pause = () => { if (S.state === 'play') { setState('pause'); release_keys(); } };
  const release_keys = () => { K.w = K.a = K.s = K.d = 0; };
  $('bPause').addEventListener('click', pause);

  // ---------- Input ----------
  const KM = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd' };
  addEventListener('keydown', e => {
    if (KM[e.code]) K[KM[e.code]] = 1;
    else if (e.code === 'Space') { P_.jump = true; e.preventDefault(); }
    else if (e.code === 'KeyE' || e.code === 'KeyF') P_.web = true;
    else if (e.code === 'KeyQ') P_.rel = true;
    else if (e.code === 'KeyR') cam.dist = clamp(cam.dist - 1, 5, 16);
    else if (e.code === 'KeyV') cam.dist = clamp(cam.dist + 1, 5, 16);
    else if (e.code === 'Escape') (S.state === 'play' ? pause() : S.state === 'pause' && play(false));
  });
  addEventListener('keyup', e => { if (KM[e.code]) K[KM[e.code]] = 0; });
  const bind = (id, k) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); P_[k] = true; });
  bind('bJump', 'jump'); bind('bWeb', 'web'); bind('bRel', 'rel');

  const jz = $('joyZone'), jb = $('joy'), knob = $('knob'); let jid = null, jcx = 0, jcy = 0;
  function moveJ(e) {
    const R = 60; let dx = e.clientX - jcx
