import type { LocalizedString } from "./copy";

// Renders both locales; html[data-lang] CSS in globals.css shows one.
// Keeps every section a server component — only the toggle is client code.
export default function T({ s }: { s: LocalizedString }) {
  return (
    <>
      <span lang="ka" className="l-ka">
        {s.ka}
      </span>
      <span lang="en" className="l-en">
        {s.en}
      </span>
    </>
  );
}
