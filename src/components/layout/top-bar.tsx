"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import CommandSearch from "@/components/search/command-search"
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
  const [profile, setProfile] = useState<Profile | null>(null)

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
      <CommandSearch />

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right side actions ── */}
      <div className="flex items-center gap-3 shrink-0">
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
