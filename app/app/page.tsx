import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";
import LangToggle from "@/components/landing/LangToggle";
import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import KitchenStudio from "@/components/studio/KitchenStudio";

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

export default async function AppPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div
      className={`${serif.variable} ${sans.variable} landing flex flex-1 flex-col bg-[var(--aw-paper)] text-[var(--aw-ink)] antialiased`}
    >
      <header className="border-b border-[var(--aw-line)]">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-aw-serif)] text-xl font-semibold tracking-tight"
            >
              aewyo
            </Link>
            <span className="text-sm text-[var(--aw-muted)]">
              <T s={copy.studio.title} />
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <LangToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <KitchenStudio />
    </div>
  );
}
