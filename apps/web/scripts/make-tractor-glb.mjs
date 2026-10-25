// Builds public/models/tractor.glb: an original low-poly tractor in the site palette (blue body, yellow cab and hubs),
// matching the still SVG in the story section. Run `npm run model:tractor` after editing. No external assets.
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
// The scene lowers this group between 40 % and 60 % of the scroll through the section.
const rotavator = new Group();
rotavator.name = "rotavator";
rotavator.position.set(-1.45, 0.55, 0);
rotavator.add(box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.15, 0.55]));
rotavator.add(box(0.3, 0.14, 0.14, brown, "arm", [0.2, 0.15, -0.55]));
rotavator.add(cyl(0.22, 1.3, 12, brown, "drum", [-0.1, -0.15, 0], [Math.PI / 2, 0, 0]));
tractor.add(rotavator);

const scene = new Scene();
scene.add(tractor);
const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
const out = fileURLToPath(new URL("../public/models/tractor.glb", import.meta.url));
writeFileSync(out, Buffer.from(glb));
console.log(`wrote ${out} (${glb.byteLength} bytes)`);
