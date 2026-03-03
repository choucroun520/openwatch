/*
  Run in Supabase SQL editor before using this route:

  create table sentiment_reports (
    id uuid default gen_random_uuid() primary key,
    category text not null check (category in ('discontinued', 'new_release', 'market_news')),
    title text not null,
    summary text not null,
    sentiment text not null check (sentiment in ('bullish', 'bearish', 'neutral')),
    impact_score integer default 0,
    ref_numbers text[] default '{}',
    brand text,
    event_date date,
    source_url text,
    created_at timestamptz default now()
  );
*/

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sentiment_reports")
    .select("*")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })

  if (error) {
    // Table may not exist yet — return empty array instead of 500
    if (error.code === "42P01") {
      return NextResponse.json([])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST() {
  const supabase = createAdminClient()

  const today = new Date().toISOString().split("T")[0]

  const mockData = [
    {
      category: "discontinued",
      title: "Rolex Submariner 116610LN — Discontinued 2020",
      summary:
        "Price has risen 45% since discontinuation in 2020. Strong secondary market demand with no new supply. Previous-generation Submariners commanding significant premiums over retail.",
      sentiment: "bullish",
      impact_score: 45,
      ref_numbers: ["116610LN"],
      brand: "Rolex",
      event_date: "2020-09-01",
      source_url: null,
    },
    {
      category: "new_release",
      title: "Patek Philippe Annual Calendar 5396 — Updated Reference Expected",
      summary:
        "Limited production expected to drive secondary premiums on both new and existing 5396 variants. Dealer allocations remain tight. Pre-owned market reacting positively to announcement speculation.",
      sentiment: "bullish",
      impact_score: 25,
      ref_numbers: ["5396R-014", "5396G-011"],
      brand: "Patek Philippe",
      event_date: today,
      source_url: null,
    },
    {
      category: "market_news",
      title: "Grey Market Premiums Compressing as AD Allocations Improve",
      summary:
        "Authorized dealer allocations improving across major brands. Grey market premiums on Rolex sport models down 12% year-over-year. Market normalizing toward retail pricing for popular references.",
      sentiment: "bearish",
      impact_score: -15,
      ref_numbers: [],
      brand: null,
      event_date: today,
      source_url: null,
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sentiment_reports")
    .insert(mockData)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
