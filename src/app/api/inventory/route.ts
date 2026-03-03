import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleApiError, AppError } from "@/lib/utils/errors"
import type { Listing } from "@/lib/types"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new AppError("Unauthorized", "UNAUTHORIZED", 401)

    const { data, error } = await supabase
      .from("listings")
      .select("*, brand:brands(id,name,slug,icon), model:models(id,name,category)")
      .eq("dealer_id", user.id)
      .is("deleted_at", null)
      .order("listed_at", { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new AppError("Unauthorized", "UNAUTHORIZED", 401)

    const body = await request.json()

    const {
      brand_id,
      model_id,
      reference_number,
      year,
      material,
      dial_color,
      condition,
      wholesale_price,
    } = body

    if (
      !brand_id ||
      !model_id ||
      !reference_number ||
      !year ||
      !material ||
      !dial_color ||
      !condition ||
      !wholesale_price
    ) {
      throw new AppError("Missing required fields", "VALIDATION_ERROR", 400)
    }

    // Use untyped db alias for insert — the Database generic's Insert type uses
    // Partial<T> patterns that Supabase client cannot infer at this time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: newListing, error } = (await db
      .from("listings")
      .insert({
        dealer_id: user.id,
        brand_id,
        model_id,
        reference_number,
        year: parseInt(year),
        material,
        dial_color,
        case_size: body.case_size || null,
        movement: body.movement || null,
        complications: body.complications?.length ? body.complications : null,
        condition,
        condition_score: body.condition_score
          ? body.condition_score.toString()
          : null,
        has_box: body.has_box ?? false,
        has_papers: body.has_papers ?? false,
        has_warranty: body.has_warranty ?? false,
        warranty_date: body.warranty_date || null,
        service_history: body.service_history || null,
        wholesale_price: parseFloat(wholesale_price).toFixed(2),
        retail_price: body.retail_price
          ? parseFloat(body.retail_price).toFixed(2)
          : null,
        currency: body.currency || "USD",
        accepts_inquiries: body.accepts_inquiries ?? true,
        notes: body.notes || null,
        status: "active",
      })
      .select()
      .single()) as { data: Listing | null; error: Error | null }

    if (error) throw error

    // Record market event — fire-and-forget, don't fail the request on RPC error
    if (newListing) {
      db.rpc("record_market_event", {
        event_type: "listing_created",
        listing_id: newListing.id,
        brand_id: newListing.brand_id,
        model_id: newListing.model_id,
        actor_id: user.id,
        price: parseFloat(newListing.wholesale_price),
        prev_price: null,
        metadata: {},
      }).then(({ error: rpcErr }: { error: Error | null }) => {
        if (rpcErr) console.warn("[record_market_event]", rpcErr.message)
      })
    }

    return NextResponse.json({ data: newListing }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
