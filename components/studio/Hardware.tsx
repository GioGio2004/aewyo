import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import type { HardwareItem } from "@/lib/cabinet/types";

const KIND_NAMES = {
  hinge: copy.studio.hardware.hinge,
  "slide-pair": copy.studio.hardware.slidePair,
} as const;

export default function Hardware({ items }: { items: HardwareItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="text-[15px]">
      {items.map((item) => (
        <li
          key={item.kind + item.spec}
          className="flex items-baseline justify-between border-t border-[var(--aw-line)] py-2.5"
        >
          <span>
            <T s={KIND_NAMES[item.kind]} />
            {item.spec && (
              <span className="text-[var(--aw-muted)]"> · {item.spec}</span>
            )}
          </span>
          <span className="tabular-nums">{item.qty}</span>
        </li>
      ))}
    </ul>
  );
}
