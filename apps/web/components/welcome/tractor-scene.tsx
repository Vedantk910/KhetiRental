"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group, Object3D } from "three";
import { parseGlb } from "./glb";

/** Marker the network test looks for in the lazy chunk. */
export const SCENE = "kr-3d-scene";
export const MODEL_URL = "/models/tractor.glb";

const TURN = (300 * Math.PI) / 180; // 0 → 300° over the section (UI-SPEC §4.1.5)
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Scroll progress through S2: the pin's `--kr-p` when pinned, otherwise how far the slot has crossed the screen. */
function progress(host: HTMLElement) {
  const pinned = parseFloat(host.style.getPropertyValue("--kr-p"));
  if (!Number.isNaN(pinned)) return clamp01(pinned);
  const r = host.getBoundingClientRect();
  return clamp01((innerHeight - r.top) / (innerHeight + r.height));
}

function Tractor({ host, onReady }: { host: HTMLElement; onReady: () => void }) {
  const [scene, setScene] = useState<Group>();
  const [, fail] = useState();
  const turn = useRef<Group>(null);
  const rotavator = useRef<Object3D | undefined>(undefined);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(MODEL_URL, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`model ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        const g = parseGlb(b);
        rotavator.current = g.getObjectByName("rotavator");
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
  useFrame(() => {
    const p = progress(host);
    if (turn.current) turn.current.rotation.y = p * TURN + 0.5;
    // raised until 40 %, fully down by 60 %
    if (rotavator.current) rotavator.current.position.y = 0.55 + 0.45 * (1 - clamp01((p - 0.4) / 0.2));
  });
  return (
    scene && (
      <group ref={turn} position={[0.1, -0.9, 0]}>
        <primitive object={scene} />
      </group>
    )
  );
}

/** The 3D tractor. Throws (to the slot's error boundary) if the model fails; reports a lost GL context. */
export default function TractorScene({
  host,
  onReady,
  onLost,
}: {
  host: HTMLElement;
  onReady: () => void;
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
        camera={{ position: [0, 2, 6.3], fov: 32 }}
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
        <Tractor host={host} onReady={onReady} />
      </Canvas>
    </div>
  );
}
