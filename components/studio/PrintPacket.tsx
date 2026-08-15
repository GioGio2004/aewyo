"use client";

import { forwardRef } from "react";
import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import type { LocalizedString } from "@/components/landing/copy";
import { decorById } from "@/lib/cabinet/decors";
import { countHardware } from "@/lib/cabinet/solve";
import type { HardwareItem, Panel } from "@/lib/cabinet/types";
import { PAGE_PX } from "@/lib/exportPdf";
import { countCornerHardware } from "@/lib/kitchen/corner";
import type {
  Band,
  KitchenLayout,
  KitchenProject,
  PlacedCabinet,
} from "@/lib/kitchen/types";
import CornerDrawing from "./CornerDrawing";
import CutList from "./CutList";
import Elevation from "./Elevation";
import Hardware from "./Hardware";
import PlanView from "./PlanView";
import WallElevations from "./WallElevations";

// Off-screen, print-formatted document. Every [data-pdf-page] section
// becomes (at least) one A4 page. Only hex colours and CSS vars are used
// so html2canvas rasterises it faithfully.

const INK = "#1C1917";
const MUTED = "#78716C";
const LINE = "#E7E3DC";
const WALNUT = "#5E4634";

const BAND_NAME: Record<Band, LocalizedString> = {
  base: copy.studio.kitchen.bandBase,
  wall: copy.studio.kitchen.bandWall,
  tall: copy.studio.kitchen.bandTall,
};

const APPLIANCE_NAME: Record<string, LocalizedString> = {
  sink: copy.studio.kitchen.presets.sink,
  oven: copy.studio.kitchen.presets.oven,
  hob: copy.studio.kitchen.presets.hob,
  fridge: copy.studio.kitchen.presets.fridge,
  hood: copy.studio.kitchen.presets.hood,
};

const FRONT_NAME = {
  none: copy.studio.front.none,
  doors: copy.studio.front.doors,
  drawers: copy.studio.front.drawers,
} as const;

function PageHeader({
  project,
  title,
  date,
}: {
  project: KitchenProject;
  title: React.ReactNode;
  date: string;
}) {
  return (
    <div
      className="mb-6 flex items-end justify-between border-b pb-3"
      style={{ borderColor: LINE }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-[family-name:var(--font-aw-serif)] text-[20px] font-semibold tracking-tight"
          style={{ color: WALNUT }}
        >
          aewyo
        </span>
        <span className="text-[13px]" style={{ color: MUTED }}>
          {project.name}
        </span>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-medium" style={{ color: INK }}>
          {title}
        </div>
        <div className="text-[11px]" style={{ color: MUTED }}>
          {date}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em]"
      style={{ color: MUTED }}
    >
      {children}
    </h2>
  );
}

