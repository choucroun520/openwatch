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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: inquiry } = await db
      .from("deal_inquiries")
      .select("from_dealer_id, to_dealer_id, listing_id")
      .eq("id", id)
      .single()

    if (!inquiry) throw new AppError("Inquiry not found", "NOT_FOUND", 404)

    if (
      inquiry.from_dealer_id !== user.id &&
      inquiry.to_dealer_id !== user.id
    ) {
      throw new AppError("Forbidden", "FORBIDDEN", 403)
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status) {
      updates.status = body.status
    }

    if (body.reply_message) {
      updates.status = "responded"
      // reply_message is intentionally not stored as a separate column —
      // status is updated to "responded" to reflect the action.
    }

    const { data, error } = await db
      .from("deal_inquiries")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (body.reply_message && inquiry.listing_id) {
      await db.rpc("record_market_event", {
        event_type: "inquiry_responded",
        listing_id: inquiry.listing_id,
        brand_id: null,
        model_id: null,
        actor_id: user.id,
        price: null,
        prev_price: null,
        metadata: { reply: body.reply_message.slice(0, 100) },
      })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error)
  }
}
