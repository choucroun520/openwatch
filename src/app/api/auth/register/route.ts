import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { registerSchema } from "@/lib/validations/auth"
import { handleApiError, AppError, Errors } from "@/lib/utils/errors"

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    let validated: {
      invite_code: string
      email: string
      password: string
      full_name: string
      company_name: string
    }

    try {
      validated = registerSchema.parse(body)
    } catch (err) {
      if (err instanceof ZodError) {
        const firstError = err.issues[0]
        return NextResponse.json(
          { error: firstError?.message ?? "Validation failed", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }
      throw err
    }

    const { invite_code, email, password, full_name, company_name } = validated

    // Extract optional fields from the raw body (not in base registerSchema)
    const rawBody = body as Record<string, unknown>
    const location = typeof rawBody.location === "string" ? rawBody.location : null
    const specialties = Array.isArray(rawBody.specialties)
      ? (rawBody.specialties as string[]).filter((s) => typeof s === "string")
      : []

    // 2. Admin client (bypasses RLS)
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adb = adminClient as any

    // 3. Validate invite code
    const { data: inviteValid, error: inviteError } = await adb.rpc(
      "validate_invite_code",
      { p_code: invite_code }
    )

    if (inviteError) {
      console.error("[register] invite rpc error:", inviteError)
      throw new AppError("Failed to validate invite code", "INVITE_CHECK_FAILED", 500)
    }

    if (!inviteValid) {
      throw Errors.INVALID_INVITE
    }

    // 4. Create auth user (email confirmed immediately — invite-only network)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      // Surface friendly message for duplicate email
      if (authError?.message?.toLowerCase().includes("already")) {
        throw new AppError(
          "An account with this email already exists.",
          "EMAIL_TAKEN",
          409
        )
      }
      throw new AppError(
        authError?.message ?? "Failed to create account",
        "AUTH_CREATE_FAILED",
        500
      )
    }

    const userId = authData.user.id

    // 5. Insert profile
    const { error: profileError } = await adb.from("profiles").insert({
      id: userId,
      email,
      full_name,
      company_name,
      location: location ?? undefined,
      specialties: specialties.length > 0 ? specialties : undefined,
      role: "dealer",
    })

    if (profileError) {
      // Best-effort cleanup — delete the auth user if profile insert fails
      await adminClient.auth.admin.deleteUser(userId)
      throw new AppError(
        "Failed to create dealer profile",
        "PROFILE_CREATE_FAILED",
        500
      )
    }

    // 6. Mark invite code as used
    const { error: useCodeError } = await adb.rpc("use_invite_code", {
      p_code: invite_code,
      p_user_id: userId,
    })

    if (useCodeError) {
      // Non-fatal — log but don't fail the registration
      console.error("[register] use_invite_code rpc error:", useCodeError)
    }

    // 7. Return success
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
