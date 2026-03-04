/**
 * app-layout.tsx
 *
 * Server-compatible layout wrapper (no "use client" on this file).
 * Composes:
 *   - <Sidebar />     — fixed left, client component
 *   - <TopBar />      — sticky top, client component (defined below)
 *   - children        — page content
 *
 * Main content is offset by the collapsed sidebar width (72px) on lg+.
 * The sidebar itself handles its hover→expand transition independently via CSS.
 */

import Sidebar from "./sidebar"
import TopBar from "./top-bar"

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--ow-bg)" }}>
      {/* Fixed left sidebar — renders on top of everything, z-40 */}
      <Sidebar />

      {/*
       * Main content area.
       * On lg+ screens: offset by 72px (collapsed sidebar width).
       * We do NOT try to mirror the sidebar's 220px hover expansion here —
       * the sidebar floats over content when expanded, exactly like VS Code /
       * Discord sidebar behaviour. This avoids the JS state sync complexity.
       */}
      <div className="lg:ml-[72px] flex flex-col min-h-screen">
        {/* Sticky top bar */}
        <TopBar />

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}
