import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AppHeader } from "@/components/app/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoteForge — Visual Notes",
  description: "Author, import, sanitize and publish visual notes in the visual-notes/1 format.",
  keywords: ["NoteForge", "visual notes", "mermaid", "excalidraw", "Next.js"],
  authors: [{ name: "NoteForge" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased bg-stone-50 text-stone-900`}
      >
        <AppHeader />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="mt-auto border-t border-stone-200/70 bg-stone-100/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-stone-500 sm:flex-row">
            <p>NoteForge · visual-notes/1 · secure import &amp; publish</p>
            <p className="flex items-center gap-2">
              <span>Shared Renderer · one DOM contract for editor, preview &amp; public</span>
            </p>
          </div>
        </footer>
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