function CabinetCard({ cabinet }: { cabinet: PlacedCabinet }) {
  const p = cabinet.placement;
  const params = p.params;
  const isCorner = p.kind === "corner" && !!p.corner;
  const hardware = isCorner
    ? countCornerHardware(params, p.corner!)
    : countHardware(params);
  const facts: Array<[React.ReactNode, React.ReactNode]> = isCorner
    ? [
        [
          <T key="w" s={copy.studio.kitchen.corner} />,
          `${cabinet.corner?.wallA ?? p.wallId} → ${cabinet.corner?.wallB ?? ""}`,
        ],
        [<T key="b" s={copy.studio.kitchen.band} />, <T key="bv" s={BAND_NAME[p.band]} />],
        [
          <T key="st" s={copy.studio.kitchen.cornerStyle} />,
          <T
            key="stv"
            s={
              p.corner!.style === "blind"
                ? copy.studio.kitchen.blind
                : copy.studio.kitchen.diagonal
            }
          />,
        ],
        [
          <T key="la" s={copy.studio.kitchen.legA} />,
          `${cabinet.corner?.wallA ?? p.wallId} · ${p.corner!.legA} mm`,
        ],
        [
          <T key="lb" s={copy.studio.kitchen.legB} />,
          `${cabinet.corner?.wallB ?? ""} · ${p.corner!.legB} mm`,
        ],
      ]
    : [
    [<T key="w" s={copy.studio.kitchen.wall} />, `${p.wallId} · ${cabinet.runPos} mm`],
    [<T key="b" s={copy.studio.kitchen.band} />, <T key="bv" s={BAND_NAME[p.band]} />],
    [
      <T key="f" s={copy.studio.front.label} />,
      <>
        <T s={FRONT_NAME[params.front]} />
        {params.front === "doors" && ` · ${params.doorCount}`}
        {params.front === "drawers" && ` · ${params.drawerCount}`}
      </>,
    ],
    [
      <T key="cd" s={copy.studio.front.carcassDecor} />,
      <T key="cdv" s={decorById(params.carcassDecor).name} />,
    ],
  ];
  if (params.front !== "none") {
    facts.push([
      <T key="fd" s={copy.studio.front.frontDecor} />,
      <T key="fdv" s={decorById(params.frontDecor).name} />,
    ]);
  }
  if (params.appliance) {
    facts.push([
      <T key="ap" s={copy.studio.kitchen.appliance} />,
      <T key="apv" s={APPLIANCE_NAME[params.appliance]} />,
    ]);
  }
  if (params.front !== "drawers") {
    facts.push([
      <T key="sh" s={copy.studio.fields.shelfCount} />,
      String(params.shelfCount),
    ]);
  }
  facts.push([
    <T key="mt" s={copy.studio.fields.thickness} />,
    `${params.thickness} / ${params.backThickness} mm`,
  ]);
  if (params.plinthHeight > 0) {
    facts.push([
      <T key="pl" s={copy.studio.fields.plinthHeight} />,
      `${params.plinthHeight} mm`,
    ]);
  }

  return (
    <>
      <div className="mb-5 flex items-baseline gap-4">
        <span
          className="font-[family-name:var(--font-aw-serif)] text-[34px] font-semibold tracking-tight"
          style={{ color: INK }}
        >
          {p.label}
        </span>
        <span className="text-[16px] tabular-nums" style={{ color: MUTED }}>
          {isCorner
            ? `${p.corner!.legA} × ${p.corner!.legB} × ${params.height} mm`
            : `${params.width} × ${params.height} × ${params.depth} mm`}
        </span>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-10">
        <div>
          {isCorner ? (
            <CornerDrawing cabinet={cabinet} />
          ) : (
            <Elevation panels={cabinet.panels} params={params} />
          )}
        </div>
        <table className="w-full self-start text-[12px]">
          <tbody>
            {facts.map(([k, v], i) => (
              <tr key={i} className="border-t" style={{ borderColor: LINE }}>
                <td className="py-1.5 pr-4" style={{ color: MUTED }}>
                  {k}
                </td>
                <td className="py-1.5 tabular-nums" style={{ color: INK }}>
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <SectionTitle>
          <T s={copy.studio.cutList} /> · mm
        </SectionTitle>
        <CutList panels={cabinet.panels} />
      </div>

      {hardware.length > 0 && (
        <div className="mt-6 max-w-[360px]">
          <SectionTitle>
            <T s={copy.studio.hardware.title} />
          </SectionTitle>
          <Hardware items={hardware} />
        </div>
      )}
    </>
  );
}

const PrintPacket = forwardRef<
  HTMLDivElement,
  {
    project: KitchenProject;
    layout: KitchenLayout;
    allPanels: Panel[];
    allHardware: HardwareItem[];
    /** PNG data URL of the 3D view for the cover */
    snapshot?: string | null;
  }
>(function PrintPacket(
  { project, layout, allPanels, allHardware, snapshot },
  ref,
) {
  const date = new Date().toLocaleDateString("en-GB");
  const cabinets = layout.cabinets.filter(
    (c) => c.placement.kind !== "spacer",
  );
  const spacers = layout.cabinets.filter((c) => c.placement.kind === "spacer");
  const page = "bg-white px-[44px] py-[40px] text-[13px] leading-normal";
  const noop = () => {};

  // material palette: every decor used, carcass or front
  const decorIds = [
    ...new Set(
      cabinets.flatMap((c) => [
        c.placement.params.carcassDecor,
        ...(c.placement.params.front !== "none" || c.placement.kind === "corner"
          ? [c.placement.params.frontDecor]
          : []),
      ]),
    ),
  ];
  const highlights = {
    doors: allPanels.filter((p) => p.role === "door").length,
    drawers: allPanels.filter((p) => p.role === "drawer-front").length,
    appliances: cabinets.filter((c) => c.placement.params.appliance).length,
    corners: cabinets.filter((c) => c.placement.kind === "corner").length,
    panels: allPanels.length,
  };

  return (
    <div
      ref={ref}
      aria-hidden
      className="landing pointer-events-none fixed left-[-20000px] top-0"
      style={{ width: PAGE_PX, color: INK, background: "#fff" }}
    >
      {/* 1 · cover: 3D view, facts, palette, highlights */}
      <section data-pdf-page className={page} style={{ width: PAGE_PX }}>
        <PageHeader
          project={project}
          title={<T s={copy.studio.kitchen.packet} />}
          date={date}
        />
        <div className="mb-6">
          <div
            className="font-[family-name:var(--font-aw-serif)] text-[30px] font-semibold tracking-tight"
            style={{ color: INK }}
          >
            {project.name}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: MUTED }}>
            {project.walls.length} <T s={copy.studio.kitchen.walls} /> ·{" "}
            {cabinets.length} <T s={copy.studio.kitchen.cabinets} /> ·{" "}
            {project.walls.reduce((sum, w) => sum + w.length, 0)} mm
          </div>
        </div>
        {snapshot && (
          <div
            className="mb-6 overflow-hidden rounded border"
            style={{ borderColor: LINE, background: "#FAF9F6" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshot}
              alt=""
              style={{ width: "100%", maxHeight: 400, objectFit: "cover" }}
            />
          </div>
        )}
        <div className="grid grid-cols-3 gap-6 text-[12px]">
          <div>
            <div style={{ color: MUTED }}>
              <T s={copy.studio.kitchen.walls} />
            </div>
            <div className="mt-1 tabular-nums">
              {project.walls.map((w) => `${w.id} ${w.length}`).join(" · ")} mm
            </div>
          </div>
          <div>
            <div style={{ color: MUTED }}>
              <T s={copy.studio.kitchen.wallHeight} />
            </div>
            <div className="mt-1 tabular-nums">{project.wallHeight} mm</div>
          </div>
          <div>
            <div style={{ color: MUTED }}>
              <T s={copy.studio.kitchen.bandHeight} />
            </div>
            <div className="mt-1 tabular-nums">{project.bandGap} mm</div>
          </div>
        </div>

        {/* material palette + highlights, like a design sheet */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <SectionTitle>
              <T s={copy.studio.kitchen.materials} />
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {decorIds.map((id) => {
                const d = decorById(id);
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span
                      className="h-10 w-10 shrink-0 rounded"
                      style={{ background: d.color, border: `1px solid ${d.edge}` }}
                    />
                    <span className="text-[12px]" style={{ color: INK }}>
                      <T s={d.name} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <SectionTitle>
              <T s={copy.studio.kitchen.overview} />
            </SectionTitle>
            <table className="w-full text-[12px]">
              <tbody>
                {(
                  [
                    [<T key="c" s={copy.studio.kitchen.cabinets} />, cabinets.length],
                    [<T key="d" s={copy.studio.front.doors} />, highlights.doors],
                    [<T key="dr" s={copy.studio.front.drawers} />, highlights.drawers],
                    [<T key="a" s={copy.studio.kitchen.appliance} />, highlights.appliances],
                    [<T key="co" s={copy.studio.kitchen.corner} />, highlights.corners],
                    [<T key="p" s={copy.studio.table.part} />, highlights.panels],
                  ] as Array<[React.ReactNode, number]>
                ).map(([k, v], i) => (
                  <tr key={i} className="border-t" style={{ borderColor: LINE }}>
                    <td className="py-1.5" style={{ color: MUTED }}>
                      {k}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 2 · plan + contents */}
      <section data-pdf-page className={page} style={{ width: PAGE_PX }}>
        <PageHeader
          project={project}
          title={<T s={copy.studio.kitchen.plan} />}
          date={date}
        />
        <div
          className="mx-auto rounded border p-3"
          style={{ borderColor: LINE }}
        >
          <PlanView
            project={project}
            layout={layout}
            selectedId={null}
            onSelect={noop}
          />
        </div>

        <div className="mt-8">
          <SectionTitle>
            <T s={copy.studio.kitchen.summary} /> · {cabinets.length}{" "}
            <T s={copy.studio.kitchen.cabinets} />
          </SectionTitle>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ color: MUTED }}>
                <th className="pb-2 text-left font-medium">#</th>
                <th className="pb-2 text-left font-medium">
                  <T s={copy.studio.kitchen.wall} />
                </th>
                <th className="pb-2 text-left font-medium">
                  <T s={copy.studio.kitchen.band} />
                </th>
                <th className="pb-2 text-right font-medium">W × H × D</th>
                <th className="pb-2 text-left font-medium" style={{ paddingLeft: 16 }}>
                  <T s={copy.studio.front.label} />
                </th>
                <th className="pb-2 text-left font-medium">
                  <T s={copy.studio.decorColumn} />
                </th>
              </tr>
            </thead>
            <tbody>
              {[...cabinets, ...spacers].map((c) => {
                const p = c.placement;
                const isSpacer = p.kind === "spacer";
                return (
                  <tr
                    key={p.id}
                    className="border-t"
                    style={{ borderColor: LINE }}
                  >
                    <td className="py-1.5 font-medium">{p.label}</td>
                    <td className="py-1.5">{p.wallId}</td>
                    <td className="py-1.5">
                      {isSpacer ? (
                        <T s={copy.studio.kitchen.spacer} />
                      ) : (
                        <T s={BAND_NAME[p.band]} />
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {isSpacer
                        ? p.params.width
                        : `${p.params.width} × ${p.params.height} × ${p.params.depth}`}
                    </td>
                    <td className="py-1.5" style={{ paddingLeft: 16 }}>
                      {isSpacer ? "—" : (
                        <>
                          <T s={FRONT_NAME[p.params.front]} />
                          {p.params.appliance && (
                            <>
                              {" · "}
                              <T s={APPLIANCE_NAME[p.params.appliance]} />
                            </>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-1.5">
                      {isSpacer ? "—" : (
                        <>
                          <T s={decorById(p.params.carcassDecor).name} />
                          {p.params.front !== "none" && (
                            <>
                              {" / "}
                              <T s={decorById(p.params.frontDecor).name} />
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2 · wall elevations */}
      <section data-pdf-page className={page} style={{ width: PAGE_PX }}>
        <PageHeader
          project={project}
          title={<T s={copy.studio.kitchen.elevations} />}
          date={date}
        />
        <WallElevations
          project={project}
          layout={layout}
          selectedId={null}
          onSelect={noop}
          singleColumn
        />
      </section>

      {/* 3 · full cut list + hardware */}
      <section data-pdf-page className={page} style={{ width: PAGE_PX }}>
        <PageHeader
          project={project}
          title={<T s={copy.studio.kitchen.fullCutList} />}
          date={date}
        />
        <SectionTitle>
          <T s={copy.studio.kitchen.fullCutList} /> · mm
        </SectionTitle>
        <CutList panels={allPanels} />
        {allHardware.length > 0 && (
          <div className="mt-8 max-w-[360px]">
            <SectionTitle>
              <T s={copy.studio.hardware.title} />
            </SectionTitle>
            <Hardware items={allHardware} />
          </div>
        )}
      </section>

      {/* 4… · one assembly card per cabinet */}
      {cabinets.map((cabinet) => (
        <section
          key={cabinet.placement.id}
          data-pdf-page
          className={page}
          style={{ width: PAGE_PX }}
        >
          <PageHeader
            project={project}
            title={
              <>
                <T s={copy.studio.kitchen.card} /> · {cabinet.placement.label}
              </>
            }
            date={date}
          />
          <CabinetCard cabinet={cabinet} />
        </section>
      ))}
    </div>
  );
});

export default PrintPacket;
