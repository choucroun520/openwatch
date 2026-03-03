/**
 * Analytics engine utilities — compute market intelligence from raw listing data.
 */

export function computeFloor(prices: number[]): number {
  if (!prices.length) return 0;
  return Math.min(...prices);
}

export function computeAvg(prices: number[]): number {
  if (!prices.length) return 0;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

export function computeCeiling(prices: number[]): number {
  if (!prices.length) return 0;
  return Math.max(...prices);
}

/**
 * Supply ratio = active listings / annual production.
 * > 0.03 (3%) = HIGH risk of oversaturation.
 * 0.01–0.03 = MEDIUM.
 * < 0.01 = LOW / scarce.
 */
export function computeSupplyRatio(
  activeListings: number,
  annualProduction: number
): number {
  if (!annualProduction) return 0;
  return activeListings / annualProduction;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function riskLevel(supplyRatio: number): RiskLevel {
  if (supplyRatio > 0.004) return "HIGH";
  if (supplyRatio > 0.002) return "MEDIUM";
  return "LOW";
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "HIGH":
      return "#ef4444";
    case "MEDIUM":
      return "#eab308";
    case "LOW":
      return "#22c55e";
  }
}

/**
 * Price momentum score — positive means rising, negative means falling.
 * Based on percentage change over the time window.
 */
export function computeMomentum(
  currentPrice: number,
  previousPrice: number
): number {
  if (!previousPrice) return 0;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
}

/**
 * Floor-to-ceiling spread as ROI upside indicator.
 * Higher spread = more price discovery room = higher ROI potential.
 */
export function computeSpread(floor: number, ceiling: number): number {
  if (!floor) return 0;
  return ((ceiling - floor) / floor) * 100;
}

/**
 * Determine rarity label based on price vs model average.
 */
export type RarityLabel = "Legendary" | "Rare" | "Below Market" | "Common";

export function rarityLabel(
  price: number,
  modelAvg: number
): RarityLabel {
  if (price > modelAvg * 1.6) return "Legendary";
  if (price > modelAvg * 1.2) return "Rare";
  if (price < modelAvg) return "Below Market";
  return "Common";
}

export function rarityColor(label: RarityLabel): string {
  switch (label) {
    case "Legendary":
      return "#eab308";
    case "Rare":
      return "#8b5cf6";
    case "Below Market":
      return "#22c55e";
    case "Common":
      return "#64748b";
  }
}
