"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Vector3, type Group, type Object3D } from "three";
import { COMPONENTS, type ComponentKey } from "@/config/welcome";
import { parseGlb } from "./glb";

/** Marker the network test looks for in the lazy chunk. */
const SCENE = "kr-3d-scene";
const MODEL_URL = "/models/tractor.glb";

export type TagRefs = RefObject<Partial<Record<ComponentKey, HTMLElement | null>>>;
type Implement = Exclude<ComponentKey, "tractor">;

const IMPLEMENTS = COMPONENTS.flatMap((c) => (c.key === "tractor" ? [] : [c.key]));
/** Yaw turns from the side view toward the rear quarter (about 8° to 52°) over the section, so the implement is always the near end. */
const YAW_FROM = 0.15;
const YAW_TO = 0.9;
/** x of the middle of tractor + implement, so the pair stays centred on the turntable. */
const MID: Record<Implement, number> = { rotavator: -0.3, plough: -0.3, seedDrill: -0.3, trolley: -1.1 };
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const v = new Vector3();

/** Scroll progress through S2: the pin's `--kr-p` when pinned, otherwise how far the slot has crossed the screen. */
function progress(host: HTMLElement) {
  const pinned = parseFloat(host.style.getPropertyValue("--kr-p"));
  if (!Number.isNaN(pinned)) return clamp01(pinned);
  const r = host.getBoundingClientRect();
  return clamp01((innerHeight - r.top) / (innerHeight + r.height));
}

type Slot = { node: Object3D; rest: number; size: number };

function Tractor({
  host,
  tags,
  onReady,
  onActive,
}: {
  host: HTMLElement;
  tags: TagRefs;
  onReady: () => void;
  onActive: (k: ComponentKey) => void;
}) {
  const [scene, setScene] = useState<Group>();
  const [, fail] = useState();
  const turn = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const body = useRef<Object3D | undefined>(undefined);
  const parts = useRef(new Map<Implement, Slot>());
  const active = useRef<Implement | undefined>(undefined);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(MODEL_URL, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`model ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        const g = parseGlb(b);
        body.current = g.getObjectByName("tractor");
        for (const k of IMPLEMENTS) {
          const node = g.getObjectByName(k);
          if (!node) throw new Error(`model has no ${k}`);
          node.visible = false;
          parts.current.set(k, { node, rest: node.position.y, size: 0 });
        }
        setScene(g);
        onReady();
      })
      .catch((e: unknown) => {
        if (!ctl.signal.aborted)
          fail(() => {
            throw e;
          }); // rethrown in render, so the slot's boundary shows the still
      });
    return () => {
      ctl.abort();
    };
  }, [onReady]);
  useFrame((state, delta) => {
    if (!turn.current || !inner.current || !body.current) return;
    const p = progress(host);
    const now = IMPLEMENTS[Math.min(IMPLEMENTS.length - 1, Math.floor(p * IMPLEMENTS.length))];
    if (now !== active.current) {
      active.current = now;
      onActive(now);
    }
    const k = 1 - Math.exp(-delta * 7);
    turn.current.rotation.y = YAW_FROM + p * (YAW_TO - YAW_FROM);
    inner.current.position.x += (-MID[now] - inner.current.position.x) * k;
    // the chosen implement is lowered onto the hitch; the one before it lifts away
    parts.current.forEach((s, key) => {
      s.size += ((key === now ? 1 : 0) - s.size) * k;
      s.node.visible = s.size > 0.02;
      s.node.scale.setScalar(Math.max(s.size, 0.001));
      s.node.position.y = s.rest + (1 - s.size) * 1.2;
    });
    turn.current.updateMatrixWorld(true);
    // tags follow their part's projected x; each keeps its own row (tractor on top, implement below), so they can't collide
    const { width } = state.size;
    const place = (key: ComponentKey, node: Object3D, at: [number, number, number]) => {
      const el = tags.current[key];
      if (!el) return;
      v.set(...at);
      node.localToWorld(v).project(state.camera);
      const anchor = (v.x * 0.5 + 0.5) * width;
      const x = Math.min(Math.max(anchor - el.offsetWidth / 2, 4), Math.max(4, width - el.offsetWidth - 4));
      el.style.transform = `translateX(${x.toFixed(1)}px)`;
      el.dataset.anchor = String(Math.round(anchor));
    };
    place("tractor", body.current, [0.2, 1.9, 0]);
    const part = parts.current.get(now);
    if (part) place(now, part.node, [-0.6, 0.1, 0]);
  });
  return (
    scene && (
      <group ref={turn} position={[0, -0.8, 0]}>
        <group ref={inner}>
          <primitive object={scene} />
        </group>
      </group>
    )
  );
}

/** The 3D tractor. Throws (to the slot's error boundary) if the model fails; reports a lost GL context. */
export default function TractorScene({
  host,
  tags,
  onReady,
  onActive,
  onLost,
}: {
  host: HTMLElement;
  tags: TagRefs;
  onReady: () => void;
  onActive: (k: ComponentKey) => void;
  onLost: () => void;
}) {
  const [active, setActive] = useState(true);
  const gone = useRef(false); // R3F itself drops the context when the canvas unmounts; that is not a loss to report
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
  useEffect(() => {
    let visible = true;
    const sync = () => {
      setActive(visible && !document.hidden);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(host);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [host]);

  return (
    <div data-3d={SCENE} className="absolute inset-0">
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.8, 8.6], fov: 32 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            if (!gone.current) onLost();
          });
        }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 5, 4]} intensity={2.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <Tractor host={host} tags={tags} onReady={onReady} onActive={onActive} />
      </Canvas>
    </div>
  );
}
