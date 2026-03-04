"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Search,
  Settings,
  Shield,
  Watch,
  Tag,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

// ─── Nav item definitions ────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  adminOnly?: boolean
}

const TOP_NAV: NavItem[] = [
  { icon: BarChart3,   label: "Analytics",   href: "/analytics" },
  { icon: TrendingUp,  label: "Trending",    href: "/trending" },
  { icon: DollarSign,  label: "Sold",        href: "/sold" },
  { icon: Tag,         label: "Brands",      href: "/brands" },
  { icon: Users,       label: "Dealers",     href: "/dealers" },
  { icon: Search,      label: "Search Refs", href: "/ref" },
]

const BOTTOM_NAV: NavItem[] = [
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: Shield,   label: "Admin",    href: "/admin", adminOnly: true },
]

// ─── Single nav row ──────────────────────────────────────────────────────────

interface NavRowProps {
  item: NavItem
  isActive: boolean
}

function NavRow({ item, isActive }: NavRowProps) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "group/row relative flex items-center h-11 px-4 gap-3 rounded-lg transition-colors duration-150",
        "hover:bg-[var(--ow-bg-hover)]",
        isActive ? "text-white" : "text-[#8A939B] hover:text-white"
      )}
    >
      {/* Active left-border indicator */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r"
          style={{ backgroundColor: "#2081E2" }}
        />
      )}

      {/* Icon — always visible, centered when collapsed */}
      <span className="shrink-0 flex items-center justify-center w-5">
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
      </span>

      {/* Label — hidden when collapsed, shown via group-hover */}
      <span
        className={cn(
          "text-[14px] font-medium whitespace-nowrap overflow-hidden transition-all duration-200",
          // parent sidebar uses `group`, so label appears on sidebar hover
          "max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100"
        )}
      >
        {item.label}
      </span>
    </Link>
  )
}

// ─── Separator ───────────────────────────────────────────────────────────────

function SidebarSeparator() {
  return (
    <div
      className="mx-3 my-2 h-px"
      style={{ backgroundColor: "var(--border)" }}
    />
  )
}

// ─── Main Sidebar ────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)

  // Fetch profile to check admin role
  useEffect(() => {
    const supabase = createClient()

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("id, role, full_name, company_name, email, avatar_url")
        .eq("id", user.id)
        .single()

      if (data) setProfile(data as Profile)
    }

    loadProfile()
  }, [])

  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin"

  // Active-state matching: exact for "/", prefix for everything else
  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  // Derive company initial for bottom avatar
  const companyInitial =
    profile?.company_name?.[0]?.toUpperCase() ??
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.email?.[0]?.toUpperCase() ??
    "D"

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside
        // `group` enables group-hover on children
        className={cn(
          "group",
          "hidden lg:flex flex-col",
          "fixed left-0 top-0 bottom-0 z-40",
          "w-[72px] hover:w-[220px]",
          "transition-[width] duration-200 ease-in-out",
          "overflow-hidden"
        )}
        style={{ backgroundColor: "var(--background)" }}
      >
        {/* ── Logo area ─── */}
        <div className="flex items-center h-[56px] px-4 shrink-0 overflow-hidden">
          {/* Icon: always visible */}
          <Watch
            size={28}
            strokeWidth={1.8}
            className="shrink-0 text-white"
          />

          {/* Wordmark: fades in on hover */}
          <span
            className={cn(
              "ml-3 text-[18px] font-bold text-white whitespace-nowrap",
              "overflow-hidden transition-all duration-200",
              "max-w-0 opacity-0 group-hover:max-w-[160px] group-hover:opacity-100"
            )}
          >
            OpenWatch
          </span>
        </div>

        {/* ── Top nav ─── */}
        <nav className="flex flex-col gap-0.5 px-2 pt-2">
          {TOP_NAV.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
            />
          ))}
        </nav>

        <SidebarSeparator />

        {/* ── Bottom nav ─── */}
        <nav className="flex flex-col gap-0.5 px-2">
          {BOTTOM_NAV.filter(
            (item) => !item.adminOnly || isAdmin
          ).map((item) => (
            <NavRow
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
            />
          ))}
        </nav>

        {/* ── Spacer ─── */}
        <div className="flex-1" />

        {/* ── Footer (visible only when expanded) ─── */}
        <div className="shrink-0">
          <SidebarSeparator />
          <div
            className={cn(
              "px-4 py-3 overflow-hidden transition-all duration-200",
              "max-w-0 opacity-0 group-hover:max-w-[220px] group-hover:opacity-100"
            )}
          >
            <p className="text-[10px] whitespace-nowrap" style={{ color: "#8A939B" }}>
              OpenWatch v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ────────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around"
        style={{
          backgroundColor: "var(--background)",
          borderTop: "1px solid var(--border)",
          height: "60px",
        }}
      >
        {[
          { icon: BarChart3,  label: "Analytics",  href: "/analytics" },
          { icon: TrendingUp, label: "Trending",   href: "/trending" },
          { icon: Tag,        label: "Brands",     href: "/brands" },
          { icon: Users,      label: "Dealers",    href: "/dealers" },
          { icon: Search,     label: "Search",     href: "/ref" },
        ].map(({ icon: Icon, label, href }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 px-3 py-1"
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? "#ffffff" : "#8A939B"}
              />
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: active ? "#ffffff" : "#8A939B" }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
