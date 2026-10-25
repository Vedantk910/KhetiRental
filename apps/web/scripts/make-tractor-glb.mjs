// Builds public/models/tractor.glb: an original low-poly tractor in the site palette (blue body, yellow cab and hubs)
// matching the still SVG in the story section, with four implements (rotavator, plough, seed drill, trolley) as named nodes. Run `npm run model:tractor` after editing. No external assets.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Scene } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// GLTFExporter reads its binary through FileReader, which Node lacks.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};

const mat = (name, color, roughness = 0.7) =>
  Object.assign(new MeshStandardMaterial({ color, roughness, metalness: 0.05 }), { name });
const blue = mat("body-blue", "#223585", 0.55);
const yellow = mat("cab-yellow", "#FFD45C");
const hub = mat("hub-mustard", "#FBC02D");
const black = mat("tyre-black", "#13100D", 0.9);
const brown = mat("hitch-brown", "#483F37");

const part = (geometry, material, name, [x, y, z], [rx = 0, ry = 0, rz = 0] = []) => {
  const m = new Mesh(geometry, material);
  m.name = name;
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
};
const box = (w, h, d, ...rest) => part(new BoxGeometry(w, h, d), ...rest);
const cyl = (r, len, seg, ...rest) => part(new CylinderGeometry(r, r, len, seg), ...rest);

const tractor = new Group();
tractor.name = "tractor";
// Front is +x, rear is -x, up is +y. The body sits between the axles.
tractor.add(box(1.7, 0.55, 0.8, blue, "hood", [0.55, 0.95, 0]));
tractor.add(box(1.1, 0.12, 0.9, blue, "chassis", [-0.1, 0.62, 0]));
tractor.add(box(1.0, 0.9, 0.95, yellow, "cab", [-0.45, 1.5, 0]));
tractor.add(box(1.2, 0.1, 1.1, black, "roof", [-0.45, 2.02, 0]));
tractor.add(cyl(0.06, 0.7, 8, black, "exhaust", [0.95, 1.55, 0.2]));
tractor.add(box(0.2, 0.2, 0.8, brown, "hitch", [-1.15, 0.7, 0]));
for (const side of [-1, 1]) {
  const rear = new Group();
  rear.name = `rear-wheel-${side}`;
  rear.position.set(-0.55, 0.62, side * 0.82);
  rear.add(cyl(0.62, 0.38, 20, black, "tyre", [0, 0, 0], [Math.PI / 2, 0, 0]));
  rear.add(cyl(0.24, 0.44, 12, hub, "hub", [0, 0, 0], [Math.PI / 2, 0, 0]));
  tractor.add(rear);
  const front = new Group();
  front.name = `front-wheel-${side}`;
  front.position.set(1.2, 0.38, side * 0.62);
  front.add(cyl(0.38, 0.26, 16, black, "tyre", [0, 0, 0], [Math.PI / 2, 0, 0]));
  front.add(cyl(0.15, 0.32, 10, hub, "hub", [0, 0, 0], [Math.PI / 2, 0, 0]));
  tractor.add(front);
}
// Implements: each is a named group whose local origin is the point where it hitches on, and which extends toward -x.
// The scene shows one at a time, lowering it onto the hitch, so the glb keeps each one at its hitched position.
const implement = (name, position, parts) => {
  const g = new Group();
  g.name = name;
  g.position.set(...position);
  parts.forEach((p) => g.add(p));
  tractor.add(g);
};
const HITCH = [-1.25, 0.6, 0];

implement("rotavator", HITCH, [
  box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.15, 0.55]),
  box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.15, -0.55]),
  cyl(0.22, 1.3, 12, brown, "drum", [-0.1, -0.15, 0], [Math.PI / 2, 0, 0]),
  box(0.5, 0.06, 1.4, yellow, "shield", [-0.1, 0.12, 0]),
]);

// A three-bottom disc plough: a slanted beam with discs hung below it, each tilted like a real one.
implement("plough", HITCH, [
  box(1.3, 0.12, 0.12, blue, "beam", [-0.55, 0.1, 0.25], [0, -0.35, 0]),
  box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.1, 0.45]),
  box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.1, -0.45]),
  ...[0, 1, 2].flatMap((i) => [
    box(0.08, 0.5, 0.08, brown, "leg", [-0.25 - i * 0.4, -0.1, 0.38 - i * 0.14]),
    cyl(0.3, 0.04, 18, black, "disc", [-0.25 - i * 0.4, -0.42, 0.38 - i * 0.14], [Math.PI / 2, 0, 0.45]),
  ]),
]);

// A seed drill: a hopper on a frame, seed tubes down to the coulters, and a ground wheel.
implement("seedDrill", HITCH, [
  box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.05, 0.5]),
  box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.05, -0.5]),
  box(1.0, 0.36, 1.3, yellow, "hopper", [-0.6, 0.3, 0]),
  box(1.0, 0.1, 1.4, blue, "frame", [-0.6, 0.06, 0]),
  ...[-0.5, -0.25, 0, 0.25, 0.5].map((z) => cyl(0.03, 0.5, 6, black, "tube", [-0.6, -0.2, z])),
  cyl(0.3, 0.12, 14, black, "wheel", [-0.6, -0.3, 0.72], [Math.PI / 2, 0, 0]),
  cyl(0.3, 0.12, 14, black, "wheel", [-0.6, -0.3, -0.72], [Math.PI / 2, 0, 0]),
]);

// A trolley hooks onto the drawbar and trails further behind.
implement(
  "trolley",
  [-1.25, 0.45, 0],
  [
    box(0.7, 0.1, 0.12, brown, "drawbar", [-0.35, 0, 0]),
    box(1.7, 0.1, 1.0, blue, "bed", [-1.5, 0.1, 0]),
    box(1.7, 0.35, 0.06, yellow, "board", [-1.5, 0.33, 0.47]),
    box(1.7, 0.35, 0.06, yellow, "board", [-1.5, 0.33, -0.47]),
    box(0.06, 0.35, 1.0, yellow, "board", [-2.33, 0.33, 0]),
    ...[-1, 1].map((side) =>
      cyl(0.42, 0.18, 18, black, "tyre", [-1.9, -0.0, side * 0.6], [Math.PI / 2, 0, 0]),
    ),
    ...[-1, 1].map((side) => cyl(0.16, 0.22, 10, hub, "hub", [-1.9, -0.0, side * 0.6], [Math.PI / 2, 0, 0])),
  ],
);

const scene = new Scene();
scene.add(tractor);
const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
const out = fileURLToPath(new URL("../public/models/tractor.glb", import.meta.url));
writeFileSync(out, Buffer.from(glb));
console.log(`wrote ${out} (${glb.byteLength} bytes)`);
