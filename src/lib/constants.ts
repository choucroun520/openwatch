export const MATERIALS = [
  "Stainless Steel",
  "18k Yellow Gold",
  "18k Rose Gold",
  "18k White Gold",
  "Platinum",
  "Titanium",
  "Ceramic",
  "Carbon TPT",
  "Bronze",
] as const;

export const DIAL_COLORS = [
  "Black",
  "Blue",
  "White",
  "Silver",
  "Green",
  "Champagne",
  "Grey",
  "Slate",
  "Salmon",
  "Tiffany Blue",
  "Mother of Pearl",
  "Brown",
  "Red",
  "Yellow",
] as const;

export const CONDITIONS = [
  "Unworn",
  "Mint",
  "Excellent",
  "Very Good",
  "Good",
  "Fair",
] as const;

export const CATEGORIES = [
  "Dive",
  "Chronograph",
  "Dress",
  "Sport",
  "Luxury Sport",
  "Complication",
  "Heritage",
  "Ladies",
  "Contemporary",
  "Pilot",
  "Travel",
  "Classic",
  "Ultra-Light",
  "Extra Flat",
  "Flyback Chronograph",
  "Haute Horlogerie",
  "Signature",
  "Dress Sport",
] as const;

export const MOVEMENTS = [
  "Automatic",
  "Manual Wind",
  "Quartz",
] as const;

export const COMPLICATIONS = [
  "Date",
  "Chronograph",
  "GMT",
  "Moon Phase",
  "Perpetual Calendar",
  "Tourbillon",
  "Minute Repeater",
  "Annual Calendar",
  "Flyback",
  "Power Reserve",
  "World Time",
] as const;

export const CASE_SIZES = [
  "28mm",
  "31mm",
  "34mm",
  "36mm",
  "38mm",
  "39mm",
  "40mm",
  "41mm",
  "42mm",
  "44mm",
  "46mm",
  "50mm",
] as const;

export const LISTING_STATUSES = [
  "active",
  "pending",
  "sold",
  "delisted",
] as const;

export const DEALER_ROLES = [
  "dealer",
  "admin",
  "super_admin",
] as const;

export const PLATFORM_FEE_PCT = 2.5;

/** Brand slugs we seed in migrations */
export const BRAND_SLUGS = [
  "rolex",
  "patek-philippe",
  "audemars-piguet",
  "omega",
  "richard-mille",
  "vacheron-constantin",
  "cartier",
  "a-lange-sohne",
  "iwc",
  "breitling",
] as const;
