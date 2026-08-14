import type { LocalizedMessage } from "./types";

export type Decor = {
  id: string;
  name: LocalizedMessage;
  /** Flat fill for the 3D view */
  color: string;
  /** Edge line colour that stays visible on the fill */
  edge: string;
};

export const DECORS: Decor[] = [
  {
    id: "oak",
    name: { ka: "მუხა", en: "Oak" },
    color: "#D9C7A4",
    edge: "#6B5B44",
  },
  {
    id: "walnut",
    name: { ka: "კაკალი", en: "Walnut" },
    color: "#7A5A40",
    edge: "#3A2A1C",
  },
  {
    id: "stone-grey",
    name: { ka: "ქვისფერი", en: "Stone grey" },
    color: "#5B5652",
    edge: "#2B2825",
  },
  {
    id: "white",
    name: { ka: "თეთრი", en: "White" },
    color: "#F2F0EC",
    edge: "#8F887E",
  },
];

export const decorById = (id: string): Decor =>
  DECORS.find((d) => d.id === id) ?? DECORS[0];
