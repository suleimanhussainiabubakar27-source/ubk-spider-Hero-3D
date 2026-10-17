# UBK SPIDER HERO 3D

Original low-poly open-world superhero prototype (Three.js, no backend, no paid services).
This is **Part 1**: Stages 1-3 plus menus, mobile controls and performance basics.

## Files
- `index.html` – page structure, menus, HUD, touch controls, and the import map that loads Three.js r160 from the jsDelivr CDN.
- `style.css` – mobile-first UI styling (menus, HUD, joystick, buttons, safe-area support).
- `game.js` – all game logic: procedural city, hero model, swing physics, climbing, camera, missions, input, game loop.
- `README.md` – this guide.

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Move | Joystick | WASD / arrows |
| Jump | JUMP | Space |
| Shoot web | WEB | E or F |
| Release web | CUT | Q |
| Camera | Drag the screen | Mouse drag, wheel, R/V |
| Pause | II | Esc |

Walk into a building to climb it. Climb past the roof edge to hop onto the roof.

## Implemented
City (instanced buildings, slabs, trees, streetlamps, clouds), original red/black hero with walk/jump/swing/climb poses, a rope that constrains movement (pendulum + reel-in), AABB collisions, smoothed camera, missions (rooftop beacon, token hunt), menu/pause/settings, graphics quality setting, WebGL error screen.

## Not yet implemented (Part 2)
Enemies, punch/kick attack button, health bar, game-over screen, enemy-defeat mission, sound, bridges. Mission list shows the combat mission as "coming in Part 2".

## Android + GitHub + Vercel
1. Install the **GitHub** app or use github.com in Chrome. Create a new public repository (e.g. `ubk-spider-hero`).
2. Tap **Add file > Create new file** four times and paste each file with its exact name (`index.html`, `style.css`, `game.js`, `README.md`), committing each. (Or use "Upload files" after saving them with a file manager.)
3. Open vercel.com, sign in with GitHub, tap **Add New > Project**, import the repo.
4. Framework preset: **Other**. Leave build command and output directory empty. Tap **Deploy**.
5. Open the `.vercel.app` URL in Chrome on your phone. Landscape works best.
No `vercel.json` is needed: the site is static.

## Troubleshooting
- **Black screen / "WebGL not available"**: update Chrome and Android System WebView, enable hardware acceleration.
- **Nothing loads, console says import failed**: the phone cannot reach `cdn.jsdelivr.net`; check connection or ad-blocker. To self-host, download `three.module.js` (r160) into the repo and change the import map path to `./three.module.js`.
- **Opened by double-clicking the file**: ES modules need http(s). Use the Vercel URL or a local server.
- **Slow**: Settings > Graphics: LOW.
- **Old version showing**: hard-refresh or clear site data.

## Notes
Performance is untested on real devices; no frame rate is claimed.