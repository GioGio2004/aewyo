"use client";

import {
  ContactShadows,
  Edges,
  Grid,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";
import { MOUSE, Plane, Shape, Vector2, Vector3 } from "three";
import type {
  Camera,
  OrthographicCamera as OrthographicCameraImpl,
  PerspectiveCamera as PerspectiveCameraImpl,
  Scene,
  WebGLRenderer,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { decorById } from "@/lib/cabinet/decors";
import type { CabinetParams, Panel } from "@/lib/cabinet/types";
import { toRoom, wallFrames } from "@/lib/kitchen/layout";
import { COUNTER_THICKNESS, WALL_STANDOFF } from "@/lib/kitchen/presets";
import type { KitchenLayout, KitchenProject } from "@/lib/kitchen/types";

const SELECT_EDGE = "#5E4634";
const HOVER_EDGE = "#8C6A4F";

const PAPER = "#FAF9F6";
const FLOOR = "#E9DFCB";
const WALL = "#F2F0EB";
const COUNTER = "#ECE8E0";

/** Wall slab thickness behind the wall face (mm) */
const WALL_THICKNESS = 100;
/** Floor slab reach past the layout bounds (mm) */
const FLOOR_MARGIN = 1400;

export type ViewMode = "persp" | "iso";

export type RoomViewportHandle = {
  /** Renders the current scene once and returns it as a PNG data URL */
  snapshot(): string | null;
};

// ---------------------------------------------------------------------------
// panels

function PanelMesh({
  panel,
  edge,
  hovered,
  highlighted,
}: {
  panel: Panel;
  edge: string;
  hovered: boolean;
  highlighted: boolean;
}) {
  const decor = decorById(panel.decor);
  const glow = hovered && !highlighted;
  const material = (
    <meshStandardMaterial
      color={decor.color}
      roughness={0.85}
      metalness={0}
      emissive={glow ? "#ffffff" : "#000000"}
      emissiveIntensity={glow ? 0.06 : 0}
    />
  );

  const polygon = panel.polygon;
  // Plan-outline panels (corner bottoms/tops): extrude the (x,z) polygon by
  // size.y. Points are absolute cabinet-local, so the mesh sits at the group
  // origin and only takes its height from position.y. Shape (x, -z) rotated
  // -90° about x maps shape-x → local x, shape-y → local z, extrusion → +y.
  const shape = useMemo(() => {
    if (!polygon || polygon.length < 3) return null;
    return new Shape(polygon.map(([x, z]) => new Vector2(x, -z)));
  }, [polygon]);

  if (shape) {
    return (
      <mesh
        position={[0, panel.position.y - panel.size.y / 2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <extrudeGeometry args={[shape, { depth: panel.size.y, bevelEnabled: false }]} />
        {material}
        <Edges color={edge} threshold={15} />
      </mesh>
    );
  }

  return (
    <mesh
      position={[panel.position.x, panel.position.y, panel.position.z]}
      rotation={[0, panel.rotY ?? 0, 0]}
    >
      <boxGeometry args={[panel.size.x, panel.size.y, panel.size.z]} />
      {material}
      <Edges color={edge} threshold={15} />
    </mesh>
  );
}

function CabinetMeshes({
  panels,
  highlighted,
  hovered,
}: {
  panels: Panel[];
  highlighted: boolean;
  hovered: boolean;
}) {
  return (
    <>
      {panels.map((panel) => {
        const decor = decorById(panel.decor);
        const edge = highlighted ? SELECT_EDGE : hovered ? HOVER_EDGE : decor.edge;
        return (
          <PanelMesh
            key={panel.id}
            panel={panel}
            edge={edge}
            hovered={hovered}
            highlighted={highlighted}
          />
        );
      })}
    </>
  );
}

// Glides the orbit target to the selected cabinet (Figma "zoom to
// selection" feel) without changing the user's orbit distance.
function FocusRig({ target }: { target: Vector3 | null }) {
  const controls = useThree(
    (s) => s.controls as unknown as OrbitControlsImpl | null,
  );
  const goal = useRef<Vector3 | null>(null);
  useEffect(() => {
    goal.current = target ? target.clone() : null;
  }, [target]);
  useFrame((_, dt) => {
    if (!controls || !goal.current) return;
    const t = controls.target;
    const k = 1 - Math.pow(0.001, dt); // exponential ease, frame-rate independent
    t.lerp(goal.current, Math.min(1, k * 1.4));
    controls.update();
    if (t.distanceTo(goal.current) < 2) goal.current = null;
  });
  return null;
}

// ---------------------------------------------------------------------------
// cameras

type Bounds = KitchenLayout["bounds"];

const ISO_DIR = new Vector3(1, 1, 1).normalize();

/** Frames the room for the perspective camera (front-right three-quarter). */
function framePersp(
  cam: PerspectiveCameraImpl,
  controls: OrbitControlsImpl | null,
  bounds: Bounds,
  wallH: number,
) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ,
    1800,
  );
  const target = new Vector3(cx, 850, cz);
  cam.up.set(0, 1, 0);
  cam.position.set(cx + span * 0.15, wallH * 0.9, bounds.maxZ + span * 0.85);
  cam.lookAt(target);
  cam.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(target);
    controls.update();
  }
}

/**
 * True-isometric framing: orthographic camera along (1,1,1)/√3 aimed at the
 * room centre, zoom chosen so the room box (with margin) fits the canvas.
 */
function frameIso(
  cam: OrthographicCameraImpl,
  controls: OrbitControlsImpl | null,
  bounds: Bounds,
  wallH: number,
  size: { width: number; height: number },
) {
  const m = 250;
  const xs = [bounds.minX - m, bounds.maxX + m];
  const ys = [0, wallH];
  const zs = [bounds.minZ - m, bounds.maxZ + m];
  const centre = new Vector3(
    (bounds.minX + bounds.maxX) / 2,
    wallH / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  );
  const span = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ,
    wallH,
    1800,
  );
  const dist = span * 4;
  cam.up.set(0, 1, 0);
  cam.position.copy(centre).addScaledVector(ISO_DIR, dist);
  cam.lookAt(centre);
  cam.updateMatrixWorld(true);
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();

  // projected extents of the room box in camera space
  const v = new Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of xs)
    for (const y of ys)
      for (const z of zs) {
        v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const zoom =
    Math.min(size.width / w, size.height / h) * 0.92 || cam.zoom || 1;

  // recentre so the projected box, not the room centre, sits mid-canvas
  const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const shift = new Vector3()
    .addScaledVector(right, (minX + maxX) / 2)
    .addScaledVector(up, (minY + maxY) / 2);
  cam.position.add(shift);
  centre.add(shift);

  cam.zoom = zoom;
  cam.near = 10;
  cam.far = dist * 3;
  cam.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(centre);
    controls.update();
  }
}

