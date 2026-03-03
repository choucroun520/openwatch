import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleApiError, AppError } from "@/lib/utils/errors"

const VALID_STATUSES = ["active", "pending", "sold", "delisted"] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

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

    const { data: existing, error: fetchErr } = await supabase
      .from("listings")
      .select("dealer_id, brand_id, model_id, wholesale_price")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (fetchErr || !existing)
      throw new AppError("Not found", "NOT_FOUND", 404)

    // Cast to access fields — Database generic returns never for typed select
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = existing as any
    if (row.dealer_id !== user.id)
      throw new AppError("Forbidden", "FORBIDDEN", 403)

    const body = await request.json()
    const { status } = body

    if (!VALID_STATUSES.includes(status as ValidStatus)) {
      throw new AppError("Invalid status", "VALIDATION_ERROR", 400)
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status,
      updated_at: now,
    }
    if (status === "sold") updates.sold_at = now

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("listings")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    // Record market event — fire-and-forget
    const eventType =
      status === "sold"
        ? "listing_sold"
        : status === "delisted"
          ? "listing_delisted"
          : "listing_updated"

    db.rpc("record_market_event", {
      event_type: eventType,
      listing_id: id,
      brand_id: row.brand_id,
      model_id: row.model_id,
      actor_id: user.id,
      price: parseFloat(row.wholesale_price),
      prev_price: null,
      metadata: { new_status: status },
    }).then(({ error: rpcErr }: { error: Error | null }) => {
      if (rpcErr) console.warn("[record_market_event]", rpcErr.message)
    })

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error)
  }
}
