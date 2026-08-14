import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "aewyo — ნახაზი და დიზაინი საათებში",
  description:
    "დიზაინი კლიენტის კედელზე კონსულტაციის დროსვე, ზუსტი ნახაზები და საჭრელი სიები საათებში. Design rendered at the consultation, precise drawings in hours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ka"
      data-lang="ka"
      // the inline lang-restore script may flip these attributes from
      // localStorage before hydration — that mismatch is intentional
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