/**
 * Owns the two cameras and (re)frames the room whenever the view mode
 * switches or a fresh OrbitControls instance appears for the active camera.
 * Room edits and canvas resizes deliberately do NOT re-frame, so user
 * orbits/pans survive them.
 */
function CameraRig({
  view,
  bounds,
  wallH,
}: {
  view: ViewMode;
  bounds: Bounds;
  wallH: number;
}) {
  const size = useThree((s) => s.size);
  const controls = useThree(
    (s) => s.controls as unknown as OrbitControlsImpl | null,
  );
  const persp = useRef<PerspectiveCameraImpl>(null);
  const ortho = useRef<OrthographicCameraImpl>(null);
  const framed = useRef<{ view: ViewMode; controls: unknown } | null>(null);

  useEffect(() => {
    const done = framed.current;
    if (done && done.view === view && done.controls === controls) return;
    if (view === "iso") {
      const cam = ortho.current;
      if (!cam) return;
      framed.current = { view, controls };
      frameIso(cam, controls, bounds, wallH, size);
    } else {
      const cam = persp.current;
      if (!cam) return;
      framed.current = { view, controls };
      framePersp(cam, controls, bounds, wallH);
    }
  }, [view, controls, bounds, wallH, size]);

  return view === "iso" ? (
    <OrthographicCamera ref={ortho} makeDefault near={10} far={200000} />
  ) : (
    <PerspectiveCamera
      ref={persp}
      makeDefault
      fov={40}
      near={10}
      far={60000}
    />
  );
}

// ---------------------------------------------------------------------------
// snapshot bridge: keeps gl/scene/camera reachable from outside the Canvas

type SceneRefs = { gl: WebGLRenderer; scene: Scene; camera: Camera };

function SceneBridge({ store }: { store: MutableRefObject<SceneRefs | null> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    store.current = { gl, scene, camera };
  }, [gl, scene, camera, store]);
  useEffect(
    () => () => {
      store.current = null;
    },
    [store],
  );
  return null;
}

