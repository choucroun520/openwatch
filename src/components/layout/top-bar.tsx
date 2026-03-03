"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Watch } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

function getCompanyInitial(profile: Profile | null): string {
  if (!profile) return "D"
  if (profile.company_name) return profile.company_name[0].toUpperCase()
  if (profile.full_name)    return profile.full_name[0].toUpperCase()
  return profile.email[0].toUpperCase()
}

// Deterministic gradient from user id so the avatar colour stays stable
function avatarGradient(profile: Profile | null): string {
  if (!profile) return "linear-gradient(135deg, #2563eb, #7c3aed)"
  // Sum char codes of id for a cheap colour bucket
  const n = profile.id
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0) % 6
  const pairs = [
    ["#2563eb", "#7c3aed"],
    ["#0891b2", "#2563eb"],
    ["#7c3aed", "#db2777"],
    ["#059669", "#0891b2"],
    ["#d97706", "#dc2626"],
    ["#7c3aed", "#059669"],
  ]
  const [a, b] = pairs[n]
  return `linear-gradient(135deg, ${a}, ${b})`
}

export default function TopBar() {
  const router = useRouter()
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("id, role, full_name, company_name, email, avatar_url, verified")
        .eq("id", user.id)
        .single()

      if (data) setProfile(data as Profile)
    }

    load()
  }, [])

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) router.push(`/network?q=${encodeURIComponent(q)}`)
  }

  const initial  = getCompanyInitial(profile)
  const gradient = avatarGradient(profile)

  return (
    <header
      className="sticky top-0 z-30 shrink-0 flex items-center gap-3 px-4 sm:px-6"
      style={{
        height: "56px",
        backgroundColor: "#121212",
        borderBottom: "1px solid #222222",
      }}
    >
      {/* ── Search ── */}
      <form
        onSubmit={handleSearch}
        className="flex-1 max-w-[520px]"
      >
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#8A939B" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search watches, refs, dealers..."
            className={cn(
              "w-full h-9 pl-9 pr-4 rounded-lg text-sm",
              "focus:outline-none focus:ring-2 focus:ring-[#2081E2]/30 focus:border-[#2081E2]",
              "transition-all duration-150"
            )}
            style={{
              backgroundColor: "#1E1E2E",
              border: "1px solid #333333",
              color: "#ffffff",
            }}
            // Inline placeholder colour via CSS variable isn't possible in Tailwind v4 easily,
            // so we rely on the globals.css placeholder styling
          />
        </div>
      </form>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right side actions ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* List a Watch button */}
        <Link
          href="/inventory"
          className={cn(
            "hidden sm:inline-flex items-center gap-1.5",
            "h-9 px-4 rounded-lg text-sm font-bold text-white",
            "transition-opacity hover:opacity-90"
          )}
          style={{ backgroundColor: "#2081E2" }}
        >
          <Watch size={14} strokeWidth={2.2} />
          List a Watch
        </Link>

        {/* Dealer avatar */}
        <Link
          href="/profile"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-transparent hover:ring-[#2081E2] transition-all duration-150"
          style={{ background: gradient }}
          title={profile?.company_name ?? profile?.full_name ?? "Profile"}
        >
          {initial}
        </Link>
      </div>
    </header>
  )
}
