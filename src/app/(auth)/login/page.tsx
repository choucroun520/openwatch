"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Watch } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push("/network")
      router.refresh()
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm w-full bg-card rounded-2xl border border-border p-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <Watch size={32} className="text-blue-500" />
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          OpenWatch
        </h1>
        <p className="text-sm text-muted-foreground">Dealer Network — Members Only</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-sm text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="dealer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-sm text-muted-foreground">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0 mt-2"
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      {/* Footer link */}
      <p className="text-sm text-muted-foreground text-center mt-6">
        Need access?{" "}
        <Link
          href="/register"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Request an invitation
        </Link>
      </p>
    </div>
  )
}
