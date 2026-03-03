"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0b0b14] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
          <span className="text-red-400 text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="text-slate-400 text-sm">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-600 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <Button
          onClick={reset}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold"
        >
          Try Again
        </Button>
      </div>
    </div>
  )
}
