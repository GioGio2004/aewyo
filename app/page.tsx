import { Show } from "@clerk/nextjs";
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import Link from "next/link";
import Blueprint from "@/components/landing/Blueprint";
import LangToggle from "@/components/landing/LangToggle";
import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";

const serif = Noto_Serif_Georgian({
  subsets: ["georgian", "latin"],
  variable: "--font-aw-serif",
  display: "swap",
});

const sans = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  variable: "--font-aw-sans",
  display: "swap",
});

const display = "font-[family-name:var(--font-aw-serif)]";
const btnPrimary =
  "inline-flex h-11 items-center justify-center rounded-md bg-[var(--aw-walnut)] px-6 text-[15px] font-medium text-[#FAF9F6] transition-colors hover:bg-[var(--aw-walnut-hover)]";

export default function Home() {
  return (
    <div
      className={`${serif.variable} ${sans.variable} landing flex-1 bg-[var(--aw-paper)] text-[var(--aw-ink)] antialiased`}
    >
      {/* restore persisted language before the header paints (no flash) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var l=localStorage.getItem("aewyo-lang");if(l==="en"||l==="ka"){document.documentElement.dataset.lang=l;document.documentElement.lang=l;}}catch(e){}`,
        }}
      />

      {/* Header */}
      <header className="border-b border-[var(--aw-line)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className={`${display} text-xl font-semibold tracking-tight`}
          >
            aewyo
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <LangToggle />
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className={`${btnPrimary} h-9 px-4 text-sm`}
              >
                <T s={copy.nav.signIn} />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/app" className={`${btnPrimary} h-9 px-4 text-sm`}>
                <T s={copy.nav.openApp} />
              </Link>
            </Show>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <h1
              className={`${display} aw-rise max-w-[17ch] text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl`}
            >
              <T s={copy.hero.title} />
            </h1>
            <p
              className="aw-rise mt-6 max-w-[46ch] text-lg leading-8 text-[var(--aw-muted)]"
              style={{ animationDelay: "0.15s" }}
            >
              <T s={copy.hero.sub} />
            </p>
            <div
              className="aw-rise mt-10 flex flex-wrap items-center gap-6"
              style={{ animationDelay: "0.3s" }}
            >
              <Show when="signed-out">
                <Link href="/sign-up" className={btnPrimary}>
                  <T s={copy.hero.cta} />
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/app" className={btnPrimary}>
                  <T s={copy.hero.cta} />
                </Link>
              </Show>
              <a
                href="#how"
                className="text-[15px] font-medium underline decoration-[var(--aw-line)] underline-offset-8 transition-colors hover:decoration-[var(--aw-walnut)]"
              >
                <T s={copy.hero.secondary} />
              </a>
            </div>
          </div>
          <div className="lg:col-span-5">
            <Blueprint className="mx-auto w-full max-w-[480px]" />
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="border-t border-[var(--aw-line)] scroll-mt-16"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--aw-muted)]">
              <T s={copy.how.title} />
            </h2>
            <ol className="mt-10 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {copy.how.steps.map((step) => (
                <li key={step.num}>
                  <div
                    className={`${display} text-sm text-[var(--aw-muted)]`}
                    aria-hidden
                  >
                    {step.num}
                  </div>
                  <h3
                    className={`${display} mt-3 text-2xl font-semibold tracking-tight`}
                  >
                    <T s={step.title} />
                  </h3>
                  <p className="mt-3 max-w-[38ch] leading-7 text-[var(--aw-muted)]">
                    <T s={step.body} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why aewyo */}
        <section className="border-t border-[var(--aw-line)]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--aw-muted)]">
              <T s={copy.why.title} />
            </h2>
            <div className="mt-10 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {copy.why.values.map((value) => (
                <div key={value.title.en}>
                  <h3
                    className={`${display} text-2xl font-semibold tracking-tight`}
                  >
                    <T s={value.title} />
                  </h3>
                  <p className="mt-3 max-w-[38ch] leading-7 text-[var(--aw-muted)]">
                    <T s={value.body} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="bg-[var(--aw-ink)] text-[var(--aw-paper)]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-16 sm:px-8 sm:py-20 md:flex-row md:items-center md:justify-between">
            <p
              className={`${display} text-3xl font-semibold tracking-tight sm:text-4xl`}
            >
              <T s={copy.band.line} />
            </p>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className={`${btnPrimary} hover:bg-[#6E523D]`}
              >
                <T s={copy.band.cta} />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/app" className={`${btnPrimary} hover:bg-[#6E523D]`}>
                <T s={copy.band.cta} />
              </Link>
            </Show>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--aw-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-5">
            <span className={`${display} text-lg font-semibold tracking-tight`}>
              aewyo
            </span>
            <span className="text-sm text-[var(--aw-muted)]">© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="mailto:hello@aewyo.ge"
              className="text-sm text-[var(--aw-muted)] transition-colors hover:text-[var(--aw-ink)]"
            >
              hello@aewyo.ge
            </a>
            <LangToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
