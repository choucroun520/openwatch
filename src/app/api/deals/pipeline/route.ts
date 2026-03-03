/**
 * GET  /api/deals/pipeline?status=negotiating&ref=126610LN&brand=Rolex
 *      → list deals with optional filters
 *
 * POST /api/deals/pipeline
 *      → create a new deal
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { handleApiError, AppError } from "@/lib/utils/errors"

// ── Types ──────────────────────────────────────────────────────────────────

export interface DealPipeline {
  id: string
  ref_number: string
  brand: string | null
  model: string | null
  source: string
  listing_url: string | null
  asking_price_usd: string
  our_offer_usd: string | null
  status:
    | "spotted"
    | "outreach_sent"
    | "negotiating"
    | "offer_accepted"
    | "purchased"
    | "passed"
    | "expired"
  seller_score: number | null
  motivation_score: number | null
  outreach_message: string | null
  seller_response: string | null
  ai_analysis: string | null
  notes: string | null
  market_code: string | null
  currency_local: string | null
  price_local: string | null
  created_at: string
  updated_at: string
}

const VALID_STATUSES = [
  "spotted",
  "outreach_sent",
  "negotiating",
  "offer_accepted",
  "purchased",
  "passed",
  "expired",
] as const

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sb = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb as any

    const { searchParams } = req.nextUrl
    const status = searchParams.get("status")
    const ref = searchParams.get("ref")
    const brand = searchParams.get("brand")
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200)

    let query = db
      .from("deal_pipeline")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (status) {
      // Support comma-separated statuses: ?status=spotted,outreach_sent
      const statuses = status.split(",").map((s) => s.trim())
      if (statuses.length === 1) {
        query = query.eq("status", statuses[0])
      } else {
        query = query.in("status", statuses)
      }
    }

    if (ref) {
      query = query.ilike("ref_number", `%${ref}%`)
    }

    if (brand) {
      query = query.ilike("brand", `%${brand}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data: data ?? [], count: (data ?? []).length })
  } catch (error) {
    return handleApiError(error)
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      ref_number,
      brand,
      model,
      source,
      listing_url,
      asking_price_usd,
      our_offer_usd,
      status = "spotted",
      seller_score,
      motivation_score,
      outreach_message,
      notes,
      market_code,
      currency_local,
      price_local,
    } = body

    // Validate required fields
    if (!ref_number || typeof ref_number !== "string") {
      throw new AppError("ref_number is required", "VALIDATION_ERROR", 400)
    }
    if (!source || typeof source !== "string") {
      throw new AppError("source is required", "VALIDATION_ERROR", 400)
    }
    if (!asking_price_usd || isNaN(Number(asking_price_usd))) {
      throw new AppError("asking_price_usd must be a number", "VALIDATION_ERROR", 400)
    }
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(
        `status must be one of: ${VALID_STATUSES.join(", ")}`,
        "VALIDATION_ERROR",
        400
      )
    }

    const sb = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb as any

    const record: Record<string, unknown> = {
      ref_number: ref_number.trim(),
      source: source.trim(),
      asking_price_usd: parseFloat(asking_price_usd).toFixed(2),
      status,
    }

    if (brand !== undefined) record.brand = brand
    if (model !== undefined) record.model = model
    if (listing_url !== undefined) record.listing_url = listing_url
    if (our_offer_usd !== undefined && our_offer_usd !== null) {
      record.our_offer_usd = parseFloat(our_offer_usd).toFixed(2)
    }
    if (seller_score !== undefined) record.seller_score = Number(seller_score)
    if (motivation_score !== undefined) record.motivation_score = Number(motivation_score)
    if (outreach_message !== undefined) record.outreach_message = outreach_message
    if (notes !== undefined) record.notes = notes
    if (market_code !== undefined) record.market_code = market_code
    if (currency_local !== undefined) record.currency_local = currency_local
    if (price_local !== undefined && price_local !== null) {
      record.price_local = parseFloat(price_local).toFixed(2)
    }

    const { data, error } = await db
      .from("deal_pipeline")
      .insert(record)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
