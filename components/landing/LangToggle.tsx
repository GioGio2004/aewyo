"use client";

const LANG_KEY = "aewyo-lang";

function setLang(lang: "ka" | "en") {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // storage unavailable (private mode) — toggle still works for the session
  }
}

// Active state is styled from html[data-lang] in globals.css, so every
// instance of the toggle stays in sync without shared React state.
export default function LangToggle() {
  return (
    <div
      className="flex items-center gap-1 text-[13px] font-medium tracking-wide"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        data-lt="ka"
        onClick={() => setLang("ka")}
        className="lt rounded px-1.5 py-1"
      >
        KA
      </button>
      <span aria-hidden className="text-[var(--aw-line)]">
        /
      </span>
      <button
        type="button"
        data-lt="en"
        onClick={() => setLang("en")}
        className="lt rounded px-1.5 py-1"
      >
        EN
      </button>
    </div>
  );
}
