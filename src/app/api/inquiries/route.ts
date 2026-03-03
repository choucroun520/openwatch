import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleApiError, AppError } from "@/lib/utils/errors"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new AppError("Unauthorized", "UNAUTHORIZED", 401)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data, error } = await db
      .from("deal_inquiries")
      .select(
        "*, listing:listings(id, reference_number, wholesale_price, brand:brands(name,slug), model:models(name)), from_dealer:profiles!from_dealer_id(id, full_name, company_name), to_dealer:profiles!to_dealer_id(id, full_name, company_name)"
      )
      .or(`from_dealer_id.eq.${user.id},to_dealer_id.eq.${user.id}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const body = await request.json()
    const { listing_id, message, offer_price } = body

    if (!listing_id || !message) {
      throw new AppError(
        "listing_id and message are required",
        "VALIDATION_ERROR",
        400
      )
    }

    const { data: listing } = await db
      .from("listings")
      .select("dealer_id, brand_id, model_id, wholesale_price")
      .eq("id", listing_id)
      .single()

    if (!listing) throw new AppError("Listing not found", "NOT_FOUND", 404)
    if (listing.dealer_id === user.id) {
      throw new AppError(
        "Cannot inquire on your own listing",
        "FORBIDDEN",
        403
      )
    }

    const parsedOfferPrice =
      offer_price != null
        ? parseFloat(String(offer_price).replace(/[^0-9.]/g, "")).toFixed(2)
        : null

    const { data, error } = await db
      .from("deal_inquiries")
      .insert({
        listing_id,
        from_dealer_id: user.id,
        to_dealer_id: listing.dealer_id,
        message,
        offer_price: parsedOfferPrice,
        status: "open",
      })
      .select()
      .single()

    if (error) throw error

    // Record market event
    await db.rpc("record_market_event", {
      event_type: "inquiry_sent",
      listing_id,
      brand_id: listing.brand_id,
      model_id: listing.model_id,
      actor_id: user.id,
      price:
        parsedOfferPrice != null ? parseFloat(parsedOfferPrice) : null,
      prev_price: null,
      metadata: { message: message.slice(0, 100) },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
