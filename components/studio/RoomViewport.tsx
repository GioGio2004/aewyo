"use client";

import { Edges, Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { decorById } from "@/lib/cabinet/decors";
import type { CabinetParams, Panel } from "@/lib/cabinet/types";
import { wallFrames } from "@/lib/kitchen/layout";
import { COUNTER_THICKNESS } from "@/lib/kitchen/presets";
import type { KitchenLayout, KitchenProject } from "@/lib/kitchen/types";

function CabinetMeshes({
  panels,
  highlighted,
}: {
  panels: Panel[];
  highlighted: boolean;
}) {
  return (
    <>
      {panels.map((panel) => {
        const decor = decorById(panel.decor);
        return (
          <mesh
            key={panel.id}
            position={[panel.position.x, panel.position.y, panel.position.z]}
          >
            <boxGeometry args={[panel.size.x, panel.size.y, panel.size.z]} />
            <meshStandardMaterial
              color={decor.color}
              roughness={0.85}
              metalness={0}
            />
            <Edges color={highlighted ? "#5E4634" : decor.edge} threshold={15} />
          </mesh>
        );
      })}
    </>
  );
}

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

export default function RoomViewport({
  project,
  layout,
  selectedId,
  onSelect,
}: {
  project: KitchenProject;
  layout: KitchenLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const frames = wallFrames(project);
  const { bounds } = layout;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ,
    1800,
  );
  const wallH = project.wallHeight;

  return (
    <Canvas
      camera={{
        position: [cx + span * 0.15, wallH * 0.9, bounds.maxZ + span * 0.85],
        fov: 40,
        near: 10,
        far: 60000,
      }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#FAF9F6"]} />
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[cx + span, wallH + 1200, bounds.maxZ + span]}
        intensity={0.95}
      />

      {/* walls */}
      {project.walls.map((wall) => {
        const f = frames.get(wall.id)!;
        const wx =
          f.origin.x + (f.dir.x * wall.length) / 2 - f.normal.x * 40;
        const wz =
          f.origin.z + (f.dir.z * wall.length) / 2 - f.normal.z * 40;
        return (
          <mesh key={wall.id} position={[wx, wallH / 2, wz]}>
            <boxGeometry
              args={[
                Math.abs(f.dir.x) * wall.length + Math.abs(f.normal.x) * 80,
                wallH,
                Math.abs(f.dir.z) * wall.length + Math.abs(f.normal.z) * 80,
              ]}
            />
            <meshStandardMaterial color="#F2F0EB" roughness={1} />
          </mesh>
        );
      })}

      {/* floor */}
      <mesh position={[cx, -10, cz + 300]}>
        <boxGeometry
          args={[
            bounds.maxX - bounds.minX + 2600,
            20,
            bounds.maxZ - bounds.minZ + 3200,
          ]}
        />
        <meshStandardMaterial color="#E4D7BF" roughness={1} />
      </mesh>

      {/* cabinets */}
      {layout.cabinets.map((cabinet) => (
        <group
          key={cabinet.placement.id}
          position={[cabinet.world.x, cabinet.bandY, cabinet.world.z]}
          rotation={[0, cabinet.world.rotY, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(cabinet.placement.id);
          }}
        >
          <CabinetMeshes
            panels={cabinet.panels}
            highlighted={cabinet.placement.id === selectedId}
          />
          {cabinet.placement.kind !== "spacer" && (
            <ApplianceMeshes params={cabinet.placement.params} />
          )}
        </group>
      ))}

      {/* countertops */}
      {layout.counters.map((counter, i) => (
        <mesh
          key={`${counter.wallId}-${i}`}
          position={[counter.position.x, counter.position.y, counter.position.z]}
        >
          <boxGeometry args={[counter.size.x, counter.size.y, counter.size.z]} />
          <meshStandardMaterial color="#ECE8E0" roughness={0.6} />
          <Edges color="#A9A29A" threshold={15} />
        </mesh>
      ))}

      <Grid
        infiniteGrid
        cellSize={100}
        sectionSize={500}
        cellColor="#E7E3DC"
        sectionColor="#D8D2C6"
        fadeDistance={12000}
        position={[0, 1, 0]}
      />
      <OrbitControls
        makeDefault
        enableDamping
        target={[cx, 850, cz]}
        maxPolarAngle={Math.PI * 0.55}
        minDistance={800}
        maxDistance={20000}
      />
    </Canvas>
  );
}
