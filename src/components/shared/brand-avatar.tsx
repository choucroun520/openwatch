interface BrandAvatarProps {
  brandName: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const BRAND_GRADIENTS: Record<string, string> = {
  rolex: "linear-gradient(135deg, #006039 0%, #00843D 100%)",
  "patek-philippe": "linear-gradient(135deg, #002856 0%, #003A7A 100%)",
  "audemars-piguet": "linear-gradient(135deg, #002366 0%, #003399 100%)",
  omega: "linear-gradient(135deg, #003087 0%, #004AAD 100%)",
  "richard-mille": "linear-gradient(135deg, #1a1a1a 0%, #333333 100%)",
  "vacheron-constantin": "linear-gradient(135deg, #8B0000 0%, #C00000 100%)",
  cartier: "linear-gradient(135deg, #8B0000 0%, #C00000 100%)",
  "a-lange-sohne": "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%)",
  iwc: "linear-gradient(135deg, #1a3a5c 0%, #2a5a8c 100%)",
  breitling: "linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%)",
}

const SIZES = {
  sm: { wh: 32, text: "text-xs" },
  md: { wh: 48, text: "text-base" },
  lg: { wh: 64, text: "text-xl" },
  xl: { wh: 80, text: "text-2xl" },
}

function getBrandGradient(name: string): string {
  const slug = name.toLowerCase().replace(/[\s&.]+/g, "-").replace(/[^a-z0-9-]/g, "")
  return BRAND_GRADIENTS[slug] || "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)"
}

export function BrandAvatar({ brandName, size = "md", className = "" }: BrandAvatarProps) {
  const { wh, text } = SIZES[size]
  const gradient = getBrandGradient(brandName)
  const initial = brandName.charAt(0).toUpperCase()

  return (
    <div
      className={`rounded-full flex items-center justify-center font-black text-white flex-shrink-0 ${text} ${className}`}
      style={{ width: wh, height: wh, background: gradient }}
    >
      {initial}
    </div>
  )
}

export function getBrandGradientBySlug(slug: string): string {
  return BRAND_GRADIENTS[slug] || "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)"
}
