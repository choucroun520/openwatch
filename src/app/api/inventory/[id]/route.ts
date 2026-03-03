import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleApiError, AppError } from "@/lib/utils/errors"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new AppError("Unauthorized", "UNAUTHORIZED", 401)

    // Verify ownership — use typed client for reads (select is fine)
    const { data: existing, error: fetchErr } = await supabase
      .from("listings")
      .select("dealer_id, wholesale_price")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (fetchErr || !existing)
      throw new AppError("Listing not found", "NOT_FOUND", 404)

    // Supabase typed client returns columns as `never` due to Database generic
    // limitations — cast to access the fields we know exist.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = existing as any
    if (row.dealer_id !== user.id)
      throw new AppError("Forbidden", "FORBIDDEN", 403)

    const body = await request.json()
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    if (body.wholesale_price !== undefined) {
      updates.wholesale_price = parseFloat(body.wholesale_price).toFixed(2)

      // Record price change event — fire-and-forget
      db.rpc("record_market_event", {
        event_type: "price_changed",
        listing_id: id,
        brand_id: null,
        model_id: null,
        actor_id: user.id,
        price: parseFloat(body.wholesale_price),
        prev_price: parseFloat(row.wholesale_price),
        metadata: {},
      }).then(({ error: rpcErr }: { error: Error | null }) => {
        if (rpcErr) console.warn("[record_market_event]", rpcErr.message)
      })
    }

    if (body.notes !== undefined) updates.notes = body.notes
    if (body.accepts_inquiries !== undefined)
      updates.accepts_inquiries = body.accepts_inquiries

    const { data, error } = await db
      .from("listings")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new AppError("Unauthorized", "UNAUTHORIZED", 401)

    const { data: existing, error: fetchErr } = await supabase
      .from("listings")
      .select("dealer_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (fetchErr || !existing)
      throw new AppError("Not found", "NOT_FOUND", 404)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = existing as any
    if (row.dealer_id !== user.id)
      throw new AppError("Forbidden", "FORBIDDEN", 403)

    // Soft delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { error } = await db
      .from("listings")
      .update({
        deleted_at: new Date().toISOString(),
        status: "delisted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
