"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Watch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BRAND_SPECIALTIES = [
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Omega",
  "Richard Mille",
  "Vacheron Constantin",
  "Cartier",
  "A. Lange & Söhne",
  "IWC",
  "Breitling",
] as const

interface FormState {
  invite_code: string
  full_name: string
  company_name: string
  email: string
  password: string
  location: string
  specialties: string[]
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    invite_code: "",
    full_name: "",
    company_name: "",
    email: "",
    password: "",
    location: "",
    specialties: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof Omit<FormState, "specialties">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleSpecialty(brand: string) {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(brand)
        ? prev.specialties.filter((s) => s !== brand)
        : [...prev.specialties, brand],
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.")
        return
      }

      router.push("/network")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg w-full bg-card rounded-2xl border border-border p-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <Watch size={32} className="text-blue-500" />
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          OpenWatch
        </h1>
        <p className="text-sm text-muted-foreground">Join the Dealer Network</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Invite Code */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite_code" className="text-sm text-muted-foreground">
            Invite Code <span className="text-danger">*</span>
          </Label>
          <Input
            id="invite_code"
            type="text"
            placeholder="OW-DEALER-001"
            value={form.invite_code}
            onChange={(e) => handleChange("invite_code", e.target.value.toUpperCase())}
            required
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground font-mono"
          />
        </div>

        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name" className="text-sm text-muted-foreground">
            Full Name <span className="text-danger">*</span>
          </Label>
          <Input
            id="full_name"
            type="text"
            placeholder="John Smith"
            value={form.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
            required
            autoComplete="name"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Company Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_name" className="text-sm text-muted-foreground">
            Company Name <span className="text-danger">*</span>
          </Label>
          <Input
            id="company_name"
            type="text"
            placeholder="Smith Fine Timepieces"
            value={form.company_name}
            onChange={(e) => handleChange("company_name", e.target.value)}
            required
            autoComplete="organization"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-sm text-muted-foreground">
            Email <span className="text-danger">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="dealer@example.com"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            required
            autoComplete="email"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-sm text-muted-foreground">
            Password <span className="text-danger">*</span>
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Min 8 chars, uppercase + number"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            required
            autoComplete="new-password"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location" className="text-sm text-muted-foreground">
            Location{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="location"
            type="text"
            placeholder="New York, NY"
            value={form.location}
            onChange={(e) => handleChange("location", e.target.value)}
            autoComplete="address-level2"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Brand Specialties */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">
            Brand Specialties{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <div
            className="bg-bg-elevated border border-border rounded-lg p-3 max-h-40 overflow-y-auto"
          >
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {BRAND_SPECIALTIES.map((brand) => {
                const checked = form.specialties.includes(brand)
                return (
                  <label
                    key={brand}
                    className="flex items-center gap-2 cursor-pointer min-w-[calc(50%-8px)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSpecialty(brand)}
                      className="w-4 h-4 rounded border-border bg-bg-elevated accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-foreground">{brand}</span>
                  </label>
                )
              })}
            </div>
          </div>
          {form.specialties.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {form.specialties.length} brand{form.specialties.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0 mt-2"
        >
          {loading ? "Creating account..." : "Join OpenWatch"}
        </Button>
      </form>

      {/* Footer link */}
      <p className="text-sm text-muted-foreground text-center mt-6">
        Already a member?{" "}
        <Link
          href="/login"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
