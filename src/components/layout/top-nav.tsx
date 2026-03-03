"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Menu, Watch, LogOut, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

const NAV_ITEMS = [
  { label: "Network", href: "/network" },
  { label: "Inventory", href: "/inventory" },
  { label: "Analytics", href: "/analytics" },
  { label: "Inquiries", href: "/inquiries" },
] as const

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

  const initials = getInitials(profile)

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{ backgroundColor: "rgba(11, 11, 20, 0.95)", backdropFilter: "blur(8px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* LEFT — Logo */}
        <Link href="/network" className="flex items-center gap-2 shrink-0">
          <Watch size={20} className="text-blue-500" />
          <span className="text-base font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            OpenWatch
          </span>
        </Link>

        {/* CENTER — Desktop nav */}
        <nav className="hidden md:flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-bg-hover"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* RIGHT — Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/inventory">
            <Button
              size="sm"
              className="text-sm py-1.5 px-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0"
            >
              List a Watch
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="outline-none focus:ring-0">
                <Avatar className="w-8 h-8 cursor-pointer ring-1 ring-border hover:ring-blue-500 transition-all">
                  <AvatarFallback className="bg-bg-elevated text-sm font-semibold text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-bg-card border-border text-foreground"
            >
              {profile && (
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-sm font-medium truncate">
                    {profile.full_name ?? profile.email}
                  </p>
                  {profile.company_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.company_name}
                    </p>
                  )}
                </div>
              )}
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User size={14} />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings size={14} />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 text-danger cursor-pointer focus:text-danger focus:bg-danger/10"
              >
                <LogOut size={14} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* RIGHT — Mobile hamburger */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Menu size={20} />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 bg-bg-card border-border-default p-0"
            >
              {/* Mobile profile header */}
              {profile && (
                <div className="px-4 py-4 border-b border-border flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-bg-elevated text-sm font-semibold text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
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
              <nav className="flex flex-col p-3 gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-muted-foreground hover:text-foreground hover:bg-bg-hover"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile bottom actions */}
              <div className="p-3 border-t border-border mt-auto flex flex-col gap-2">
                <Link href="/inventory" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0">
                    List a Watch
                  </Button>
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-bg-hover"
                >
                  <User size={14} />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-bg-hover"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors rounded-lg text-left"
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
