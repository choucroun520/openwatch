/**
 * PATCH  /api/deals/pipeline/{id}
 *        → update deal status, add seller_response, notes, offer price, etc.
 *
 * DELETE /api/deals/pipeline/{id}
 *        → mark deal as "passed" (soft delete)
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { handleApiError, AppError } from "@/lib/utils/errors"

const VALID_STATUSES = [
  "spotted",
  "outreach_sent",
  "negotiating",
  "offer_accepted",
  "purchased",
  "passed",
  "expired",
] as const

// ── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) throw new AppError("Missing deal ID", "VALIDATION_ERROR", 400)

    const body = await req.json()

    const sb = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb as any

    // Verify deal exists
    const { data: existing, error: fetchErr } = await db
      .from("deal_pipeline")
      .select("id, status")
      .eq("id", id)
      .single()

    if (fetchErr || !existing) {
      throw new AppError("Deal not found", "NOT_FOUND", 404)
    }

    // Build update payload — only accept known fields
    const updates: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        throw new AppError(
          `status must be one of: ${VALID_STATUSES.join(", ")}`,
          "VALIDATION_ERROR",
          400
        )
      }
      updates.status = body.status
    }

    if (body.seller_response !== undefined) {
      updates.seller_response = body.seller_response
    }

    if (body.ai_analysis !== undefined) {
      updates.ai_analysis =
        typeof body.ai_analysis === "object"
          ? JSON.stringify(body.ai_analysis)
          : body.ai_analysis
    }

    if (body.our_offer_usd !== undefined && body.our_offer_usd !== null) {
      const val = parseFloat(body.our_offer_usd)
      if (isNaN(val)) throw new AppError("our_offer_usd must be a number", "VALIDATION_ERROR", 400)
      updates.our_offer_usd = val.toFixed(2)
    }

    if (body.outreach_message !== undefined) {
      updates.outreach_message = body.outreach_message
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes
    }

    if (body.seller_score !== undefined) {
      updates.seller_score = Math.max(0, Math.min(100, Number(body.seller_score)))
    }

    if (body.motivation_score !== undefined) {
      updates.motivation_score = Math.max(0, Math.min(100, Number(body.motivation_score)))
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError("No valid fields to update", "VALIDATION_ERROR", 400)
    }

    const { data, error } = await db
      .from("deal_pipeline")
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

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) throw new AppError("Missing deal ID", "VALIDATION_ERROR", 400)

    const sb = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb as any

    // Soft delete: mark as "passed"
    const { data, error } = await db
      .from("deal_pipeline")
      .update({ status: "passed" })
      .eq("id", id)
      .select("id, status")
      .single()

    if (error) throw error
    if (!data) throw new AppError("Deal not found", "NOT_FOUND", 404)

    return NextResponse.json({ data, message: "Deal marked as passed" })
  } catch (error) {
    return handleApiError(error)
  }
}
