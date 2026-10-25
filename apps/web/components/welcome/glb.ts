import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type TypedArray,
} from "three";

/**
 * A minimal reader for the one kind of .glb we ship (scripts/make-tractor-glb.mjs): binary glTF 2.0, one primitive per
 * mesh, tightly packed float/uint accessors, plain PBR colours, no textures or extensions. Three's own GLTFLoader would
 * add about 15 KB gzipped to the lazy 3D chunk for features this file never uses.
 */
interface Gltf {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: {
    name?: string;
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }[];
  meshes: {
    primitives: { attributes: { POSITION: number; NORMAL?: number }; indices?: number; material?: number }[];
  }[];
  materials?: {
    pbrMetallicRoughness?: { baseColorFactor?: number[]; roughnessFactor?: number; metalnessFactor?: number };
  }[];
  accessors: {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
}

const ARRAYS: Record<number, new (b: ArrayBuffer, o: number, n: number) => TypedArray> = {
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function parseGlb(data: ArrayBuffer): Group {
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("not a glb");
  const jsonLen = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, jsonLen))) as Gltf;
  const bin = 20 + jsonLen + 8; // after the JSON chunk header and the BIN chunk header

  const read = (i: number) => {
    const a = gltf.accessors[i];
    const bv = gltf.bufferViews[a.bufferView];
    const width = WIDTH[a.type];
    const array = new ARRAYS[a.componentType](
      data,
      bin + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0),
      a.count * width,
    );
    return new BufferAttribute(array, width);
  };
  const materials = (gltf.materials ?? []).map((m) => {
    const p = m.pbrMetallicRoughness ?? {};
    const [r = 1, g = 1, b = 1] = p.baseColorFactor ?? [];
    const mat = new MeshStandardMaterial({
      roughness: p.roughnessFactor ?? 1,
      metalness: p.metalnessFactor ?? 0,
    });
    mat.color.setRGB(r, g, b);
    return mat;
  });
  const meshes = gltf.meshes.map((m) =>
    m.primitives.map((p) => {
      const g = new BufferGeometry();
      g.setAttribute("position", read(p.attributes.POSITION));
      if (p.attributes.NORMAL !== undefined) g.setAttribute("normal", read(p.attributes.NORMAL));
      if (p.indices !== undefined) g.setIndex(read(p.indices));
      return new Mesh(g, materials[p.material ?? 0]);
    }),
  );

  const make = (i: number): Object3D => {
    const n = gltf.nodes[i];
    const o = n.mesh === undefined ? new Group() : meshes[n.mesh][0].clone();
    o.name = n.name ?? "";
    if (n.matrix) o.matrix.fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale); // the exporter writes matrices
    if (n.translation) o.position.set(...n.translation);
    if (n.rotation) o.quaternion.set(...n.rotation);
    if (n.scale) o.scale.set(...n.scale);
    n.children?.forEach((c) => o.add(make(c)));
    return o;
  };
  const root = new Group();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((n) => root.add(make(n)));
  return root;
}
