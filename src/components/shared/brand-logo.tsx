interface BrandLogoProps {
  brandName: string
  size?: "sm" | "md" | "lg"
}

const BRAND_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  rolex: { bg: "#006039", text: "#ffffff", label: "R" },
  "patek-philippe": { bg: "#002856", text: "#ffffff", label: "P" },
  "patek philippe": { bg: "#002856", text: "#ffffff", label: "P" },
  "audemars-piguet": { bg: "#003087", text: "#ffffff", label: "AP" },
  "audemars piguet": { bg: "#003087", text: "#ffffff", label: "AP" },
  "vacheron-constantin": { bg: "#8B0000", text: "#ffffff", label: "VC" },
  "vacheron constantin": { bg: "#8B0000", text: "#ffffff", label: "VC" },
  "richard-mille": { bg: "#222222", text: "#ffffff", label: "RM" },
  "richard mille": { bg: "#222222", text: "#ffffff", label: "RM" },
  omega: { bg: "#003087", text: "#ffffff", label: "Ω" },
  cartier: { bg: "#C41E3A", text: "#ffffff", label: "C" },
  iwc: { bg: "#1a1a2e", text: "#ffffff", label: "IWC" },
  breitling: { bg: "#00205B", text: "#ffffff", label: "B" },
  "a. lange & sohne": { bg: "#2c2c2c", text: "#ffffff", label: "AL" },
  "a lange sohne": { bg: "#2c2c2c", text: "#ffffff", label: "AL" },
}

const SIZES = {
  sm: { container: 20, font: 8 },
  md: { container: 32, font: 11 },
  lg: { container: 48, font: 16 },
}

export function BrandLogo({ brandName, size = "md" }: BrandLogoProps) {
  const key = brandName.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
  const config = BRAND_COLORS[key] ?? { bg: "#2563eb", text: "#ffffff", label: brandName[0]?.toUpperCase() ?? "W" }
  const dim = SIZES[size]

  return (
    <div
      style={{
        width: dim.container,
        height: dim.container,
        borderRadius: "50%",
        background: config.bg,
        border: "1px solid #333333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: dim.font,
        fontWeight: 800,
        color: config.text,
        letterSpacing: "-0.02em",
      }}
    >
      {config.label}
    </div>
  )
}
