/**
 * POST /api/deals/analyze-response
 *
 * Uses OpenAI GPT-4o to analyze a seller's response and generate negotiation intelligence:
 *   - Classifies seller intent (SERIOUS / FIRM_PRICE / BROKER / NOT_INTERESTED)
 *   - Extracts counter-offer price and timeline
 *   - Identifies red flags
 *   - Generates our next counter-offer message
 *   - Recommends action (PUSH_HARDER / ACCEPT / WALK_AWAY / REQUEST_VERIFICATION)
 *
 * Also updates the deal in deal_pipeline with ai_analysis and new status.
 *
 * Body: { deal_id: string, seller_response: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { handleApiError, AppError } from "@/lib/utils/errors"

// ── Types ──────────────────────────────────────────────────────────────────

type SellerClassification = "SERIOUS" | "FIRM_PRICE" | "BROKER" | "NOT_INTERESTED"
type Recommendation = "PUSH_HARDER" | "ACCEPT" | "WALK_AWAY" | "REQUEST_VERIFICATION"

interface AnalysisResult {
  classification: SellerClassification
  counter_offer_price: number | null
  red_flags: string[]
  recommendation: Recommendation
  our_next_message: string
  confidence: number
}

// ── Mock analysis (fallback when OpenAI key is missing/invalid) ────────────

function mockAnalysis(sellerResponse: string, askingPrice: number): AnalysisResult {
  const lower = sellerResponse.toLowerCase()

  // Simple heuristic classification
  let classification: SellerClassification = "SERIOUS"
  let recommendation: Recommendation = "PUSH_HARDER"
  const redFlags: string[] = []

  if (
    lower.includes("not interested") ||
    lower.includes("no thanks") ||
    lower.includes("already sold") ||
    lower.includes("withdrawn")
  ) {
    classification = "NOT_INTERESTED"
    recommendation = "WALK_AWAY"
  } else if (
    lower.includes("final price") ||
    lower.includes("firm") ||
    lower.includes("best price") ||
    lower.includes("not negotiable") ||
    lower.includes("lowest")
  ) {
    classification = "FIRM_PRICE"
    recommendation = "ACCEPT"
  } else if (
    lower.includes("available to order") ||
    lower.includes("can source") ||
    lower.includes("contact my supplier")
  ) {
    classification = "BROKER"
    recommendation = "WALK_AWAY"
    redFlags.push("Seller may not physically hold the watch")
  }

  // Try to extract counter-offer price
  const priceMatch = sellerResponse.match(/\$?\s*(\d[\d,]+(?:\.\d{2})?)/g)
  let counterOffer: number | null = null
  if (priceMatch) {
    const prices = priceMatch
      .map((p) => parseFloat(p.replace(/[,$\s]/g, "")))
      .filter((p) => p > 1000 && p < 5_000_000)
    if (prices.length > 0) {
      // Take the most relevant price (closest to asking)
      counterOffer = prices.reduce((prev, curr) =>
        Math.abs(curr - askingPrice) < Math.abs(prev - askingPrice) ? curr : prev
      )
    }
  }

  if (lower.includes("wire transfer") || lower.includes("western union") || lower.includes("bitcoin")) {
    redFlags.push("Unusual payment method requested")
  }
  if (lower.includes("shipping only") || lower.includes("no local pickup")) {
    redFlags.push("Shipping-only arrangement")
  }

  const ourNextMessage =
    classification === "SERIOUS"
      ? `Thank you for getting back to me. I appreciate your response. Could you confirm that the watch is with you currently and ready to ship? If so, I can move to $${Math.round((counterOffer ?? askingPrice) * 0.95).toLocaleString()} and process payment today.`
      : classification === "FIRM_PRICE"
      ? `I understand your position. If you're flexible at all, I'm prepared to close at $${Math.round((counterOffer ?? askingPrice) * 0.97).toLocaleString()} with a same-day wire transfer. Otherwise I completely respect that — let me know either way.`
      : "Thank you for your time. I'll pass on this one."

  return {
    classification,
    counter_offer_price: counterOffer,
    red_flags: redFlags,
    recommendation,
    our_next_message: ourNextMessage,
    confidence: 0.6,
  }
}

// ── OpenAI analysis ────────────────────────────────────────────────────────

async function analyzeWithOpenAI(
  sellerResponse: string,
  dealContext: {
    ref_number: string
    asking_price_usd: number
    our_offer_usd: number | null
    source: string
    outreach_message: string | null
  }
): Promise<AnalysisResult> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return mockAnalysis(sellerResponse, dealContext.asking_price_usd)
  }

  const systemPrompt = `You are an expert luxury watch negotiation analyst for a professional watch acquisition firm.
Your job is to analyze seller responses and determine the best negotiation strategy.
You must respond with ONLY valid JSON matching the exact schema provided.`

  const userPrompt = `Analyze this seller response for a luxury watch deal.

DEAL CONTEXT:
- Watch reference: ${dealContext.ref_number}
- Asking price: $${dealContext.asking_price_usd?.toLocaleString()} USD
- Our opening offer: ${dealContext.our_offer_usd ? `$${dealContext.our_offer_usd.toLocaleString()} USD` : "not yet made"}
- Source: ${dealContext.source}
- Our original outreach: ${dealContext.outreach_message ?? "N/A"}

SELLER RESPONSE:
"${sellerResponse}"

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "classification": "SERIOUS" | "FIRM_PRICE" | "BROKER" | "NOT_INTERESTED",
  "counter_offer_price": <number or null>,
  "red_flags": ["flag1", "flag2"],
  "recommendation": "PUSH_HARDER" | "ACCEPT" | "WALK_AWAY" | "REQUEST_VERIFICATION",
  "our_next_message": "<3-4 sentence counter-message to send>",
  "confidence": <0.0 to 1.0>
}

Classification guide:
- SERIOUS: Seller engages genuinely, open to negotiation, physically has the watch
- FIRM_PRICE: Seller is real but won't budge much on price
- BROKER: Seller doesn't actually have the watch, is sourcing from elsewhere
- NOT_INTERESTED: Seller has rejected or is unresponsive/unavailable

Recommendation guide:
- PUSH_HARDER: Good deal potential, keep negotiating
- ACCEPT: Price is fair, close the deal now
- WALK_AWAY: Not worth pursuing (broker, not interested, or bad terms)
- REQUEST_VERIFICATION: Need proof of ownership before proceeding`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error("[analyze-response] OpenAI error:", response.status, errBody)
      return mockAnalysis(sellerResponse, dealContext.asking_price_usd)
    }

    const raw = await response.json()
    const content = raw.choices?.[0]?.message?.content?.trim()
    if (!content) return mockAnalysis(sellerResponse, dealContext.asking_price_usd)

    // Strip markdown fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const parsed = JSON.parse(cleaned) as AnalysisResult

    // Validate required fields
    if (!parsed.classification || !parsed.recommendation || !parsed.our_next_message) {
      return mockAnalysis(sellerResponse, dealContext.asking_price_usd)
    }

    return {
      classification: parsed.classification,
      counter_offer_price: parsed.counter_offer_price ?? null,
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      recommendation: parsed.recommendation,
      our_next_message: parsed.our_next_message,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8,
    }
  } catch (e) {
    console.error("[analyze-response] Parse error:", e)
    return mockAnalysis(sellerResponse, dealContext.asking_price_usd)
  }
}

// ── Status inference from classification ──────────────────────────────────

function inferNextStatus(
  classification: SellerClassification,
  recommendation: Recommendation,
  currentStatus: string
): string | null {
  if (recommendation === "WALK_AWAY" || classification === "NOT_INTERESTED") {
    return "passed"
  }
  if (classification === "SERIOUS" && recommendation === "ACCEPT") {
    return "offer_accepted"
  }
  if (classification === "SERIOUS" || classification === "FIRM_PRICE") {
    if (currentStatus === "outreach_sent") return "negotiating"
  }
  return null
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deal_id, seller_response } = body

    if (!deal_id || typeof deal_id !== "string") {
      throw new AppError("deal_id is required", "VALIDATION_ERROR", 400)
    }
    if (!seller_response || typeof seller_response !== "string") {
      throw new AppError("seller_response is required", "VALIDATION_ERROR", 400)
    }
    if (seller_response.trim().length < 5) {
      throw new AppError("seller_response is too short", "VALIDATION_ERROR", 400)
    }

    const sb = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb as any

    // Fetch deal context
    const { data: deal, error: dealErr } = await db
      .from("deal_pipeline")
      .select(
        "id, ref_number, asking_price_usd, our_offer_usd, source, status, outreach_message"
      )
      .eq("id", deal_id)
      .single()

    if (dealErr || !deal) {
      throw new AppError("Deal not found", "NOT_FOUND", 404)
    }

    // Run AI analysis
    const analysis = await analyzeWithOpenAI(seller_response, {
      ref_number: deal.ref_number,
      asking_price_usd: parseFloat(deal.asking_price_usd),
      our_offer_usd: deal.our_offer_usd ? parseFloat(deal.our_offer_usd) : null,
      source: deal.source,
      outreach_message: deal.outreach_message,
    })

    // Infer status update
    const newStatus = inferNextStatus(analysis.classification, analysis.recommendation, deal.status)

    // Update deal in DB
    const updatePayload: Record<string, unknown> = {
      seller_response: seller_response.trim(),
      ai_analysis: JSON.stringify(analysis),
    }
    if (newStatus && newStatus !== deal.status) {
      updatePayload.status = newStatus
    }

    const { data: updated, error: updateErr } = await db
      .from("deal_pipeline")
      .update(updatePayload)
      .eq("id", deal_id)
      .select()
      .single()

    if (updateErr) throw updateErr

    return NextResponse.json({
      analysis,
      deal: updated,
      status_changed: newStatus !== null && newStatus !== deal.status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