// ---------------------------------------------------------------------------
// appliances

// Appliance visuals in cabinet-local space (origin left-bottom-back).
function ApplianceMeshes({ params }: { params: CabinetParams }) {
  const { width: w, height: h, depth: d, plinthHeight: ph } = params;
  const counterTop = h + COUNTER_THICKNESS;

  switch (params.appliance) {
    case "sink": {
      const rimW = Math.min(w - 140, 500);
      const rimD = d - 200;
      return (
        <>
          <mesh position={[w / 2, counterTop + 4, d / 2 + 10]}>
            <boxGeometry args={[rimW, 8, rimD]} />
            <meshStandardMaterial color="#B9BBBD" roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[w / 2, counterTop - 18, d / 2 + 10]}>
            <boxGeometry args={[rimW - 36, 40, rimD - 36]} />
            <meshStandardMaterial color="#94969A" roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[w / 2, counterTop + 75, 120]}>
            <cylinderGeometry args={[8, 8, 150, 20]} />
            <meshStandardMaterial color="#A7A9AC" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[w / 2, counterTop + 150, 190]}>
            <boxGeometry args={[12, 12, 140]} />
            <meshStandardMaterial color="#A7A9AC" roughness={0.3} metalness={0.6} />
          </mesh>
        </>
      );
    }
    case "oven": {
      const ovenH = 595;
      const fillerH = h - ph - ovenH - 12;
      const frontDecor = decorById(params.frontDecor);
      return (
        <>
          <mesh position={[w / 2, ph + ovenH / 2, d + 9]}>
            <boxGeometry args={[w - 20, ovenH, 18]} />
            <meshStandardMaterial color="#26262B" roughness={0.25} metalness={0.3} />
          </mesh>
          <mesh position={[w / 2, ph + ovenH - 45, d + 26]}>
            <boxGeometry args={[w - 140, 16, 16]} />
            <meshStandardMaterial color="#9A9C9F" roughness={0.3} metalness={0.6} />
          </mesh>
          {fillerH > 20 && (
            <mesh position={[w / 2, ph + ovenH + 6 + fillerH / 2, d + 9]}>
              <boxGeometry args={[w - 20, fillerH, 18]} />
              <meshStandardMaterial
                color={frontDecor.color}
                roughness={0.85}
              />
            </mesh>
          )}
        </>
      );
    }
    case "hob": {
      const hobW = w - 60;
      const hobD = d - 140;
      const burner = ([bx, bz]: [number, number]) => (
        <mesh
          key={`${bx}-${bz}`}
          position={[w / 2 + bx, counterTop + 14, d / 2 + bz]}
        >
          <cylinderGeometry args={[22, 22, 4, 24]} />
          <meshStandardMaterial color="#3A3937" roughness={0.5} />
        </mesh>
      );
      return (
        <>
          <mesh position={[w / 2, counterTop + 8, d / 2]}>
            <boxGeometry args={[hobW, 8, hobD]} />
            <meshStandardMaterial color="#1E1D1C" roughness={0.15} metalness={0.2} />
          </mesh>
          {(
            [
              [-hobW / 4, -hobD / 4],
              [hobW / 4, -hobD / 4],
              [-hobW / 4, hobD / 4],
              [hobW / 4, hobD / 4],
            ] as Array<[number, number]>
          ).map(burner)}
        </>
      );
    }
    case "hood": {
      // stainless canopy under the housing, duct rising above it
      return (
        <>
          <mesh position={[w / 2, -30, (d + 40) / 2]}>
            <boxGeometry args={[w, 60, d + 40]} />
            <meshStandardMaterial color="#B4B7B9" roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[w / 2, -70, (d + 40) / 2 + 30]}>
            <boxGeometry args={[w - 80, 20, d - 40]} />
            <meshStandardMaterial color="#8F9294" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[w / 2, h + 250, d / 2]}>
            <boxGeometry args={[240, 500, 240]} />
            <meshStandardMaterial color="#A5A8AA" roughness={0.35} metalness={0.5} />
          </mesh>
        </>
      );
    }
    case "fridge": {
      const doorH = h - ph - 12;
      const split = ph + doorH * 0.7;
      return (
        <>
          <mesh position={[w / 2, ph + doorH / 2, d + 12]}>
            <boxGeometry args={[w - 12, doorH, 24]} />
            <meshStandardMaterial color="#C2C5C7" roughness={0.4} metalness={0.35} />
          </mesh>
          <mesh position={[w / 2, split, d + 13]}>
            <boxGeometry args={[w - 12, 6, 26]} />
            <meshStandardMaterial color="#9A9DA0" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[50, split + doorH * 0.14, d + 30]}>
            <boxGeometry args={[12, 260, 12]} />
            <meshStandardMaterial color="#8E9194" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[50, split - 100, d + 30]}>
            <boxGeometry args={[12, 160, 12]} />
            <meshStandardMaterial color="#8E9194" roughness={0.3} metalness={0.6} />
          </mesh>
        </>
      );
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// viewport

