"use client";

import { useState } from "react";
import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import { countHardware } from "@/lib/cabinet/solve";
import type { HardwareItem, Panel } from "@/lib/cabinet/types";
import type { PdfProgress } from "@/lib/exportPdf";
import type { KitchenLayout, KitchenProject } from "@/lib/kitchen/types";
import CutList from "./CutList";
import Elevation from "./Elevation";
import Hardware from "./Hardware";
import PlanView from "./PlanView";
import WallElevations from "./WallElevations";

const sectionTitle =
  "text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--aw-muted)]";

type TabKey = "all" | "plan" | "elevations" | "cutlist" | "card";

export default function LayoutModal({
  isOpen,
  onClose,
  project,
  layout,
  selectedId,
  onSelect,
  allPanels,
  allHardware,
  onExportPdf,
  exportProgress,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: KitchenProject;
  layout: KitchenLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allPanels: Panel[];
  allHardware: HardwareItem[];
  onExportPdf: () => void;
  exportProgress: PdfProgress | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  if (!isOpen) return null;

  const isExporting = exportProgress !== null;
  const selected = project.placements.find((p) => p.id === selectedId) ?? null;
  const selectedSolved = selected
    ? layout.cabinets.find((c) => c.placement.id === selected.id)
    : null;

  const totalCabinets = project.placements.length;
  const totalWalls = project.walls.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-6">
      {/* Backdrop click */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--aw-line)] bg-[var(--aw-paper)] text-[var(--aw-ink)] shadow-2xl">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--aw-line)] bg-white px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--aw-walnut)] text-white">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-[family-name:var(--font-aw-serif)] text-lg font-semibold tracking-tight sm:text-xl">
                  <T s={copy.studio.kitchen.layoutTitle} />
                </h2>
                <span className="hidden rounded-full bg-[var(--aw-paper)] px-2.5 py-0.5 text-xs font-medium text-[var(--aw-muted)] sm:inline-block">
                  {totalWalls} <T s={copy.studio.kitchen.walls} /> · {totalCabinets}{" "}
                  <T s={copy.studio.kitchen.cabinets} />
                </span>
              </div>
              <p className="text-xs text-[var(--aw-muted)]">
                <T s={copy.studio.kitchen.layoutSubtitle} />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Export PDF Button */}
            <button
              type="button"
              disabled={isExporting}
              onClick={onExportPdf}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--aw-walnut)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--aw-walnut-hover)] disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span className="tabular-nums">
                    <T s={copy.studio.kitchen.generatingPdf} />{" "}
                    {exportProgress.page}/{exportProgress.total}
                  </span>
                </>
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  <span>
                    <T s={copy.studio.kitchen.exportPdf} />
                  </span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--aw-line)] bg-white text-sm text-[var(--aw-muted)] hover:bg-[var(--aw-paper)] hover:text-[var(--aw-ink)]"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--aw-line)] bg-white/60 px-5 text-[13px] font-medium sm:px-8">
          <div className="flex gap-2 overflow-x-auto py-2">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "all"
                  ? "bg-[var(--aw-ink)] text-white"
                  : "text-[var(--aw-muted)] hover:bg-white hover:text-[var(--aw-ink)]"
              }`}
            >
              <T s={copy.studio.kitchen.allViews} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("plan")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "plan"
                  ? "bg-[var(--aw-ink)] text-white"
                  : "text-[var(--aw-muted)] hover:bg-white hover:text-[var(--aw-ink)]"
              }`}
            >
              <T s={copy.studio.kitchen.plan} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("elevations")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "elevations"
                  ? "bg-[var(--aw-ink)] text-white"
                  : "text-[var(--aw-muted)] hover:bg-white hover:text-[var(--aw-ink)]"
              }`}
            >
              <T s={copy.studio.kitchen.elevations} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cutlist")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "cutlist"
                  ? "bg-[var(--aw-ink)] text-white"
                  : "text-[var(--aw-muted)] hover:bg-white hover:text-[var(--aw-ink)]"
              }`}
            >
              <T s={copy.studio.kitchen.fullCutList} /> &{" "}
              <T s={copy.studio.hardware.title} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("card")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === "card"
                  ? "bg-[var(--aw-ink)] text-white"
                  : "text-[var(--aw-muted)] hover:bg-white hover:text-[var(--aw-ink)]"
              }`}
            >
              <T s={copy.studio.kitchen.card} />
              {selected && ` (${selected.label})`}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="mx-auto max-w-5xl space-y-10 rounded-lg bg-white p-6 shadow-sm border border-[var(--aw-line)]">
            {/* Document Header for Export / Overview */}
            <div className="flex flex-wrap items-end justify-between border-b border-[var(--aw-line)] pb-5">
              <div>
                <span className="font-[family-name:var(--font-aw-serif)] text-2xl font-bold tracking-tight text-[var(--aw-walnut)]">
                  aewyo
                </span>
                <h3 className="mt-1 text-base font-semibold text-[var(--aw-ink)]">
                  <T s={copy.studio.kitchen.packet} /> · {project.name || "Kitchen"}
                </h3>
              </div>
              <div className="text-right text-xs text-[var(--aw-muted)] space-y-1">
                <div>
                  <span className="font-medium">
                    <T s={copy.studio.kitchen.wallHeight} />:
                  </span>{" "}
                  {project.wallHeight} mm
                </div>
                <div>
                  <span className="font-medium">
                    <T s={copy.studio.kitchen.bandHeight} />:
                  </span>{" "}
                  {project.bandGap} mm
                </div>
                <div>
                  {project.walls.map((w) => `${w.id}: ${w.length}mm`).join(" · ")}
                </div>
              </div>
            </div>

            {/* 2D Plan View Section */}
            {(activeTab === "all" || activeTab === "plan") && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className={sectionTitle}>
                    <T s={copy.studio.kitchen.plan} />
                  </h2>
                  <span className="text-xs text-[var(--aw-muted)]">
                    Top-down 2D
                  </span>
                </div>
                <div className="rounded-md border border-[var(--aw-line)] bg-[var(--aw-paper)] p-4">
                  <PlanView
                    project={project}
                    layout={layout}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                </div>
              </section>
            )}

            {/* Wall Elevations Section */}
            {(activeTab === "all" || activeTab === "elevations") && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className={sectionTitle}>
                    <T s={copy.studio.kitchen.elevations} />
                  </h2>
                  <span className="text-xs text-[var(--aw-muted)]">
                    Front straight-on · mm
                  </span>
                </div>
                <div className="rounded-md border border-[var(--aw-line)] bg-[var(--aw-paper)] p-4">
                  <WallElevations
                    project={project}
                    layout={layout}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                </div>
              </section>
            )}

            {/* Assembly Card Section */}
            {(activeTab === "all" || activeTab === "card") && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className={sectionTitle}>
                    <T s={copy.studio.kitchen.card} />
                    {selected && (
                      <span className="normal-case tracking-normal text-[var(--aw-ink)]">
                        {" "}
                        · {selected.label}
                      </span>
                    )}
                  </h2>
                  {/* Cabinet selector buttons */}
                  <div className="flex flex-wrap gap-1">
                    {project.placements.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelect(p.id)}
                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                          selectedId === p.id
                            ? "bg-[var(--aw-walnut)] text-white"
                            : "bg-[var(--aw-paper)] text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selected && selectedSolved ? (
                  <div className="rounded-md border border-[var(--aw-line)] bg-[var(--aw-paper)] p-4">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="min-w-0">
                        <Elevation
                          panels={selectedSolved.panels}
                          params={selectedSolved.placement.params}
                        />
                      </div>
                      <div className="min-w-0 space-y-4">
                        <div className="overflow-x-auto rounded border border-[var(--aw-line)] bg-white p-2">
                          <CutList panels={selectedSolved.panels} />
                        </div>
                        <div className="rounded border border-[var(--aw-line)] bg-white p-3">
                          <Hardware
                            items={countHardware(
                              selectedSolved.placement.params
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-[var(--aw-line)] bg-[var(--aw-paper)] p-6 text-center text-sm text-[var(--aw-muted)]">
                    <T s={copy.studio.kitchen.selectHint} />
                  </div>
                )}
              </section>
            )}

            {/* Complete Cut List & Hardware Section */}
            {(activeTab === "all" || activeTab === "cutlist") && (
              <section className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className={sectionTitle}>
                      <T s={copy.studio.kitchen.fullCutList} />{" "}
                      <span className="normal-case tracking-normal">· mm</span>
                    </h2>
                    <span className="text-xs text-[var(--aw-muted)]">
                      {allPanels.length} <T s={copy.studio.table.part} />
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-md border border-[var(--aw-line)] bg-white p-2">
                    <CutList panels={allPanels} />
                  </div>
                </div>

                {allHardware.length > 0 && (
                  <div>
                    <h2 className={sectionTitle}>
                      <T s={copy.studio.hardware.title} />
                    </h2>
                    <div className="mt-3 max-w-md rounded-md border border-[var(--aw-line)] bg-white p-4">
                      <Hardware items={allHardware} />
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
