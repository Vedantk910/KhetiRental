import { readFileSync } from "node:fs";
import path from "node:path";
import { Mesh } from "three";
import { COMPONENTS } from "@/config/welcome";
import { describe, expect, it } from "vitest";
import { parseGlb } from "./glb";

const file = readFileSync(path.join(import.meta.dirname, "../../public/models/tractor.glb"));
const buf = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

describe("tractor.glb", () => {
  it("stays within the size and triangle budgets (REVIEW Phase 3 §2)", () => {
    expect(file.byteLength).toBeLessThanOrEqual(400 * 1024);
    let tris = 0;
    parseGlb(buf).traverse((o) => {
      if (o instanceof Mesh) tris += (o.geometry.index?.count ?? 0) / 3;
    });
    expect(tris).toBeGreaterThan(100);
    expect(tris).toBeLessThanOrEqual(25_000);
  });
  it("has the named parts and brand colours the scene relies on", () => {
    const root = parseGlb(buf);
    for (const { key } of COMPONENTS) expect(root.getObjectByName(key), key).toBeTruthy();
    // node transforms are applied (a matrix-only node must not collapse to the origin)
    expect(root.getObjectByName("hood")?.position.x).toBeCloseTo(0.55);
    expect(root.getObjectByName("front-wheel-1")?.position.z).toBeCloseTo(0.62);
    const colours = new Set<string>();
    root.traverse((o) => {
      if (o instanceof Mesh)
        colours.add((o.material as { color: { getHexString: () => string } }).color.getHexString());
    });
    // blue body, yellow cab, mustard hubs (linear to sRGB round trip, so compare loosely)
    expect(colours.size).toBeGreaterThanOrEqual(5);
  });
  it("keeps each implement a separate node with its own meshes, hitched behind the tractor", () => {
    const root = parseGlb(buf);
    for (const { key } of COMPONENTS.filter((c) => c.key !== "tractor")) {
      const node = root.getObjectByName(key)!;
      let meshes = 0;
      node.traverse((o) => {
        if (o instanceof Mesh) meshes++;
      });
      expect(meshes, key).toBeGreaterThanOrEqual(4);
      expect(node.parent?.name, key).toBe("tractor");
      expect(node.position.x, key).toBeLessThan(-1);
    }
  });
  it("rejects a file that is not a glb", () => {
    expect(() => parseGlb(new ArrayBuffer(32))).toThrow("not a glb");
  });
});
