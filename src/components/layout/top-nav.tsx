"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Menu,
  Watch,
  LogOut,
  Settings,
  User,
  Search,
  Bell,
  BarChart3,
  Activity,
  ChevronDown,
  Network,
  Package,
  TrendingUp,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

function getInitials(profile: Profile | null): string {
  if (!profile) return "?"
  if (profile.full_name) {
    return profile.full_name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }
  return profile.email[0].toUpperCase()
}

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (data) setProfile(data as Profile)
    }

    loadProfile()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/network?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const initials = getInitials(profile)

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "rgba(11, 11, 20, 0.96)",
        backdropFilter: "blur(12px)",
        borderColor: "#1c1c2a",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 h-[72px] flex items-center gap-3">
        {/* LEFT — Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <Watch size={22} className="text-blue-500" />
          <span className="text-lg font-black bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent hidden sm:block">
            OpenWatch
          </span>
        </Link>

        {/* CENTER — Search bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-xl hidden md:block"
        >
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search watches, references, dealers..."
              className="w-full h-10 pl-9 pr-4 rounded-xl text-sm bg-bg-elevated border border-border-default focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-foreground placeholder:text-muted-foreground transition-all"
              style={{ background: "#161622", borderColor: "#1c1c2a" }}
            />
          </div>
        </form>

        {/* RIGHT — Desktop actions */}
        <div className="hidden md:flex items-center gap-1 ml-auto">
          {/* Explore dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith("/network") || pathname.startsWith("/collection")
                    ? "text-foreground bg-bg-elevated"
                    : "text-muted-foreground hover:text-foreground hover:bg-bg-elevated"
                )}
              >
                Explore
                <ChevronDown size={13} className="opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 bg-bg-card border-border-default"
            >
              <DropdownMenuItem asChild>
                <Link href="/network" className="flex items-center gap-3 cursor-pointer">
                  <Network size={15} className="text-blue-400" />
                  <div>
                    <p className="text-sm font-medium">Network</p>
                    <p className="text-xs text-muted-foreground">Browse all listings</p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/rankings" className="flex items-center gap-3 cursor-pointer">
                  <TrendingUp size={15} className="text-green-400" />
                  <div>
                    <p className="text-sm font-medium">Rankings</p>
                    <p className="text-xs text-muted-foreground">Brand stats &amp; floor prices</p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/activity" className="flex items-center gap-3 cursor-pointer">
                  <Activity size={15} className="text-purple-400" />
                  <div>
                    <p className="text-sm font-medium">Activity</p>
                    <p className="text-xs text-muted-foreground">Live deal feed</p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/analytics" className="flex items-center gap-3 cursor-pointer">
                  <BarChart3 size={15} className="text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium">Analytics</p>
                    <p className="text-xs text-muted-foreground">Market intelligence</p>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Stats link */}
          <Link
            href="/rankings"
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === "/rankings"
                ? "text-foreground bg-bg-elevated"
                : "text-muted-foreground hover:text-foreground hover:bg-bg-elevated"
            )}
          >
            Stats
          </Link>

          {/* Activity link */}
          <Link
            href="/activity"
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === "/activity"
                ? "text-foreground bg-bg-elevated"
                : "text-muted-foreground hover:text-foreground hover:bg-bg-elevated"
            )}
          >
            Activity
          </Link>

          {/* Notification bell */}
          <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-bg-elevated transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
          </button>

          {/* List a Watch */}
          <Link href="/inventory">
            <Button
              size="sm"
              className="text-sm px-4 h-9 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0 ml-1"
            >
              List a Watch
            </Button>
          </Link>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="outline-none focus:ring-0 ml-1">
                <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-border-default hover:ring-blue-500 transition-all">
                  <AvatarFallback
                    className="text-sm font-bold text-foreground"
                    style={{ background: "#1a1a28" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-bg-card border-border-default text-foreground"
            >
              {profile && (
                <div className="px-3 py-3 border-b border-border-default mb-1">
                  <p className="text-sm font-semibold truncate">
                    {profile.full_name ?? profile.email}
                  </p>
                  {profile.company_name && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {profile.company_name}
                    </p>
                  )}
                  {profile.verified && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full font-semibold">
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-current">
                        <path d="M10.3 3.3L5 8.6 1.7 5.3 0.3 6.7 5 11.4l6.7-6.7-1.4-1.4z" />
                      </svg>
                      Verified Dealer
                    </span>
                  )}
                </div>
              )}
              <DropdownMenuItem asChild>
                <Link href="/inventory" className="flex items-center gap-2.5 cursor-pointer">
                  <Package size={14} className="text-muted-foreground" />
                  My Inventory
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/inquiries" className="flex items-center gap-2.5 cursor-pointer">
                  <BookOpen size={14} className="text-muted-foreground" />
                  Inquiries
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border-default" />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2.5 cursor-pointer">
                  <User size={14} className="text-muted-foreground" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2.5 cursor-pointer">
                  <Settings size={14} className="text-muted-foreground" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border-default" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2.5 text-danger cursor-pointer focus:text-danger focus:bg-danger/10"
              >
                <LogOut size={14} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* MOBILE: Search + Hamburger */}
        <div className="md:hidden flex items-center gap-2 ml-auto">
          <button
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => searchRef.current?.focus()}
          >
            <Search size={18} />
          </button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Menu size={20} />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-80 p-0"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              {/* Mobile search */}
              <div className="p-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                <form onSubmit={(e) => { handleSearchSubmit(e); setMobileOpen(false) }}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full h-9 pl-8 pr-3 rounded-lg text-sm border text-foreground placeholder:text-muted-foreground focus:outline-none"
                      style={{ background: "#161622", borderColor: "#1c1c2a" }}
                    />
                  </div>
                </form>
              </div>

              {/* Mobile profile header */}
              {profile && (
                <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: "#1c1c2a" }}>
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="text-sm font-bold text-foreground" style={{ background: "#1a1a28" }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {profile.full_name ?? profile.email}
                    </p>
                    {profile.company_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {profile.company_name}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile nav links */}
              <nav className="flex flex-col p-3 gap-0.5">
                {[
                  { label: "Network", href: "/network", icon: Network },
                  { label: "Rankings", href: "/rankings", icon: TrendingUp },
                  { label: "Activity", href: "/activity", icon: Activity },
                  { label: "Analytics", href: "/analytics", icon: BarChart3 },
                  { label: "My Inventory", href: "/inventory", icon: Package },
                  { label: "Inquiries", href: "/inquiries", icon: BookOpen },
                ].map(({ label, href, icon: Icon }) => {
                  const isActive = pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-muted-foreground hover:text-foreground hover:bg-bg-elevated"
                      )}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile bottom actions */}
              <div className="p-3 border-t mt-auto flex flex-col gap-2" style={{ borderColor: "#1c1c2a" }}>
                <Link href="/inventory" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0">
                    List a Watch
                  </Button>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors rounded-lg text-left"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
