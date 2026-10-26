// `npm run photos:samples`: renders the sample tractors' photos from public/models/tractor.glb in the Chromium that
// Playwright already installed, recoloured per make and with the tractor's implement hitched. Nothing is downloaded;
// the WebP files in public/samples are committed. Run `npm run model:tractor` first if the model changed.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SAMPLE_PHOTOS } from "../server/db/sample-photos";

const ROOT = process.cwd();
const FILES: Record<string, string> = {
  "/three.module.js": "node_modules/three/build/three.module.js",
  "/three.core.js": "node_modules/three/build/three.core.js",
  "/tractor.glb": "public/models/tractor.glb",
};
const ADDONS = "/addons/";

const html = `<!doctype html><style>html,body{margin:0;background:#cfe3f2}</style>
<script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"${ADDONS}"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const gltf = await new GLTFLoader().loadAsync("/tractor.glb");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(800, 600);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
// Sky above, ploughed earth below: a simple farm backdrop.
const sky = document.createElement("canvas");
sky.width = 2; sky.height = 256;
const g = sky.getContext("2d").createLinearGradient(0, 0, 0, 256);
g.addColorStop(0, "#a9cbe8"); g.addColorStop(1, "#eef3f6");
sky.getContext("2d").fillStyle = g; sky.getContext("2d").fillRect(0, 0, 2, 256);
scene.background = new THREE.CanvasTexture(sky);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a45, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 7, 5);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: "#b48b5a", roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const model = gltf.scene;
scene.add(model);
const camera = new THREE.PerspectiveCamera(32, 800 / 600, 0.1, 100);
const byName = (n) => model.getObjectByName(n);
const IMPLEMENTS = ["rotavator", "plough", "seedDrill", "trolley"];
window.shoot = ({ body, cab, hub, implement, angle }) => {
  model.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name;
    const color = name === "body-blue" ? body : name === "cab-yellow" ? cab : name === "hub-mustard" ? hub : null;
    if (color) { o.material = o.material.clone(); o.material.color.set(color); }
  });
  for (const k of IMPLEMENTS) byName(k).visible = k === implement;
  const a = angle === "front" ? 0.75 : 2.55;
  const r = implement === "trolley" ? 9.5 : 7.6;
  const cx = implement === "trolley" ? -1.2 : -0.4;
  camera.position.set(cx + Math.cos(a) * r, 2.6, Math.sin(a) * r);
  camera.lookAt(cx, 0.8, 0);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/webp", 0.82);
};
window.ready = true;
</script>`;

const out = path.join(ROOT, "public/samples");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.route("http://render.test/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
    const file = pathname.startsWith(ADDONS)
      ? path.join("node_modules/three/examples/jsm", pathname.slice(ADDONS.length))
      : FILES[pathname];
    if (!file) return route.fulfill({ status: 404 });
    const type = file.endsWith(".glb") ? "model/gltf-binary" : "text/javascript";
    return route.fulfill({ contentType: type, body: await readFile(path.join(ROOT, file)) });
  });
  await page.goto("http://render.test/");
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
  for (const p of SAMPLE_PHOTOS) {
    for (const angle of ["front", "side"] as const) {
      const url = await page.evaluate(
        (args) => (window as unknown as { shoot: (a: unknown) => string }).shoot(args),
        {
          ...p.look,
          implement: p.implement,
          angle,
        },
      );
      await writeFile(path.join(out, `${p.key}-${angle}.webp`), Buffer.from(url.split(",")[1], "base64"));
    }
  }
} finally {
  await browser.close();
}
console.log(`wrote ${SAMPLE_PHOTOS.length * 2} photos to public/samples`);
