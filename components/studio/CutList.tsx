import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import type { LocalizedString } from "@/components/landing/copy";
import { decorById } from "@/lib/cabinet/decors";
import type { Panel, PanelRole } from "@/lib/cabinet/types";

type PartGroup =
  | "side"
  | "top"
  | "bottom"
  | "shelf"
  | "back"
  | "plinth"
  | "door"
  | "drawerFront"
  | "drawerSide"
  | "drawerRail"
  | "drawerBottom"
  | "blindPanel";

const GROUP_ORDER: PartGroup[] = [
  "side",
  "top",
  "bottom",
  "shelf",
  "back",
  "plinth",
  "door",
  "blindPanel",
  "drawerFront",
  "drawerSide",
  "drawerRail",
  "drawerBottom",
];

const ROLE_TO_GROUP: Record<PanelRole, PartGroup> = {
  "side-left": "side",
  "side-right": "side",
  top: "top",
  bottom: "bottom",
  shelf: "shelf",
  back: "back",
  plinth: "plinth",
  door: "door",
  "drawer-front": "drawerFront",
  "drawer-side": "drawerSide",
  "drawer-rail": "drawerRail",
  "drawer-bottom": "drawerBottom",
  "blind-panel": "blindPanel",
};

const GROUP_NAMES: Record<PartGroup, LocalizedString> = copy.studio.parts;

type Row = {
  group: PartGroup;
  decor: string;
  qty: number;
  length: number;
  width: number;
  thickness: number;
};

function toRows(panels: Panel[]): Row[] {
  const rows = new Map<string, Row>();
  for (const panel of panels) {
    const group = ROLE_TO_GROUP[panel.role];
    const key = `${group}:${panel.decor}:${panel.cut.length}x${panel.cut.width}x${panel.cut.thickness}`;
    const row = rows.get(key);
    if (row) {
      row.qty += 1;
    } else {
      rows.set(key, { group, decor: panel.decor, qty: 1, ...panel.cut });
    }
  }
  return [...rows.values()].sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
  );
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function CutList({ panels }: { panels: Panel[] }) {
  const rows = toRows(panels);
  const th =
    "whitespace-nowrap pb-3 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--aw-muted)] last:pr-0";
  const td =
    "whitespace-nowrap border-t border-[var(--aw-line)] py-2.5 pr-4 tabular-nums last:pr-0";
  return (
    <table className="w-full min-w-[440px] text-[14px]">
      <thead>
        <tr>
          <th className={th}>
            <T s={copy.studio.table.part} />
          </th>
          <th className={th}>
            <T s={copy.studio.decorColumn} />
          </th>
          <th className={`${th} text-right`}>
            <T s={copy.studio.table.qty} />
          </th>
          <th className={`${th} text-right`}>
            <T s={copy.studio.table.length} />
          </th>
          <th className={`${th} text-right`}>
            <T s={copy.studio.table.width} />
          </th>
          <th className={`${th} text-right`}>
            <T s={copy.studio.table.thickness} />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.group}-${row.decor}-${row.length}-${row.width}-${row.thickness}`}
          >
            <td className={td}>
              <T s={GROUP_NAMES[row.group]} />
            </td>
            <td className={`${td} text-[var(--aw-muted)]`}>
              <T s={decorById(row.decor).name} />
            </td>
            <td className={`${td} text-right`}>{row.qty}</td>
            <td className={`${td} text-right`}>{fmt(row.length)}</td>
            <td className={`${td} text-right`}>{fmt(row.width)}</td>
            <td className={`${td} text-right text-[var(--aw-muted)]`}>
              {fmt(row.thickness)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
