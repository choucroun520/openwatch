import AppLayout from "@/components/layout/app-layout"

function Bone({ w, h, className = "" }: { w?: string; h?: string; className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ width: w, height: h ?? "1rem", background: "var(--ow-bg-hover)" }}
    />
  )
}

export default function AnalyticsLoading() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <Bone w="280px" h="36px" className="mb-2" />
            <Bone w="400px" h="14px" />
          </div>
          <Bone w="260px" h="24px" />
        </div>

        {/* Brand cards */}
        <div>
          <Bone w="120px" h="12px" className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl animate-pulse"
                style={{ height: 160, background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Bone w="80px" h="12px" />
                    <Bone w="40px" h="12px" />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j}>
                        <Bone w="100%" h="8px" className="mb-1" />
                        <Bone w="100%" h="14px" />
                      </div>
                    ))}
                  </div>
                  <Bone w="100%" h="8px" />
                  <Bone w="100%" h="6px" className="rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Pulse */}
        <div>
          <Bone w="120px" h="12px" className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4 space-y-2 animate-pulse"
                style={{ background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
              >
                <Bone w="120px" h="12px" />
                <Bone w="80px" h="24px" />
                <Bone w="140px" h="12px" />
              </div>
            ))}
          </div>
        </div>

        {/* Price Distribution Chart */}
        <div
          className="rounded-xl animate-pulse"
          style={{ background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--ow-border)" }}>
            <Bone w="220px" h="16px" className="mb-2" />
            <Bone w="180px" h="12px" />
          </div>
          <div className="p-5">
            <div className="h-64 flex items-end justify-around gap-2 pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-1 items-end" style={{ width: "18%" }}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div
                      key={j}
                      className="rounded-t"
                      style={{
                        width: "22%",
                        height: `${20 + Math.random() * 60}%`,
                        background: "var(--ow-border)",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Refs Table */}
        <div
          className="rounded-xl overflow-hidden animate-pulse"
          style={{ background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
        >
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--ow-border)" }}>
            <div>
              <Bone w="180px" h="16px" className="mb-2" />
              <Bone w="120px" h="12px" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Bone key={i} w="48px" h="28px" className="rounded-lg" />
              ))}
            </div>
          </div>
          {/* Table header */}
          <div
            className="px-4 py-2.5"
            style={{ background: "var(--ow-bg)", borderBottom: "1px solid var(--ow-border)" }}
          >
            <Bone w="100%" h="12px" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 border-t flex items-center gap-4"
              style={{ borderColor: "var(--ow-border)", background: i % 2 === 0 ? "var(--ow-bg-card)" : "#0d0d15" }}
            >
              <Bone w="80px" h="12px" />
              <Bone w="120px" h="12px" />
              <Bone w="60px" h="12px" className="ml-auto" />
              <Bone w="60px" h="12px" />
              <Bone w="60px" h="12px" />
              <Bone w="80px" h="12px" />
              <Bone w="40px" h="12px" />
              <Bone w="36px" h="20px" className="rounded-full" />
            </div>
          ))}
        </div>

        {/* Deals */}
        <div>
          <Bone w="160px" h="20px" className="mb-2" />
          <Bone w="280px" h="12px" className="mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden animate-pulse"
                style={{ background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
              >
                <div className="h-8" style={{ background: "var(--ow-bg-hover)" }} />
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="space-y-1">
                      <Bone w="100px" h="12px" />
                      <Bone w="140px" h="16px" />
                      <Bone w="80px" h="11px" />
                    </div>
                    <div className="text-right space-y-1">
                      <Bone w="80px" h="24px" />
                      <Bone w="60px" h="11px" />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Bone w="60px" h="20px" className="rounded-full" />
                    <Bone w="80px" h="12px" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supply chart */}
        <div
          className="rounded-xl animate-pulse"
          style={{ background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--ow-border)" }}>
            <Bone w="240px" h="16px" className="mb-2" />
            <Bone w="200px" h="12px" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bone w="100px" h="12px" />
                <div className="flex-1 h-5 rounded-r" style={{ background: "var(--ow-border)", width: `${15 + Math.random() * 60}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Data coverage */}
        <div
          className="rounded-xl p-5 animate-pulse"
          style={{ background: "var(--ow-bg-card)", border: "1px solid var(--ow-border)" }}
        >
          <Bone w="120px" h="12px" className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Bone w="100px" h="11px" />
                <Bone w="140px" h="14px" />
              </div>
            ))}
          </div>
          <Bone w="120px" h="32px" className="rounded-lg" />
        </div>

      </div>
    </AppLayout>
  )
}
