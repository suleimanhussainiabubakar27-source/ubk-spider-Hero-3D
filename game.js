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
  const S = { state: 'menu', score: 0, tokens: 0, mission: 0, q: 1, camD: 1 };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc3ff);
  scene.fog = new THREE.Fog(0x8fc3ff, 160, 560);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 800);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
  sun.shadow.mapSize.set(1024, 1024);
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
  const N = 4, P = 64;
  const boxes = []; // {x0,x1,z0,z1,h}
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x2b2e35 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
  const cnt = (2 * N + 1) ** 2;
  const bMesh = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial(), cnt * 4);
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
      put(bMesh, bi, x, 0, z, w, h, d);
      bMesh.setColorAt(bi++, col.setHSL(0.56 + rnd() * 0.1, 0.12 + rnd() * 0.2, 0.32 + rnd() * 0.3));
      boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
      put(poles, pi, cx + sx * 27.5, 0, cz + sz * 27.5, 0.3, 6, 0.3);
      put(lamps, pi++, cx + sx * 27.5, 6.2, cz + sz * 27.5, 1, 1, 1);
    }
    for (let k = 0; k < 6; k++) {
      const x = cx + (k % 2 ? 28.6 : -28.6), z = cz + (k - 2.5) * 9;
      put(trunk, ti, x, 0, z, 0.5, 2, 0.5); put(crown, ti++, x, 2.4, z, 1.5, 1.5, 1.5);
    }
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
  const RED = mat(0xd01030), BLK = mat(0x15151c);
  const hero = new THREE.Group(), body = new THREE.Group(); hero.add(body);
  const part = (geo, mt, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  part(new THREE.CylinderGeometry(0.34, 0.26, 0.75, 8), RED, 0, 1.1, 0);
  part(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 8), BLK, 0, 0.7, 0);
  part(new THREE.SphereGeometry(0.23, 10, 8), RED, 0, 1.72, 0);
  part(new THREE.BoxGeometry(0.16, 0.2, 0.04), BLK, 0, 1.15, 0.3);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x9ff6ff });
  for (const s of [-1, 1]) { const e = part(new THREE.BoxGeometry(0.12, 0.06, 0.03), eyeM, s * 0.09, 1.75, 0.21); e.rotation.z = -s * 0.35; e.castShadow = false; }
  function limb(x, y, len, r, top, tip) {
    const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p);
    part(new THREE.CylinderGeometry(r, r * 0.85, len, 6), top, 0, -len / 2, 0, p);
    part(new THREE.SphereGeometry(r * 1.1, 6, 5), tip, 0, -len, 0, p);
    return p;
  }
  const armL = limb(-0.45, 1.42, 0.7, 0.09, RED, BLK), armR = limb(0.45, 1.42, 0.7, 0.09, RED, BLK);
  const legL = limb(-0.16, 0.78, 0.78, 0.12, RED, BLK), legR = limb(0.16, 0.78, 0.78, 0.12, RED, BLK);
  scene.add(hero);

  // ---------- Rope ----------
  const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ropeMesh.visible = false; scene.add(ropeMesh);

  // ---------- State ----------
  const SPAWN = new THREE.Vector3(32, 0, 32);
  const pos = SPAWN.clone(), vel = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  let rope = false, ropeLen = 0, onGround = false, climb = null, heading = 0, phase = 0, smoothFov = 62;
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
  function release() { rope = false; ropeMesh.visible = false; }
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
        if (h) { const d = h.distanceTo(org); if (d > 6 && d < 130 && d < best && h.y > pos.y + 4) { best = d; bp = h.clone(); } }
      }
      if (bp) {
        anchor.copy(bp); ropeLen = best * 0.96; rope = true; climb = null;
        if (onGround) vel.y += 6;
        ropeMesh.visible = true; return;
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
  function hud() { $('score').textContent = S.score; $('tokens').textContent = S.tokens; }
  function resetGame() {
    S.score = 0; S.tokens = 0; pos.copy(SPAWN); vel.set(0, 0, 0); release(); climb = null; clearTokens(); startMission(0); hud();
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

  const jz = $('joy'), knob = $('knob'); let jid = null;
  function moveJ(e) {
    const r = jz.getBoundingClientRect(), R = r.width / 2 * 0.8;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  }
  jz.addEventListener('pointerdown', e => { jid = e.pointerId; jz.setPointerCapture(jid); moveJ(e); });
  jz.addEventListener('pointermove', e => { if (e.pointerId === jid) moveJ(e); });
  const endJ = e => { if (e.pointerId === jid) { jid = null; joy.x = joy.y = 0; knob.style.transform = 'translate(-50%,-50%)'; } };
  jz.addEventListener('pointerup', endJ); jz.addEventListener('pointercancel', endJ);

  const cv = renderer.domElement; let cid = null, lx = 0, ly = 0;
  cv.addEventListener('pointerdown', e => { if (cid === null) { cid = e.pointerId; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(cid); } });
  cv.addEventListener('pointermove', e => {
    if (e.pointerId !== cid) return;
    cam.yaw -= (e.clientX - lx) * 0.006; cam.pitch = clamp(cam.pitch + (e.clientY - ly) * 0.005, -0.2, 1.2); lx = e.clientX; ly = e.clientY;
  });
  const endC = e => { if (e.pointerId === cid) cid = null; };
  cv.addEventListener('pointerup', endC); cv.addEventListener('pointercancel', endC);
  cv.addEventListener('wheel', e => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY), 5, 16); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- Update ----------
  function animate(dt, hs) {
    phase += dt * (6 + hs * 0.7);
    const sw = Math.sin(phase);
    let aL, aR, lL, lR, lean = 0;
    if (climb) { aL = -2.5 + sw * 0.5; aR = -2.5 - sw * 0.5; lL = sw * 0.6; lR = -sw * 0.6; lean = -1.3; }
    else if (rope) { aL = aR = -2.8; lL = 0.5; lR = 0.8; lean = 0.25; }
    else if (!onGround) { aL = aR = vel.y > 0 ? -2.2 : -1.2; lL = 0.4; lR = -0.2; lean = vel.y < 0 ? 0.2 : 0; }
    else { const k = Math.min(hs / 9, 1) * 0.95; aL = -sw * k; aR = sw * k; lL = sw * k; lR = -sw * k; lean = Math.min(hs / 16, 1) * 0.25; }
    armL.rotation.x = aL; armR.rotation.x = aR; legL.rotation.x = lL; legR.rotation.x = lR; body.rotation.x = lean;
  }

  function update(dt, time) {
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    let ix = (K.d - K.a) + joy.x, iz = (K.w - K.s) - joy.y, mag = Math.hypot(ix, iz);
    if (mag > 1) { ix /= mag; iz /= mag; mag = 1; }
    const dx = -sy * iz + cy * ix, dz = -cy * iz - sy * ix;

    if (P_.jump) { P_.jump = false; if (climb) { vel.set(climb.x * 9, 8, climb.z * 9); climb = null; } else if (onGround) vel.y = 11; else if (rope) { release(); vel.y += 6; } }
    if (P_.web) { P_.web = false; shoot(); }
    if (P_.rel) { P_.rel = false; release(); }

    if (climb) {
      const tx = -climb.z, tz = climb.x, up = clamp(-(dx * climb.x + dz * climb.z), 0, 1), lat = dx * tx + dz * tz;
      vel.set(-climb.x * 2 + tx * lat * 5, up * 7, -climb.z * 2 + tz * lat * 5);
    } else {
      vel.y -= 28 * dt;
      if (rope) { vel.x += dx * 16 * dt; vel.z += dz * 16 * dt; ropeLen = Math.max(10, ropeLen - 3 * dt); }
      else if (onGround) { const tv = 5 + 8 * mag, k = 1 - Math.exp(-12 * dt); vel.x += (dx * tv - vel.x) * k; vel.z += (dz * tv - vel.z) * k; }
      else { vel.x += dx * 14 * dt; vel.z += dz * 14 * dt; const dr = 1 - 0.2 * dt; vel.x *= dr; vel.z *= dr; }
    }
    pos.addScaledVector(vel, dt);

    if (rope) {
      let rx = pos.x - anchor.x, ry = pos.y + 1.2 - anchor.y, rz = pos.z - anchor.z; const d = Math.hypot(rx, ry, rz);
      if (d > ropeLen) {
        rx /= d; ry /= d; rz /= d;
        pos.set(anchor.x + rx * ropeLen, anchor.y + ry * ropeLen - 1.2, anchor.z + rz * ropeLen);
        const vn = vel.x * rx + vel.y * ry + vel.z * rz; if (vn > 0) vel.addScaledVector(tmp.set(rx, ry, rz), -vn);
      }
    }
    onGround = false; hitN = null; collide();
    if (pos.y <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; onGround = true; }
    climb = (hitN && mag > 0.1 && dx * hitN.x + dz * hitN.z < -0.25) ? hitN : null;
    if (climb && rope) release();
    if (pos.y < -30 || Math.abs(pos.x) > 700 || Math.abs(pos.z) > 700) { pos.copy(SPAWN); vel.set(0, 0, 0); release(); toast('Respawned'); }

    // facing
    const hs = Math.hypot(vel.x, vel.z);
    let th = heading;
    if (climb) th = Math.atan2(-climb.x, -climb.z); else if (hs > 1.5) th = Math.atan2(vel.x, vel.z);
    heading += Math.atan2(Math.sin(th - heading), Math.cos(th - heading)) * (1 - Math.exp(-14 * dt));
    hero.position.copy(pos); hero.rotation.y = heading; animate(dt, hs);

    if (rope) {
      const a = tmp.set(pos.x, pos.y + 1.5, pos.z), len = a.distanceTo(anchor);
      ropeMesh.position.copy(a).add(anchor).multiplyScalar(0.5); ropeMesh.scale.set(1, len, 1);
      ropeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(anchor, a).normalize());
    }

    // missions
    for (let i = tokenMeshes.length - 1; i >= 0; i--) {
      const t = tokenMeshes[i]; t.rotation.y += dt * 3;
      if (t.position.distanceToSquared(tmp.set(pos.x, pos.y + 1, pos.z)) < 9) { scene.remove(t); tokenMeshes.splice(i, 1); S.tokens++; S.score += 100; hud(); }
    }
    if (MISSIONS[S.mission].check()) { S.score += 500; hud(); toast('Mission complete! +500'); startMission(S.mission + 1); }

    // camera
    const tg = new THREE.Vector3(pos.x, pos.y + 1.6, pos.z), cp = Math.cos(cam.pitch);
    con