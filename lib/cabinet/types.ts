export type LocalizedMessage = { ka: string; en: string };

export type FrontType = "none" | "doors" | "drawers";

/** Rendered appliance attached to the cabinet (visual layer, not panels) */
export type Appliance = "sink" | "oven" | "hob" | "fridge" | "hood";

// All dimensions in millimetres. Cabinet space: origin at the outer
// left-bottom-back corner; x = width, y = height, z = depth (front = +z).
export type CabinetParams = {
  /** Outer width */
  width: number;
  /** Outer height, plinth included */
  height: number;
  /** Outer carcass depth (back overlays behind, fronts sit proud in front) */
  depth: number;
  /** Carcass material thickness */
  thickness: number;
  /** Back panel material thickness */
  backThickness: number;
  /** Number of shelves inside the carcass (ignored for drawer fronts) */
  shelfCount: number;
  /** 0 = no plinth; otherwise carcass sits on a recessed front rail */
  plinthHeight: number;
  /** How far shelves stop short of the front edge */
  shelfSetback: number;
  /** What covers the carcass face */
  front: FrontType;
  /** Doors side by side (front === "doors") */
  doorCount: number;
  /** Drawer fronts stacked bottom-up (front === "drawers") */
  drawerCount: number;
  /** Gap between fronts and at the outer front edges */
  reveal: number;
  /** Front material thickness */
  frontThickness: number;
  /** Decor id for carcass panels (see decors.ts) */
  carcassDecor: string;
  /** Decor id for doors and drawer fronts */
  frontDecor: string;
  /** Optional appliance rendered with this cabinet */
  appliance?: Appliance;
};

export type PanelRole =
  | "side-left"
  | "side-right"
  | "top"
  | "bottom"
  | "shelf"
  | "back"
  | "plinth"
  | "door"
  | "drawer-front"
  | "drawer-side"
  | "drawer-rail"
  | "drawer-bottom";

export type Panel = {
  id: string;
  role: PanelRole;
  /** Full box dimensions in cabinet space */
  size: { x: number; y: number; z: number };
  /** Box centre in cabinet space */
  position: { x: number; y: number; z: number };
  /** Cut-list dimensions: length runs along the grain */
  cut: { length: number; width: number; thickness: number };
  /** Decor id (see decors.ts) */
  decor: string;
};

export type HardwareItem = {
  kind: "hinge" | "slide-pair";
  /** e.g. slide length "450 mm"; empty when not applicable */
  spec: string;
  qty: number;
};

export type ValidationError = {
  field: keyof CabinetParams;
  message: LocalizedMessage;
};