type DragState = {
  id: string;
  wallId: string;
  plane: Plane;
  startT: number;
  moved: boolean;
};

export type RoomViewportProps = {
  project: KitchenProject;
  layout: KitchenLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Space + left-drag on a cabinet: live reorder along its wall */
  onDragStart?: (id: string) => void;
  onDragMove?: (id: string, indexInRun: number) => void;
  onDragEnd?: (id: string, moved: boolean) => void;
  /** Camera mode: perspective (default) or true-isometric orthographic */
  view?: ViewMode;
};

const RoomViewport = forwardRef<RoomViewportHandle, RoomViewportProps>(
  function RoomViewport(
    {
      project,
      layout,
      selectedId,
      onSelect,
      onDragStart,
      onDragMove,
      onDragEnd,
      view = "persp",
    },
    ref,
  ) {
    const frames = wallFrames(project);
    const { bounds } = layout;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    const span = Math.max(spanX, spanZ, 1800);
    const wallH = project.wallHeight;

    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // ---- snapshot ----
    const sceneRef = useRef<SceneRefs | null>(null);
    useImperativeHandle(
      ref,
      () => ({
        snapshot() {
          const s = sceneRef.current;
          if (!s) return null;
          try {
            s.gl.render(s.scene, s.camera);
            return s.gl.domElement.toDataURL("image/png");
          } catch {
            return null;
          }
        },
      }),
      [],
    );

    // Spline-style navigation: Alt + left-drag orbits, Space + left-drag
    // moves a cabinet along its wall, plain left-click selects, right-drag
    // pans, wheel zooms. Modifiers are tracked globally so bindings flip
    // before the pointer goes down.
    const [alt, setAlt] = useState(false);
    const [space, setSpace] = useState(false);
    useEffect(() => {
      const inField = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        return !!t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      };
      const down = (e: KeyboardEvent) => {
        if (e.key === "Alt") {
          e.preventDefault(); // keep the browser menu bar from grabbing focus
          setAlt(true);
        } else if (e.code === "Space" && !inField(e)) {
          // stop page scroll, but let a focused button still activate
          const ae = document.activeElement;
          if (!ae || ae === document.body || ae.tagName === "CANVAS") {
            e.preventDefault();
          }
          setSpace(true);
        }
      };
      const up = (e: KeyboardEvent) => {
        if (e.key === "Alt") setAlt(false);
        if (e.code === "Space") setSpace(false);
      };
      const clear = () => {
        setAlt(false);
        setSpace(false);
      };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", clear);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
        window.removeEventListener("blur", clear);
      };
    }, []);

    // ---- cabinet drag (Space + left) ----
    const dragRef = useRef<DragState | null>(null);
    const [dragGhost, setDragGhost] = useState<{ id: string; t: number } | null>(
      null,
    );
    const [hit] = useState(() => new Vector3());

    // the movable members of a run: same wall, same band group, no corners
    const runOf = (id: string) => {
      const me = layout.cabinets.find((c) => c.placement.id === id)!;
      const isWall = me.placement.band === "wall";
      return layout.cabinets
        .filter(
          (c) =>
            c.placement.kind !== "corner" &&
            c.placement.wallId === me.placement.wallId &&
            (c.placement.band === "wall") === isWall,
        )
        .sort((a, b) => a.runPos - b.runPos);
    };

    const beginDrag = (e: ThreeEvent<PointerEvent>, id: string) => {
      if (!space || alt || e.button !== 0) return;
      const cab = layout.cabinets.find((c) => c.placement.id === id);
      if (!cab || cab.placement.kind === "corner") return;
      e.stopPropagation();
      const f = frames.get(cab.placement.wallId)!;
      // vertical plane through the cabinet's mid-depth, facing into the room
      const depthMid = WALL_STANDOFF + cab.placement.params.depth / 2;
      const point = new Vector3(
        f.origin.x + f.normal.x * depthMid,
        0,
        f.origin.z + f.normal.z * depthMid,
      );
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        new Vector3(f.normal.x, 0, f.normal.z),
        point,
      );
      const p = e.ray.intersectPlane(plane, hit);
      const startT = p
        ? (p.x - f.origin.x) * f.dir.x + (p.z - f.origin.z) * f.dir.z
        : cab.runPos + cab.placement.params.width / 2;
      dragRef.current = {
        id,
        wallId: cab.placement.wallId,
        plane,
        startT,
        moved: false,
      };
      (e.target as Element).setPointerCapture(e.pointerId);
      onSelect(id);
      onDragStart?.(id);
    };

    const moveDrag = (e: ThreeEvent<PointerEvent>) => {
      const d = dragRef.current;
      if (!d) return;
      e.stopPropagation();
      const p = e.ray.intersectPlane(d.plane, hit);
      if (!p) return;
      const f = frames.get(d.wallId)!;
      const t = (p.x - f.origin.x) * f.dir.x + (p.z - f.origin.z) * f.dir.z;
      if (!d.moved && Math.abs(t - d.startT) < 15) return;
      d.moved = true;
      setDragGhost({ id: d.id, t });
      // index = how many other cabinets' centres lie before the pointer,
      // measured with the dragged one lifted out of the run
      const run = runOf(d.id);
      const others = run.filter((c) => c.placement.id !== d.id);
      const start = run.length ? run[0].runPos : 0;
      let pos = start;
      let index = 0;
      for (const c of others) {
        const w = c.placement.params.width;
        if (t > pos + w / 2) index++;
        pos += w;
      }
      onDragMove?.(d.id, index);
    };

    const endDrag = (e: ThreeEvent<PointerEvent>) => {
      const d = dragRef.current;
      if (!d) return;
      e.stopPropagation();
      (e.target as Element).releasePointerCapture(e.pointerId);
      dragRef.current = null;
      setDragGhost(null);
      onDragEnd?.(d.id, d.moved);
    };

    useEffect(() => {
      document.body.style.cursor = dragGhost
        ? "grabbing"
        : space && hoveredId
          ? "grab"
          : alt
            ? "all-scroll"
            : hoveredId
              ? "pointer"
              : "";
      return () => {
        document.body.style.cursor = "";
      };
    }, [hoveredId, alt, space, dragGhost]);

    // ghost: the dragged cabinet follows the pointer along its wall
    const ghostWorld = (id: string) => {
      if (!dragGhost || dragGhost.id !== id) return null;
      const cab = layout.cabinets.find((c) => c.placement.id === id)!;
      const f = frames.get(cab.placement.wallId)!;
      const wall = project.walls.find((w) => w.id === cab.placement.wallId)!;
      const band = cab.placement.band === "wall" ? "wall" : "base";
      const run = layout.runs.find(
        (r) => r.wallId === wall.id && r.band === band,
      );
      const limit = run?.endLimit ?? wall.length;
      const w = cab.placement.params.width;
      const along = Math.max(0, Math.min(limit - w, dragGhost.t - w / 2));
      return {
        x: f.origin.x + f.dir.x * along + f.normal.x * WALL_STANDOFF,
        z: f.origin.z + f.dir.z * along + f.normal.z * WALL_STANDOFF,
      };
    };

    // orbit target glides to the selected cabinet's centre; deselect → room
    const focusTarget = (() => {
      const cab = selectedId
        ? layout.cabinets.find((c) => c.placement.id === selectedId)
        : null;
      if (!cab) return null;
      const { width, height, depth } = cab.placement.params;
      let local = { x: width / 2, y: height / 2, z: depth / 2 };
      const fp = cab.corner?.footprint;
      if (cab.placement.kind === "corner" && fp && fp.length > 0) {
        let sx = 0;
        let sz = 0;
        for (const [x, z] of fp) {
          sx += x;
          sz += z;
        }
        local = { x: sx / fp.length, y: height / 2, z: sz / fp.length };
      }
      const c = toRoom(cab, local);
      return new Vector3(c.x, c.y, c.z);
    })();

    const floorW = spanX + FLOOR_MARGIN * 2;
    const floorD = spanZ + FLOOR_MARGIN * 2;

    return (
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onPointerMissed={() => onSelect(null)}
      >
        <SceneBridge store={sceneRef} />
        <CameraRig view={view} bounds={bounds} wallH={wallH} />
        <FocusRig target={focusTarget} />
        <color attach="background" args={[PAPER]} />
        <hemisphereLight color="#ffffff" groundColor={FLOOR} intensity={0.55} />
        <directionalLight
          position={[cx + span * 0.7, wallH * 1.6, bounds.maxZ + span * 0.9]}
          intensity={1.0}
        />

        {/* walls: slabs sit fully behind the wall face; at an inside corner
            the slab runs on past its end to close the outer notch */}
        {project.walls.map((wall, i) => {
          const f = frames.get(wall.id)!;
          const concaveNext =
            i < project.walls.length - 1 && (wall.turn ?? "right") === "right";
          const ext = concaveNext ? WALL_THICKNESS : 0;
          const len = wall.length + ext;
          const along = wall.length / 2 + ext / 2;
          const wx =
            f.origin.x + f.dir.x * along - (f.normal.x * WALL_THICKNESS) / 2;
          const wz =
            f.origin.z + f.dir.z * along - (f.normal.z * WALL_THICKNESS) / 2;
          return (
            <mesh key={wall.id} position={[wx, wallH / 2, wz]}>
              <boxGeometry
                args={[
                  Math.abs(f.dir.x) * len + Math.abs(f.normal.x) * WALL_THICKNESS,
                  wallH,
                  Math.abs(f.dir.z) * len + Math.abs(f.normal.z) * WALL_THICKNESS,
                ]}
              />
              <meshStandardMaterial color={WALL} roughness={1} />
            </mesh>
          );
        })}

        {/* floor: top face at y = 0 */}
        <mesh position={[cx, -10, cz]}>
          <boxGeometry args={[floorW, 20, floorD]} />
          <meshStandardMaterial color={FLOOR} roughness={1} />
        </mesh>

        {/* soft grounding shadows (no external assets) */}
        <ContactShadows
          position={[cx, 2, cz]}
          scale={[spanX + 800, spanZ + 800]}
          opacity={0.35}
          blur={2.5}
          far={600}
          resolution={512}
          color="#3B3129"
        />

        {/* cabinets */}
        {layout.cabinets.map((cabinet) => {
          const ghost = ghostWorld(cabinet.placement.id);
          const kind = cabinet.placement.kind ?? "cabinet";
          return (
            <group
              key={cabinet.placement.id}
              position={[
                ghost ? ghost.x : cabinet.world.x,
                cabinet.bandY,
                ghost ? ghost.z : cabinet.world.z,
              ]}
              rotation={[0, cabinet.world.rotY, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(cabinet.placement.id);
              }}
              onPointerDown={(e) => beginDrag(e, cabinet.placement.id)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId(cabinet.placement.id);
              }}
              onPointerOut={() =>
                setHoveredId((h) => (h === cabinet.placement.id ? null : h))
              }
            >
              <CabinetMeshes
                panels={cabinet.panels}
                highlighted={cabinet.placement.id === selectedId}
                hovered={cabinet.placement.id === hoveredId}
              />
              {kind === "cabinet" && (
                <ApplianceMeshes params={cabinet.placement.params} />
              )}
            </group>
          );
        })}

        {/* countertops */}
        {layout.counters.map((counter, i) => (
          <mesh
            key={`${counter.wallId}-${i}`}
            position={[counter.position.x, counter.position.y, counter.position.z]}
          >
            <boxGeometry args={[counter.size.x, counter.size.y, counter.size.z]} />
            <meshStandardMaterial color={COUNTER} roughness={0.6} />
            <Edges color="#A9A29A" threshold={15} />
          </mesh>
        ))}

        <Grid
          infiniteGrid
          cellSize={100}
          sectionSize={500}
          cellColor="#E7E3DC"
          sectionColor="#D8D2C6"
          fadeDistance={view === "iso" ? span * 14 : 12000}
          position={[0, 1, 0]}
        />
        <OrbitControls
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI * 0.55}
          minDistance={800}
          maxDistance={20000}
          minZoom={0.02}
          maxZoom={4}
          mouseButtons={{
            LEFT: alt ? MOUSE.ROTATE : undefined,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.PAN,
          }}
        />
      </Canvas>
    );
  },
);

export default RoomViewport;
