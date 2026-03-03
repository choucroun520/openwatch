import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/*
 ╔═══════════════════════════════════════════════════════════════════╗
 ║  WATCHMARKET — opensea.io for Luxury Watches                    ║
 ║                                                                  ║
 ║  OpenSea Model → Watch Market Translation:                       ║
 ║  ─────────────────────────────────────────                       ║
 ║  NFT Collection  →  Watch Brand (Rolex, Patek, AP, etc.)        ║
 ║  NFT Item        →  Individual Watch Listed for Sale             ║
 ║  Floor Price     →  Lowest ask for that brand/model              ║
 ║  Traits          →  Material, Dial, Size, Complication, Year     ║
 ║  Owner           →  Current Seller / Dealer                      ║
 ║  Volume          →  Total $ traded in timeframe                  ║
 ║  Mint/Drop       →  New Release from Manufacture                 ║
 ║  Rarity          →  Production scarcity + condition              ║
 ║                                                                  ║
 ║  Every listing recorded → feeds real-time analytics engine       ║
 ╚═══════════════════════════════════════════════════════════════════╝
*/

// ═══════════════════════════════════════════════════════════════════
// DATA LAYER — Complete Watch Market Database
// ═══════════════════════════════════════════════════════════════════

const BRANDS = [
  {
    slug: "rolex", name: "Rolex", verified: true, icon: "👑",
    banner: "linear-gradient(135deg, #0a3d1a 0%, #1a5c2e 40%, #0d4720 100%)",
    description: "Crown jewel of Swiss horology. Founded 1905 in London, now headquartered in Geneva. The world's most recognized luxury watch brand with ~29% market share.",
    founded: 1905, hq: "Geneva, Switzerland",
    annualProd: 1240000, marketShare: 29.2,
    website: "rolex.com", 
    stats: { totalVolume: 892000000, floor: 5800, listed: 14200, owners: 890000 },
    models: [
      { name: "Submariner", slug: "submariner", refs: ["124060","126610LN","126610LV","126613LB","126618LB","126619LB"], floor: 8500, avg: 14200, ceiling: 48000, yearlyProd: 95000, category: "Dive", year: 1953 },
      { name: "Daytona", slug: "daytona", refs: ["126500LN","126509","126506","126518LN","116500LN"], floor: 22000, avg: 38500, ceiling: 250000, yearlyProd: 45000, category: "Chronograph", year: 1963 },
      { name: "GMT-Master II", slug: "gmt-master-ii", refs: ["126710BLRO","126710BLNR","126720VTNR","126711CHNR"], floor: 14500, avg: 19800, ceiling: 55000, yearlyProd: 80000, category: "Travel", year: 1955 },
      { name: "Datejust", slug: "datejust", refs: ["126334","126300","126234","126200","126233","126331"], floor: 6800, avg: 11200, ceiling: 38000, yearlyProd: 250000, category: "Dress", year: 1945 },
      { name: "Day-Date", slug: "day-date", refs: ["228235","228238","228206","228349RBR"], floor: 28000, avg: 42000, ceiling: 120000, yearlyProd: 35000, category: "Dress", year: 1956 },
      { name: "Explorer", slug: "explorer", refs: ["224270","226570"], floor: 7200, avg: 9800, ceiling: 18000, yearlyProd: 60000, category: "Sport", year: 1953 },
      { name: "Sky-Dweller", slug: "sky-dweller", refs: ["336934","336935","326238"], floor: 17500, avg: 28000, ceiling: 65000, yearlyProd: 30000, category: "Complication", year: 2012 },
      { name: "Yacht-Master", slug: "yacht-master", refs: ["226659","126622","126621"], floor: 11500, avg: 18000, ceiling: 42000, yearlyProd: 40000, category: "Sport", year: 1992 },
    ]
  },
  {
    slug: "patek-philippe", name: "Patek Philippe", verified: true, icon: "⚜️",
    banner: "linear-gradient(135deg, #1a1040 0%, #2d1b69 40%, #1a1040 100%)",
    description: "You never actually own a Patek Philippe. You merely look after it for the next generation. The pinnacle of haute horlogerie since 1839.",
    founded: 1839, hq: "Geneva, Switzerland",
    annualProd: 72000, marketShare: 5.1,
    website: "patek.com",
    stats: { totalVolume: 1450000000, floor: 22000, listed: 3200, owners: 95000 },
    models: [
      { name: "Nautilus", slug: "nautilus", refs: ["5711/1A","5712/1A","5726/1A","5990/1A","6711/1A"], floor: 78000, avg: 125000, ceiling: 800000, yearlyProd: 8000, category: "Sport Luxury", year: 1976 },
      { name: "Aquanaut", slug: "aquanaut", refs: ["5167A","5168G","5968A","5269R"], floor: 42000, avg: 68000, ceiling: 350000, yearlyProd: 12000, category: "Sport Luxury", year: 1997 },
      { name: "Calatrava", slug: "calatrava", refs: ["5227G","5227R","6119G","5297G"], floor: 22000, avg: 38000, ceiling: 150000, yearlyProd: 15000, category: "Dress", year: 1932 },
      { name: "Grand Complications", slug: "grand-complications", refs: ["5270P","6300G","5204R","5370P"], floor: 180000, avg: 450000, ceiling: 5000000, yearlyProd: 2000, category: "Haute Horlogerie", year: 1925 },
      { name: "Twenty~4", slug: "twenty-4", refs: ["4910/1200A","7300/1200A"], floor: 12000, avg: 18000, ceiling: 45000, yearlyProd: 7000, category: "Ladies", year: 1999 },
    ]
  },
  {
    slug: "audemars-piguet", name: "Audemars Piguet", verified: true, icon: "🛡️",
    banner: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    description: "To break the rules, you must first master them. Masters of the Royal Oak since 1875. Le Brassus, Vallée de Joux.",
    founded: 1875, hq: "Le Brassus, Switzerland",
    annualProd: 50000, marketShare: 7.0,
    website: "audemarspiguet.com",
    stats: { totalVolume: 780000000, floor: 18000, listed: 4100, owners: 72000 },
    models: [
      { name: "Royal Oak", slug: "royal-oak", refs: ["15500ST","15510ST","26240ST","15202ST","26331ST","77451ST"], floor: 28000, avg: 52000, ceiling: 450000, yearlyProd: 25000, category: "Luxury Sport", year: 1972 },
      { name: "Royal Oak Offshore", slug: "royal-oak-offshore", refs: ["26405CE","26470ST","26238CE","26420SO"], floor: 22000, avg: 38000, ceiling: 200000, yearlyProd: 15000, category: "Sport", year: 1993 },
      { name: "CODE 11.59", slug: "code-1159", refs: ["15210CR","26393CR","26396OR"], floor: 18000, avg: 32000, ceiling: 150000, yearlyProd: 8000, category: "Contemporary", year: 2019 },
    ]
  },
  {
    slug: "omega", name: "Omega", verified: true, icon: "Ω",
    banner: "linear-gradient(135deg, #0c1220 0%, #1a2744 40%, #0c1220 100%)",
    description: "First watch on the Moon. Official Olympic timekeeper since 1932. Master Chronometer certified precision.",
    founded: 1848, hq: "Biel/Bienne, Switzerland",
    annualProd: 570000, marketShare: 7.7,
    website: "omegawatches.com",
    stats: { totalVolume: 320000000, floor: 3200, listed: 18900, owners: 1200000 },
    models: [
      { name: "Speedmaster Professional", slug: "speedmaster", refs: ["310.30.42.50.01.001","310.30.42.50.01.002","311.30.42.30.01.005","310.32.42.50.01.002"], floor: 4800, avg: 7200, ceiling: 45000, yearlyProd: 120000, category: "Chronograph", year: 1957 },
      { name: "Seamaster 300M", slug: "seamaster-300m", refs: ["210.30.42.20.01.001","210.30.42.20.03.001","210.32.42.20.01.001"], floor: 3800, avg: 5500, ceiling: 28000, yearlyProd: 180000, category: "Dive", year: 1993 },
      { name: "Seamaster Planet Ocean", slug: "planet-ocean", refs: ["215.30.44.21.01.001","215.30.44.21.03.001"], floor: 4200, avg: 6800, ceiling: 22000, yearlyProd: 60000, category: "Dive", year: 2005 },
      { name: "Aqua Terra", slug: "aqua-terra", refs: ["220.10.41.21.01.001","220.10.41.21.03.001"], floor: 3200, avg: 5200, ceiling: 18000, yearlyProd: 90000, category: "Dress Sport", year: 2002 },
    ]
  },
  {
    slug: "richard-mille", name: "Richard Mille", verified: true, icon: "💎",
    banner: "linear-gradient(135deg, #2d1b00 0%, #5c3a0e 40%, #2d1b00 100%)",
    description: "A racing machine on the wrist. The most disruptive force in modern horology. Each piece is an engineering marvel.",
    founded: 2001, hq: "Les Breuleux, Switzerland",
    annualProd: 5500, marketShare: 2.7,
    website: "richardmille.com",
    stats: { totalVolume: 890000000, floor: 95000, listed: 620, owners: 8500 },
    models: [
      { name: "RM 011", slug: "rm-011", refs: ["RM011-FM","RM011-03","RM011-Ti"], floor: 180000, avg: 280000, ceiling: 800000, yearlyProd: 800, category: "Flyback Chronograph", year: 2007 },
      { name: "RM 035", slug: "rm-035", refs: ["RM035-02","RM035-01"], floor: 150000, avg: 220000, ceiling: 500000, yearlyProd: 600, category: "Ultra-Light", year: 2011 },
      { name: "RM 067", slug: "rm-067", refs: ["RM067-01"], floor: 95000, avg: 140000, ceiling: 280000, yearlyProd: 500, category: "Extra Flat", year: 2016 },
    ]
  },
  {
    slug: "vacheron-constantin", name: "Vacheron Constantin", verified: true, icon: "✧",
    banner: "linear-gradient(135deg, #1a0a1e 0%, #3a1a4e 40%, #1a0a1e 100%)",
    description: "The oldest continuously operating watch manufacturer. 269 years of unbroken tradition since 1755.",
    founded: 1755, hq: "Geneva, Switzerland",
    annualProd: 25000, marketShare: 2.2,
    website: "vacheron-constantin.com",
    stats: { totalVolume: 210000000, floor: 14000, listed: 1800, owners: 35000 },
    models: [
      { name: "Overseas", slug: "overseas", refs: ["4500V","5500V","7900V"], floor: 18000, avg: 32000, ceiling: 120000, yearlyProd: 6000, category: "Travel", year: 1996 },
      { name: "Patrimony", slug: "patrimony", refs: ["85180","81180","85290"], floor: 16000, avg: 28000, ceiling: 95000, yearlyProd: 5000, category: "Dress", year: 2004 },
      { name: "Historiques", slug: "historiques", refs: ["86122","82035"], floor: 24000, avg: 45000, ceiling: 180000, yearlyProd: 2000, category: "Heritage", year: 2009 },
    ]
  },
  {
    slug: "cartier", name: "Cartier", verified: true, icon: "🔴",
    banner: "linear-gradient(135deg, #3d0c0c 0%, #6e1a1a 40%, #3d0c0c 100%)",
    description: "The jeweler of kings, the king of jewelers. Where horology meets haute joaillerie since 1847.",
    founded: 1847, hq: "Paris, France",
    annualProd: 450000, marketShare: 7.0,
    website: "cartier.com",
    stats: { totalVolume: 280000000, floor: 3200, listed: 9800, owners: 420000 },
    models: [
      { name: "Santos", slug: "santos", refs: ["WSSA0018","WSSA0029","WSSA0048"], floor: 5200, avg: 8500, ceiling: 35000, yearlyProd: 80000, category: "Pilot", year: 1904 },
      { name: "Tank", slug: "tank", refs: ["WSTA0065","WSTA0053","W5200027"], floor: 3200, avg: 6800, ceiling: 45000, yearlyProd: 120000, category: "Dress", year: 1917 },
      { name: "Ballon Bleu", slug: "ballon-bleu", refs: ["WSBB0046","W69016Z4"], floor: 4100, avg: 7200, ceiling: 28000, yearlyProd: 60000, category: "Classic", year: 2007 },
    ]
  },
  {
    slug: "a-lange-sohne", name: "A. Lange & Söhne", verified: true, icon: "🦅",
    banner: "linear-gradient(135deg, #1a1a1a 0%, #333333 40%, #1a1a1a 100%)",
    description: "The pinnacle of German watchmaking. Glashütte's finest. Every movement hand-assembled and hand-engraved.",
    founded: 1845, hq: "Glashütte, Germany",
    annualProd: 5500, marketShare: 1.2,
    website: "alange-soehne.com",
    stats: { totalVolume: 145000000, floor: 22000, listed: 780, owners: 12000 },
    models: [
      { name: "Lange 1", slug: "lange-1", refs: ["191.032","101.032"], floor: 28000, avg: 42000, ceiling: 180000, yearlyProd: 1500, category: "Signature", year: 1994 },
      { name: "Saxonia", slug: "saxonia", refs: ["205.086","380.044"], floor: 22000, avg: 35000, ceiling: 120000, yearlyProd: 2000, category: "Dress", year: 1994 },
    ]
  },
];

// Traits (OpenSea-style) for filtering
const MATERIALS = ["Stainless Steel", "18k Yellow Gold", "18k Rose Gold", "18k White Gold", "Platinum", "Titanium", "Ceramic", "Carbon TPT", "Bronze"];
const DIALS = ["Black", "Blue", "White", "Silver", "Green", "Champagne", "Grey", "Slate", "Salmon", "Tiffany Blue", "Mother of Pearl"];
const CONDITIONS = ["Unworn / Sealed", "Mint (9.5/10)", "Excellent (9/10)", "Very Good (8/10)", "Good (7/10)"];
const SIZES = ["28mm", "31mm", "34mm", "36mm", "39mm", "40mm", "41mm", "42mm", "44mm", "46mm", "50mm"];

// Generate individual listings for a model
function genListings(brand, model, count = 40) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const ref = model.refs[Math.floor(Math.random() * model.refs.length)];
    const material = MATERIALS[Math.floor(Math.random() * (brand.slug === "richard-mille" ? 9 : 7))];
    const dial = DIALS[Math.floor(Math.random() * DIALS.length)];
    const cond = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
    const yr = 2016 + Math.floor(Math.random() * 10);
    const mult = 0.65 + Math.random() * 2;
    const price = Math.round(model.avg * mult);
    const listedAgo = Math.floor(Math.random() * 60) + 1;
    const box = Math.random() > 0.15;
    const papers = Math.random() > 0.2;
    const isBelow = price < model.avg;
    
    items.push({
      id: `${brand.slug}-${model.slug}-${i}`,
      brandSlug: brand.slug, brandName: brand.name, brandIcon: brand.icon,
      modelName: model.name, modelSlug: model.slug,
      ref, material, dial, condition: cond, year: yr,
      price, box, papers,
      size: SIZES[3 + Math.floor(Math.random() * 6)],
      seller: `${["CrownWatch","TimeVault","Prestige","Hodinkee","WatchBox","TrueFacet","Chronext","Tourneau","BobsWatches","AuthenticWatches"][Math.floor(Math.random() * 10)]}_${Math.floor(Math.random() * 999)}`,
      sellerRating: +(4 + Math.random()).toFixed(1),
      sellerSales: Math.floor(Math.random() * 500) + 10,
      listedDaysAgo: listedAgo,
      views: Math.floor(Math.random() * 2000) + 50,
      offers: Math.floor(Math.random() * 8),
      rarity: price > model.avg * 1.6 ? "Legendary" : price > model.avg * 1.2 ? "Rare" : isBelow ? "Below Market" : "Common",
      category: model.category,
    });
  }
  return items.sort((a, b) => a.price - b.price);
}

// Build full database
const allItems = [];
BRANDS.forEach(b => {
  b.models.forEach(m => {
    m.items = genListings(b, m);
    allItems.push(...m.items);
  });
});

// Analytics engine — tracks every "listing" 
const buildAnalytics = () => {
  const brandStats = BRANDS.map(b => {
    const brandItems = allItems.filter(i => i.brandSlug === b.slug);
    const prices = brandItems.map(i => i.price);
    const totalVol = prices.reduce((s, p) => s + p, 0);
    const avgP = prices.length ? Math.round(totalVol / prices.length) : 0;
    const floorP = Math.min(...prices);
    return {
      ...b,
      computedFloor: floorP,
      computedAvg: avgP,
      totalListings: brandItems.length,
      totalVolume: totalVol,
      // Simulated changes
      change1d: +(Math.random() * 12 - 4).toFixed(1),
      change7d: +(Math.random() * 20 - 6).toFixed(1),
      change30d: +(Math.random() * 30 - 8).toFixed(1),
    };
  });
  return brandStats;
};

const analytics = buildAnalytics();

// Helpers
const fmt = n => {
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};
const fmtFull = n => `$${n.toLocaleString()}`;
const pct = n => `${n >= 0 ? "+" : ""}${n}%`;

// Mini sparkline
function Spark({ positive, w = 100, h = 28 }) {
  const pts = useMemo(() => {
    const arr = [];
    let v = 50;
    for (let i = 0; i < 20; i++) {
      v += (Math.random() - (positive ? 0.4 : 0.6)) * 8;
      v = Math.max(5, Math.min(95, v));
      arr.push(v);
    }
    return arr;
  }, [positive]);
  const min = Math.min(...pts), max = Math.max(...pts), r = max - min || 1;
  const path = pts.map((p, i) => `${(i / 19) * w},${h - ((p - min) / r) * h}`).join(" ");
  const col = positive ? "#22c55e" : "#ef4444";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={`sp${positive ? "g" : "r"}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity=".25" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${path} ${w},${h}`} fill={`url(#sp${positive ? "g" : "r"})`} />
      <polyline points={path} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Interactive price chart
function PriceChart({ model, h = 220 }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const data = useMemo(() => {
    const arr = []; let p = model.avg * 0.88;
    for (let i = 90; i >= 0; i--) {
      p += (Math.random() - 0.47) * model.avg * 0.018;
      p = Math.max(model.floor * 0.85, Math.min(model.ceiling * 0.5, p));
      arr.push({ d: new Date(Date.now() - i * 864e5).toLocaleDateString("en", { month: "short", day: "numeric" }), p: Math.round(p), v: Math.round(model.floor * (5 + Math.random() * 20)) });
    }
    return arr;
  }, [model.slug]);

  const prices = data.map(d => d.p);
  const mn = Math.min(...prices), mx = Math.max(...prices), rng = mx - mn || 1;
  const W = 760;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * W},${h - 32 - ((p - mn) / rng) * (h - 52)}`).join(" ");
  const up = prices[prices.length - 1] >= prices[0];
  const col = up ? "#22c55e" : "#ef4444";

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none"
        onMouseMove={e => { if (!svgRef.current) return; const r = svgRef.current.getBoundingClientRect(); const idx = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)); if (idx >= 0 && idx < data.length) setHover(idx); }}
        onMouseLeave={() => setHover(null)} style={{ cursor: "crosshair", display: "block" }}>
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity=".18"/><stop offset="100%" stopColor={col} stopOpacity="0"/></linearGradient></defs>
        {[0,.25,.5,.75,1].map(f => { const y = h-32-f*(h-52); return <g key={f}><line x1="0" y1={y} x2={W} y2={y} stroke="#1e1e30" strokeWidth=".5"/><text x="4" y={y-3} fill="#475569" fontSize="9" fontFamily="monospace">{fmtFull(Math.round(mn+rng*f))}</text></g>; })}
        <polygon points={`0,${h-32} ${pts} ${W},${h-32}`} fill="url(#cg)" />
        <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
        {hover !== null && <>
          <line x1={(hover/(data.length-1))*W} y1="0" x2={(hover/(data.length-1))*W} y2={h} stroke="#6366f1" strokeWidth="1" strokeDasharray="3 2" />
          <circle cx={(hover/(data.length-1))*W} cy={h-32-((prices[hover]-mn)/rng)*(h-52)} r="4" fill="#6366f1" stroke="#0a0a14" strokeWidth="2" />
        </>}
      </svg>
      {hover !== null && data[hover] && (
        <div style={{ position:"absolute",top:8,right:8,background:"#12121e",border:"1px solid #262640",borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"monospace" }}>
          <div style={{color:"#64748b"}}>{data[hover].d}</div>
          <div style={{fontWeight:800,fontSize:18,color:col,marginTop:2}}>{fmtFull(data[hover].p)}</div>
          <div style={{color:"#475569",marginTop:2}}>Vol: {fmt(data[hover].v)}</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function WatchMarket() {
  // Navigation state
  const [page, setPage] = useState("discover");
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("trending"); // discover tabs
  const [collectionsSort, setCollectionsSort] = useState("volume");
  const [timeWindow, setTimeWindow] = useState("1d");
  const [traitFilters, setTraitFilters] = useState({});
  const [itemSort, setItemSort] = useState("price_low");
  const [showSidebar, setShowSidebar] = useState(true);
  const [collectorView, setCollectorView] = useState(false);

  const go = (pg, brand, model, item) => {
    setPage(pg);
    if (brand !== undefined) setSelectedBrand(brand);
    if (model !== undefined) setSelectedModel(model);
    if (item !== undefined) setSelectedItem(item);
    setTraitFilters({});
  };

  // --- STYLES ---
  const S = {
    root: { minHeight:"100vh", background:"#0b0b14", color:"#e2e8f0", fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", fontSize:14 },
    topbar: { position:"sticky",top:0,zIndex:100,background:"rgba(11,11,20,0.92)",backdropFilter:"blur(24px)",borderBottom:"1px solid #1a1a28",height:60,display:"flex",alignItems:"center",padding:"0 20px",justifyContent:"space-between" },
    pill: (active) => ({ background:active?"#2563eb":"transparent",color:active?"#fff":"#94a3b8",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }),
    card: { background:"#111119",border:"1px solid #1c1c2a",borderRadius:10,overflow:"hidden",cursor:"pointer",transition:"all .2s" },
    statRow: { display:"grid",gridTemplateColumns:"40px 2.5fr 1fr 1fr 1fr 1fr 100px",padding:"12px 16px",alignItems:"center",borderBottom:"1px solid #141420",cursor:"pointer",transition:"background .12s" },
  };

  // ═══════════════════════════════════════════════════════════════
  // TOP NAV — matches OpenSea's: Logo | Discover | Collections | Activity | Rewards | search | connect
  // ═══════════════════════════════════════════════════════════════
  const Nav = () => (
    <div style={S.topbar}>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        <div onClick={() => go("discover")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22}}>⌚</span>
          <span style={{fontSize:17,fontWeight:800,letterSpacing:"-0.02em",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>WatchMarket</span>
        </div>
        <div style={{display:"flex",gap:2}}>
          {[
            {l:"Discover",p:"discover"},{l:"Collections",p:"collections"},{l:"Activity",p:"activity"},{l:"Analytics",p:"analytics"},
          ].map(n=>(
            <button key={n.p} onClick={()=>go(n.p)} style={S.pill(page===n.p)}>{n.l}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{position:"relative"}}>
          <input value={search} onChange={e=>{setSearch(e.target.value);if(e.target.value&&page!=="collections")go("collections")}}
            placeholder="Search brands, models, references..."
            style={{width:280,height:38,borderRadius:10,border:"1px solid #22222e",background:"#111119",color:"#e2e8f0",padding:"0 14px 0 34px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#475569"}}>🔍</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#64748b",padding:"6px 12px",border:"1px solid #22222e",borderRadius:8}}>
          <span style={{width:8,height:8,borderRadius:4,background:"#22c55e"}} /> Live
        </div>
        <button style={{background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          List a Watch
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // DISCOVER PAGE — OpenSea homepage: Trending, Featured, Top Movers
  // ═══════════════════════════════════════════════════════════════
  const Discover = () => {
    const sorted = [...analytics].sort((a,b) => {
      if(tab==="trending") return Math.abs(b.change1d)-Math.abs(a.change1d);
      if(tab==="top") return b.totalVolume-a.totalVolume;
      return b.change1d-a.change1d;
    });

    return (
      <div style={{maxWidth:1280,margin:"0 auto",padding:"0 20px"}}>
        {/* Hero */}
        <div style={{padding:"36px 0 8px"}}>
          <h1 style={{fontSize:32,fontWeight:900,margin:0,letterSpacing:"-0.03em"}}>Discover</h1>
          <p style={{color:"#64748b",fontSize:14,margin:"6px 0 0"}}>The watch market, indexed in real time. Every listing tracked.</p>
        </div>

        {/* Category tabs like OpenSea: All | Gaming | Art... → All | Dive | Chronograph | Dress... */}
        <div style={{display:"flex",gap:4,margin:"16px 0",borderBottom:"1px solid #1a1a28",paddingBottom:1}}>
          {["All","Dive","Chronograph","Dress","Sport","Luxury Sport","Complication","Heritage"].map(cat=>(
            <button key={cat} onClick={()=>setTab(cat==="All"?"trending":cat.toLowerCase())} style={{
              background:"none",border:"none",borderBottom:tab===(cat==="All"?"trending":cat.toLowerCase())?"2px solid #2563eb":"2px solid transparent",
              color:tab===(cat==="All"?"trending":cat.toLowerCase())?"#f1f5f9":"#64748b",
              padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
            }}>{cat}</button>
          ))}
        </div>

        {/* Trending Collections Table — exactly like OpenSea's */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"20px 0 10px"}}>
          <div style={{display:"flex",gap:4}}>
            {["1h","1d","7d","30d"].map(t=>(
              <button key={t} onClick={()=>setTimeWindow(t)} style={{
                background:timeWindow===t?"#1e293b":"transparent",color:timeWindow===t?"#f1f5f9":"#64748b",
                border:`1px solid ${timeWindow===t?"#334155":"transparent"}`,borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              }}>{t}</button>
            ))}
          </div>
          <button onClick={()=>go("collections")} style={{...S.pill(false),color:"#2563eb",fontSize:12}}>View all →</button>
        </div>

        {/* Table Header */}
        <div style={{...S.statRow,background:"#0d0d18",borderRadius:"10px 10px 0 0",borderBottom:"1px solid #1a1a28",cursor:"default"}}>
          <div style={{fontSize:11,color:"#475569",fontWeight:700}}>#</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Collection</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>Floor</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>Volume</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>{timeWindow} %</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>Listed</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>Trend</div>
        </div>

        {/* Table Rows */}
        <div style={{background:"#111119",borderRadius:"0 0 10px 10px",border:"1px solid #1c1c2a",borderTop:"none"}}>
          {sorted.map((b, i) => {
            const ch = timeWindow==="1d"?b.change1d:timeWindow==="7d"?b.change7d:b.change30d;
            return (
              <div key={b.slug} onClick={()=>{setSelectedBrand(b);go("brand",b)}}
                style={S.statRow}
                onMouseEnter={e=>e.currentTarget.style.background="#161622"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{fontWeight:700,color:"#475569",fontFamily:"monospace",fontSize:12}}>{i+1}</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:8,background:"#1a1a28",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{b.icon}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontWeight:700,fontSize:14}}>{b.name}</span>
                      {b.verified && <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{fontSize:11,color:"#475569"}}>{b.models?.length || 0} models · {b.annualProd > 100000 ? `${(b.annualProd/1000).toFixed(0)}K` : `${(b.annualProd/1000).toFixed(1)}K`}/yr</div>
                  </div>
                </div>
                <div style={{textAlign:"right",fontWeight:700,fontFamily:"monospace",fontSize:13}}>{fmt(b.computedFloor)}</div>
                <div style={{textAlign:"right",fontWeight:600,fontFamily:"monospace",fontSize:13,color:"#94a3b8"}}>{fmt(b.totalVolume)}</div>
                <div style={{textAlign:"right",fontWeight:700,fontFamily:"monospace",fontSize:13,color:ch>=0?"#22c55e":"#ef4444"}}>{pct(ch)}</div>
                <div style={{textAlign:"right",fontFamily:"monospace",fontSize:13,color:"#94a3b8"}}>{b.totalListings.toLocaleString()}</div>
                <div style={{display:"flex",justifyContent:"flex-end"}}><Spark positive={ch>=0} /></div>
              </div>
            );
          })}
        </div>

        {/* Featured Collections Carousel */}
        <div style={{marginTop:36}}>
          <h2 style={{fontSize:18,fontWeight:800,margin:"0 0 14px"}}>Featured Collections</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {BRANDS.slice(0,4).map(b=>(
              <div key={b.slug} onClick={()=>{setSelectedBrand(b);go("brand",b)}} style={{
                ...S.card,borderRadius:14,overflow:"hidden",
              }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.transform="translateY(-3px)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#1c1c2a";e.currentTarget.style.transform="none"}}>
                <div style={{height:100,background:b.banner,display:"flex",alignItems:"flex-end",padding:14}}>
                  <div style={{width:40,height:40,borderRadius:10,background:"#111119",border:"2px solid #0b0b14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:-24}}>{b.icon}</div>
                </div>
                <div style={{padding:"18px 14px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontWeight:700,fontSize:14}}>{b.name}</span>
                    {b.verified && <svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
                    <div><div style={{fontSize:10,color:"#475569"}}>Floor</div><div style={{fontWeight:700,fontFamily:"monospace",fontSize:13}}>{fmt(b.computedFloor)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"#475569"}}>{timeWindow} %</div><div style={{fontWeight:700,fontFamily:"monospace",fontSize:13,color:b.change1d>=0?"#22c55e":"#ef4444"}}>{pct(b.change1d)}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Movers */}
        <div style={{marginTop:36,marginBottom:40}}>
          <h2 style={{fontSize:18,fontWeight:800,margin:"0 0 14px"}}>Top Movers Today</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[...analytics].sort((a,b)=>b.change1d-a.change1d).slice(0,6).map((b,i)=>(
              <div key={b.slug} onClick={()=>{setSelectedBrand(b);go("brand",b)}}
                style={{...S.card,padding:16,display:"flex",alignItems:"center",gap:12}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#2563eb"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1c1c2a"}>
                <div style={{fontSize:24}}>{b.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{b.name}</div>
                  <div style={{fontSize:11,color:"#475569"}}>Floor: {fmt(b.computedFloor)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,fontFamily:"monospace",fontSize:16,color:b.change1d>=0?"#22c55e":"#ef4444"}}>{pct(b.change1d)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // COLLECTIONS PAGE — OpenSea /collections: ranked list, filterable
  // ═══════════════════════════════════════════════════════════════
  const Collections = () => {
    const filtered = useMemo(()=>{
      let arr = [...analytics];
      if(search){ const q=search.toLowerCase(); arr=arr.filter(b=>b.name.toLowerCase().includes(q)||b.slug.includes(q)); }
      if(collectionsSort==="volume") arr.sort((a,b)=>b.totalVolume-a.totalVolume);
      else if(collectionsSort==="floor_asc") arr.sort((a,b)=>a.computedFloor-b.computedFloor);
      else if(collectionsSort==="floor_desc") arr.sort((a,b)=>b.computedFloor-a.computedFloor);
      else if(collectionsSort==="change") arr.sort((a,b)=>b.change1d-a.change1d);
      return arr;
    },[search,collectionsSort]);

    return (
      <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <h1 style={{fontSize:24,fontWeight:900,margin:0}}>Collections</h1>
            <p style={{color:"#64748b",fontSize:13,margin:"4px 0 0"}}>{filtered.length} verified watch brands</p>
          </div>
          <select value={collectionsSort} onChange={e=>setCollectionsSort(e.target.value)} style={{background:"#111119",color:"#e2e8f0",border:"1px solid #22222e",borderRadius:8,padding:"7px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>
            <option value="volume">Volume</option><option value="floor_asc">Floor: Low → High</option><option value="floor_desc">Floor: High → Low</option><option value="change">24h Change</option>
          </select>
        </div>
        {/* same table as discover */}
        <div style={{...S.statRow,background:"#0d0d18",borderRadius:"10px 10px 0 0",borderBottom:"1px solid #1a1a28",cursor:"default"}}>
          <div style={{fontSize:11,color:"#475569",fontWeight:700}}>#</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700}}>COLLECTION</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>FLOOR</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>VOLUME</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>24H %</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>LISTED</div>
          <div style={{fontSize:11,color:"#475569",fontWeight:700,textAlign:"right"}}>TREND</div>
        </div>
        <div style={{background:"#111119",borderRadius:"0 0 10px 10px",border:"1px solid #1c1c2a",borderTop:"none"}}>
          {filtered.map((b,i)=>(
            <div key={b.slug} onClick={()=>{setSelectedBrand(b);go("brand",b)}} style={S.statRow}
              onMouseEnter={e=>e.currentTarget.style.background="#161622"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{fontWeight:700,color:"#475569",fontFamily:"monospace",fontSize:12}}>{i+1}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:"#1a1a28",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{b.icon}</div>
                <div><div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:5}}>{b.name} {b.verified&&<svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>}</div>
                <div style={{fontSize:11,color:"#475569"}}>{b.hq}</div></div>
              </div>
              <div style={{textAlign:"right",fontWeight:700,fontFamily:"monospace"}}>{fmt(b.computedFloor)}</div>
              <div style={{textAlign:"right",fontFamily:"monospace",color:"#94a3b8"}}>{fmt(b.totalVolume)}</div>
              <div style={{textAlign:"right",fontWeight:700,fontFamily:"monospace",color:b.change1d>=0?"#22c55e":"#ef4444"}}>{pct(b.change1d)}</div>
              <div style={{textAlign:"right",fontFamily:"monospace",color:"#94a3b8"}}>{b.totalListings}</div>
              <div style={{display:"flex",justifyContent:"flex-end"}}><Spark positive={b.change1d>=0}/></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // BRAND PAGE — OpenSea Collection Page
  // Banner → Stats bar → Sidebar filters + Item grid
  // ═══════════════════════════════════════════════════════════════
  const BrandPage = () => {
    const b = selectedBrand;
    if(!b) return null;
    const brand = BRANDS.find(x=>x.slug===b.slug) || b;
    const brandItems = allItems.filter(i=>i.brandSlug===brand.slug);
    const [activeModel, setActiveModel] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all"); // all, listed
    const [materialFilter, setMaterialFilter] = useState("all");
    const [conditionFilter, setConditionFilter] = useState("all");
    const [localSort, setLocalSort] = useState("price_low");
    const [viewMode, setViewMode] = useState("grid"); // grid, list

    const filtered = useMemo(()=>{
      let arr = [...brandItems];
      if(activeModel!=="all") arr=arr.filter(i=>i.modelSlug===activeModel);
      if(materialFilter!=="all") arr=arr.filter(i=>i.material===materialFilter);
      if(conditionFilter!=="all") arr=arr.filter(i=>i.condition===conditionFilter);
      if(localSort==="price_low") arr.sort((a,b)=>a.price-b.price);
      else if(localSort==="price_high") arr.sort((a,b)=>b.price-a.price);
      else if(localSort==="recent") arr.sort((a,b)=>a.listedDaysAgo-b.listedDaysAgo);
      return arr;
    },[brandItems,activeModel,materialFilter,conditionFilter,localSort]);

    const prices = filtered.map(i=>i.price);
    const floor = prices.length ? Math.min(...prices) : 0;
    const listed = filtered.length;
    const uniqueSellers = new Set(filtered.map(i=>i.seller)).size;

    return (
      <div>
        {/* Banner — like OpenSea collection banner */}
        <div style={{height:180,background:brand.banner,position:"relative"}}>
          <div style={{position:"absolute",bottom:-32,left:32,width:72,height:72,borderRadius:16,background:"#111119",border:"3px solid #0b0b14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>
            {brand.icon}
          </div>
        </div>

        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 20px"}}>
          {/* Brand info row */}
          <div style={{paddingTop:44,paddingBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <h1 style={{fontSize:26,fontWeight:900,margin:0}}>{brand.name}</h1>
              {brand.verified && <svg width="18" height="18" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
            </div>
            <p style={{color:"#94a3b8",fontSize:13,margin:0,maxWidth:600}}>{brand.description}</p>
          </div>

          {/* Stats bar — exactly like OpenSea: Floor price | 1d floor % | Top offer | 24h volume | Total volume | Listed | Owners */}
          <div style={{display:"flex",gap:28,padding:"14px 0",borderTop:"1px solid #1a1a28",borderBottom:"1px solid #1a1a28",marginBottom:16}}>
            {[
              {l:"Floor price",v:fmtFull(floor)},
              {l:"1d floor %",v:pct(b.change1d||0),c:((b.change1d||0)>=0?"#22c55e":"#ef4444")},
              {l:"24h volume",v:fmt(b.totalVolume*0.03)},
              {l:"Total volume",v:fmt(b.totalVolume)},
              {l:"Listed",v:listed.toLocaleString()},
              {l:"Owners (Unique)",v:uniqueSellers.toLocaleString()},
            ].map(s=>(
              <div key={s.l}>
                <div style={{fontSize:11,color:"#475569",fontWeight:600}}>{s.l}</div>
                <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:s.c||"#f1f5f9",marginTop:2}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Model tabs — like OpenSea traits tabs */}
          <div style={{display:"flex",gap:4,marginBottom:12,overflowX:"auto"}}>
            <button onClick={()=>setActiveModel("all")} style={{
              background:activeModel==="all"?"#1e293b":"transparent",color:activeModel==="all"?"#f1f5f9":"#64748b",
              border:`1px solid ${activeModel==="all"?"#334155":"#1c1c2a"}`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
            }}>All Models</button>
            {brand.models?.map(m=>(
              <button key={m.slug} onClick={()=>setActiveModel(m.slug)} style={{
                background:activeModel===m.slug?"#1e293b":"transparent",color:activeModel===m.slug?"#f1f5f9":"#64748b",
                border:`1px solid ${activeModel===m.slug?"#334155":"#1c1c2a"}`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
              }}>{m.name} <span style={{color:"#475569",marginLeft:4}}>{m.items?.length||0}</span></button>
            ))}
          </div>

          {/* Content: Sidebar + Grid — OpenSea's layout */}
          <div style={{display:"flex",gap:16,minHeight:"70vh"}}>
            {/* Sidebar Filters — like OpenSea's left panel */}
            {showSidebar && (
              <div style={{width:240,flexShrink:0}}>
                {/* Status */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Status</div>
                  <div style={{display:"flex",gap:4}}>
                    {["all","Listed"].map(s=>(
                      <button key={s} onClick={()=>setStatusFilter(s.toLowerCase())} style={{
                        background:statusFilter===s.toLowerCase()?"#1e293b":"#111119",
                        color:statusFilter===s.toLowerCase()?"#f1f5f9":"#64748b",
                        border:"1px solid #1c1c2a",borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                      }}>{s==="all"?"All":s}</button>
                    ))}
                  </div>
                </div>
                {/* Material trait */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Material</div>
                  <select value={materialFilter} onChange={e=>setMaterialFilter(e.target.value)} style={{width:"100%",background:"#111119",color:"#e2e8f0",border:"1px solid #1c1c2a",borderRadius:6,padding:"7px 10px",fontSize:12,fontFamily:"inherit"}}>
                    <option value="all">All Materials</option>
                    {MATERIALS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {/* Condition trait */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Condition</div>
                  <select value={conditionFilter} onChange={e=>setConditionFilter(e.target.value)} style={{width:"100%",background:"#111119",color:"#e2e8f0",border:"1px solid #1c1c2a",borderRadius:6,padding:"7px 10px",fontSize:12,fontFamily:"inherit"}}>
                    <option value="all">All Conditions</option>
                    {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Price range */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>Price</div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input placeholder="Min" style={{flex:1,background:"#111119",border:"1px solid #1c1c2a",borderRadius:6,padding:"6px 8px",color:"#e2e8f0",fontSize:12,fontFamily:"inherit",outline:"none"}} />
                    <span style={{color:"#475569"}}>to</span>
                    <input placeholder="Max" style={{flex:1,background:"#111119",border:"1px solid #1c1c2a",borderRadius:6,padding:"6px 8px",color:"#e2e8f0",fontSize:12,fontFamily:"inherit",outline:"none"}} />
                  </div>
                </div>
                {/* Analytics summary for this brand */}
                <div style={{background:"#0d0d18",borderRadius:10,padding:14,border:"1px solid #1c1c2a",marginTop:20}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#2563eb",textTransform:"uppercase",marginBottom:8}}>Brand Intelligence</div>
                  <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.8}}>
                    <div>Annual Production: <b style={{color:"#f1f5f9"}}>{(brand.annualProd/1000).toFixed(0)}K</b></div>
                    <div>Market Share: <b style={{color:"#f1f5f9"}}>{brand.marketShare}%</b></div>
                    <div>Founded: <b style={{color:"#f1f5f9"}}>{brand.founded}</b></div>
                    <div>Supply Ratio: <b style={{color:listed/brand.annualProd>.03?"#ef4444":"#22c55e"}}>{(listed/brand.annualProd*100).toFixed(1)}%</b></div>
                  </div>
                </div>
              </div>
            )}

            {/* Items Grid */}
            <div style={{flex:1}}>
              {/* Sort bar — like OpenSea's */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>setShowSidebar(!showSidebar)} style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#94a3b8",fontSize:14}}>
                    {showSidebar?"◀":"▶"}
                  </button>
                  <span style={{fontSize:13,color:"#94a3b8"}}>{filtered.length} items</span>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <select value={localSort} onChange={e=>setLocalSort(e.target.value)} style={{background:"#111119",color:"#e2e8f0",border:"1px solid #1c1c2a",borderRadius:6,padding:"5px 10px",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>
                    <option value="price_low">Price low to high</option>
                    <option value="price_high">Price high to low</option>
                    <option value="recent">Recently listed</option>
                  </select>
                  <div style={{display:"flex",border:"1px solid #1c1c2a",borderRadius:6,overflow:"hidden"}}>
                    <button onClick={()=>setViewMode("grid")} style={{background:viewMode==="grid"?"#1e293b":"#111119",border:"none",padding:"5px 8px",cursor:"pointer",color:viewMode==="grid"?"#f1f5f9":"#475569",fontSize:13}}>⊞</button>
                    <button onClick={()=>setViewMode("list")} style={{background:viewMode==="list"?"#1e293b":"#111119",border:"none",padding:"5px 8px",cursor:"pointer",color:viewMode==="list"?"#f1f5f9":"#475569",fontSize:13}}>☰</button>
                  </div>
                </div>
              </div>

              {/* Item cards — OpenSea grid */}
              <div style={{display:"grid",gridTemplateColumns:viewMode==="grid"?`repeat(${showSidebar?3:4},1fr)`:"1fr",gap:10}}>
                {filtered.slice(0,24).map(item=>(
                  <div key={item.id} onClick={()=>go("item",selectedBrand,null,item)}
                    style={{...S.card}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 30px rgba(37,99,235,0.12)"}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="#1c1c2a";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
                    {viewMode==="grid" ? (
                      <>
                        {/* Card image area */}
                        <div style={{height:160,background:"linear-gradient(135deg,#111119 0%,#1a1a2e 100%)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                          <span style={{fontSize:52,filter:"drop-shadow(0 4px 12px rgba(0,0,0,.3))"}}>{item.brandIcon}</span>
                          {item.rarity!=="Common" && (
                            <div style={{position:"absolute",top:8,left:8,background:item.rarity==="Legendary"?"#eab30820":item.rarity==="Rare"?"#8b5cf620":"#22c55e20",color:item.rarity==="Legendary"?"#eab308":item.rarity==="Rare"?"#8b5cf6":"#22c55e",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>{item.rarity}</div>
                          )}
                          {item.box&&item.papers&&<div style={{position:"absolute",top:8,right:8,background:"#22c55e18",color:"#22c55e",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:600}}>Full Set</div>}
                        </div>
                        {/* Card info */}
                        <div style={{padding:"10px 12px 12px"}}>
                          <div style={{fontSize:11,color:"#475569"}}>{item.brandName}</div>
                          <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.modelName}</div>
                          <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>{item.ref} · {item.year} · {item.material.split(" ")[0]}</div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                            <div>
                              <div style={{fontSize:10,color:"#475569"}}>Price</div>
                              <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace"}}>{fmtFull(item.price)}</div>
                            </div>
                            <div style={{fontSize:10,color:"#475569"}}>{item.listedDaysAgo}d ago</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      // List view
                      <div style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px"}}>
                        <div style={{width:50,height:50,borderRadius:8,background:"#1a1a28",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{item.brandIcon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13}}>{item.modelName} {item.ref}</div>
                          <div style={{fontSize:11,color:"#64748b"}}>{item.material} · {item.dial} · {item.year} · {item.condition.split(" ")[0]}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontFamily:"monospace",fontSize:15}}>{fmtFull(item.price)}</div>
                          <div style={{fontSize:10,color:"#475569"}}>{item.listedDaysAgo}d ago</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // ITEM DETAIL — OpenSea NFT detail page
  // ═══════════════════════════════════════════════════════════════
  const ItemPage = () => {
    const item = selectedItem;
    if(!item) return null;
    const brand = BRANDS.find(b=>b.slug===item.brandSlug);
    const model = brand?.models.find(m=>m.slug===item.modelSlug);
    const similar = model?.items.filter(i=>i.id!==item.id).slice(0,4)||[];

    return (
      <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 20px"}}>
        {/* Breadcrumb */}
        <div style={{display:"flex",gap:6,fontSize:12,color:"#475569",marginBottom:16}}>
          <span style={{cursor:"pointer",color:"#2563eb"}} onClick={()=>go("discover")}>Home</span><span>›</span>
          <span style={{cursor:"pointer",color:"#2563eb"}} onClick={()=>{if(brand)go("brand",analytics.find(b=>b.slug===brand.slug)||brand)}}>{item.brandName}</span><span>›</span>
          <span style={{color:"#e2e8f0"}}>{item.modelName} {item.ref}</span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>
          {/* Left: Image */}
          <div>
            <div style={{background:brand?.banner||"linear-gradient(135deg,#111119,#1a1a28)",borderRadius:16,height:420,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",border:"1px solid #1c1c2a"}}>
              <span style={{fontSize:120,filter:"drop-shadow(0 8px 24px rgba(0,0,0,.4))"}}>{item.brandIcon}</span>
              {item.rarity!=="Common"&&<div style={{position:"absolute",top:16,left:16,background:"#0b0b14cc",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:item.rarity==="Legendary"?"#eab308":"#8b5cf6"}}>{item.rarity}</div>}
              <div style={{position:"absolute",bottom:16,left:16,display:"flex",gap:6}}>
                {item.box&&<span style={{background:"#22c55e18",color:"#22c55e",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600}}>Box ✓</span>}
                {item.papers&&<span style={{background:"#3b82f618",color:"#3b82f6",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600}}>Papers ✓</span>}
              </div>
            </div>
            {/* Price chart */}
            {model && (
              <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:12,padding:16,marginTop:14}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Price History — {model.name}</div>
                <PriceChart model={model} h={160} />
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div>
            <div style={{fontSize:13,color:"#2563eb",fontWeight:600,marginBottom:4}}>{item.brandName}</div>
            <h1 style={{fontSize:26,fontWeight:900,margin:"0 0 4px"}}>{item.modelName} — Ref. {item.ref}</h1>
            <div style={{fontSize:13,color:"#94a3b8",marginBottom:20}}>{item.material} · {item.dial} · {item.size} · {item.year} · {item.condition}</div>

            {/* Price Box */}
            <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:14,padding:24,marginBottom:16}}>
              <div style={{fontSize:11,color:"#475569",marginBottom:4}}>Current Price</div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:"monospace"}}>{fmtFull(item.price)}</div>
              {model && <div style={{fontSize:13,color:item.price<=model.avg?"#22c55e":"#ef4444",fontWeight:600,marginTop:4}}>
                {item.price <= model.avg ? `${Math.round((1-item.price/model.avg)*100)}% below avg` : `${Math.round((item.price/model.avg-1)*100)}% above avg`}
              </div>}
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button style={{flex:1,background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"none",borderRadius:10,padding:14,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Buy Now</button>
                <button style={{flex:1,background:"transparent",border:"1px solid #2563eb",borderRadius:10,padding:14,fontSize:15,fontWeight:700,color:"#2563eb",cursor:"pointer",fontFamily:"inherit"}}>Make Offer</button>
              </div>
            </div>

            {/* Traits — OpenSea-style property boxes */}
            <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:14,padding:20,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Traits</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[
                  {t:"Brand",v:item.brandName},{t:"Model",v:item.modelName},{t:"Reference",v:item.ref},
                  {t:"Material",v:item.material},{t:"Dial",v:item.dial},{t:"Size",v:item.size},
                  {t:"Year",v:String(item.year)},{t:"Condition",v:item.condition.split("(")[0].trim()},{t:"Category",v:item.category||""},
                ].map(tr=>(
                  <div key={tr.t} style={{background:"#2563eb08",border:"1px solid #1c1c2a",borderRadius:8,padding:10,textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#2563eb",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700}}>{tr.t}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",marginTop:3}}>{tr.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seller / Details */}
            <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:14,padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,color:"#475569"}}>Seller</div><div style={{fontWeight:700}}>{item.seller}</div></div>
              <div><div style={{fontSize:11,color:"#475569"}}>Rating</div><div style={{fontWeight:700}}>⭐ {item.sellerRating}</div></div>
              <div><div style={{fontSize:11,color:"#475569"}}>Sales</div><div style={{fontWeight:700}}>{item.sellerSales}</div></div>
              <div><div style={{fontSize:11,color:"#475569"}}>Listed</div><div style={{fontWeight:700}}>{item.listedDaysAgo}d ago</div></div>
              <div><div style={{fontSize:11,color:"#475569"}}>Views</div><div style={{fontWeight:700}}>{item.views}</div></div>
            </div>
          </div>
        </div>

        {/* More from this model */}
        {similar.length>0 && (
          <div style={{marginTop:32}}>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:12}}>More from {model?.name}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {similar.map(s=>(
                <div key={s.id} onClick={()=>go("item",selectedBrand,null,s)} style={{...S.card}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.transform="translateY(-2px)"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#1c1c2a";e.currentTarget.style.transform="none"}}>
                  <div style={{height:120,background:"linear-gradient(135deg,#111119,#1a1a2e)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:40}}>{s.brandIcon}</span></div>
                  <div style={{padding:"10px 12px"}}>
                    <div style={{fontWeight:700,fontSize:12}}>{s.modelName} {s.ref}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{s.material.split(" ")[0]} · {s.year}</div>
                    <div style={{fontWeight:800,fontFamily:"monospace",fontSize:14,marginTop:4}}>{fmtFull(s.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // ACTIVITY PAGE — OpenSea /activity: recent sales feed
  // ═══════════════════════════════════════════════════════════════
  const Activity = () => {
    const recentSales = useMemo(()=>{
      return [...allItems].sort(()=>Math.random()-.5).slice(0,30).map(item=>({
        ...item, event: ["Sale","Listing","Offer"][Math.floor(Math.random()*3)],
        time: `${Math.floor(Math.random()*59)+1}m ago`,
      }));
    },[]);

    return (
      <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 20px"}}>
        <h1 style={{fontSize:24,fontWeight:900,margin:"0 0 20px"}}>Activity</h1>
        <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"80px 50px 2fr 1fr 1fr 1fr 80px",padding:"12px 16px",background:"#0d0d18",fontSize:11,color:"#475569",fontWeight:700}}>
            <div>Event</div><div></div><div>Item</div><div style={{textAlign:"right"}}>Price</div><div style={{textAlign:"right"}}>From</div><div style={{textAlign:"right"}}>To</div><div style={{textAlign:"right"}}>Time</div>
          </div>
          {recentSales.map((s,i)=>(
            <div key={i} onClick={()=>go("item",analytics.find(b=>b.slug===s.brandSlug),null,s)}
              style={{display:"grid",gridTemplateColumns:"80px 50px 2fr 1fr 1fr 1fr 80px",padding:"10px 16px",borderTop:"1px solid #141420",cursor:"pointer",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.background="#161622"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div><span style={{background:s.event==="Sale"?"#22c55e18":s.event==="Listing"?"#2563eb18":"#eab30818",color:s.event==="Sale"?"#22c55e":s.event==="Listing"?"#2563eb":"#eab308",borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600}}>{s.event}</span></div>
              <div style={{fontSize:20}}>{s.brandIcon}</div>
              <div><div style={{fontWeight:700,fontSize:13}}>{s.modelName} {s.ref}</div><div style={{fontSize:11,color:"#475569"}}>{s.brandName} · {s.material.split(" ")[0]}</div></div>
              <div style={{textAlign:"right",fontWeight:700,fontFamily:"monospace"}}>{fmtFull(s.price)}</div>
              <div style={{textAlign:"right",fontSize:12,color:"#64748b"}}>{s.seller.slice(0,12)}...</div>
              <div style={{textAlign:"right",fontSize:12,color:"#64748b"}}>buyer_{Math.floor(Math.random()*999)}</div>
              <div style={{textAlign:"right",fontSize:12,color:"#475569"}}>{s.time}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // ANALYTICS PAGE — The investment intelligence layer
  // ═══════════════════════════════════════════════════════════════
  const Analytics = () => {
    const hot = [...analytics].sort((a,b)=>b.change30d-a.change30d);
    const risky = BRANDS.flatMap(b=>b.models.map(m=>({...m,brand:b.name,icon:b.icon,ratio:m.items.length/m.yearlyProd}))).sort((a,b)=>b.ratio-a.ratio);
    const totalVol = analytics.reduce((s,b)=>s+b.totalVolume,0);
    const totalProd = BRANDS.reduce((s,b)=>s+b.annualProd,0);

    return (
      <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 20px"}}>
        <h1 style={{fontSize:28,fontWeight:900,margin:"0 0 6px"}}>Market Analytics</h1>
        <p style={{color:"#64748b",fontSize:14,margin:"0 0 24px"}}>Every listing feeds this intelligence engine. Supply, demand, ROI signals — all in real time.</p>

        {/* Top stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:28}}>
          {[
            {l:"Total Market Value",v:fmt(totalVol)},{l:"Active Listings",v:allItems.length.toLocaleString()},{l:"Brands Tracked",v:BRANDS.length},{l:"Models Tracked",v:BRANDS.reduce((s,b)=>s+b.models.length,0)},{l:"Annual Production",v:`${(totalProd/1e6).toFixed(2)}M`},
          ].map(s=>(
            <div key={s.l} style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:10,padding:16}}>
              <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:"monospace"}}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Hot & Cold */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28}}>
          <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:12,padding:20}}>
            <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 14px",color:"#22c55e"}}>🔥 Highest Demand — 30d Momentum</h3>
            {hot.slice(0,6).map((b,i)=>(
              <div key={b.slug} onClick={()=>go("brand",b)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<5?"1px solid #141420":"none",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:11,color:"#475569",fontFamily:"monospace",minWidth:18}}>#{i+1}</span><span style={{fontSize:18}}>{b.icon}</span><div><div style={{fontWeight:700,fontSize:13}}>{b.name}</div><div style={{fontSize:11,color:"#475569"}}>{b.totalListings} listed</div></div></div>
                <div style={{fontWeight:800,fontFamily:"monospace",fontSize:16,color:"#22c55e"}}>{pct(b.change30d)}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:12,padding:20}}>
            <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 14px",color:"#ef4444"}}>❄️ Cooling Down — Potential Crash Risk</h3>
            {hot.slice(-5).reverse().map((b,i)=>(
              <div key={b.slug} onClick={()=>go("brand",b)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<4?"1px solid #141420":"none",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:11,color:"#475569",fontFamily:"monospace",minWidth:18}}>#{i+1}</span><span style={{fontSize:18}}>{b.icon}</span><div><div style={{fontWeight:700,fontSize:13}}>{b.name}</div></div></div>
                <div style={{fontWeight:800,fontFamily:"monospace",fontSize:16,color:"#ef4444"}}>{pct(b.change30d)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Supply Risk — the killer feature */}
        <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:12,padding:24,marginBottom:28}}>
          <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>⚠️ Supply Oversaturation Risk</h3>
          <p style={{color:"#64748b",fontSize:12,margin:"0 0 16px"}}>Models with too many listings relative to annual production — potential downward price pressure</p>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",padding:"10px 0",borderBottom:"1px solid #1a1a28",fontSize:11,color:"#475569",fontWeight:700}}>
            <div>Model</div><div style={{textAlign:"right"}}>Listed</div><div style={{textAlign:"right"}}>Annual Prod.</div><div style={{textAlign:"right"}}>Ratio</div><div style={{textAlign:"right"}}>Risk</div>
          </div>
          {risky.slice(0,12).map((m,i)=>{
            const risk = m.ratio>0.004?"HIGH":m.ratio>0.002?"MEDIUM":"LOW";
            const rc = risk==="HIGH"?"#ef4444":risk==="MEDIUM"?"#eab308":"#22c55e";
            return (
              <div key={`${m.brand}-${m.slug}`} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",padding:"10px 0",borderBottom:"1px solid #141420",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>{m.icon}</span><div><div style={{fontWeight:700,fontSize:13}}>{m.name}</div><div style={{fontSize:11,color:"#475569"}}>{m.brand}</div></div></div>
                <div style={{textAlign:"right",fontFamily:"monospace"}}>{m.items.length}</div>
                <div style={{textAlign:"right",fontFamily:"monospace"}}>{m.yearlyProd > 1000 ? `${(m.yearlyProd/1000).toFixed(0)}K` : m.yearlyProd}</div>
                <div style={{textAlign:"right",fontFamily:"monospace",fontWeight:700,color:rc}}>{(m.ratio*100).toFixed(2)}%</div>
                <div style={{textAlign:"right"}}><span style={{background:rc+"18",color:rc,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700}}>{risk}</span></div>
              </div>
            );
          })}
        </div>

        {/* ROI Potential */}
        <div style={{background:"#111119",border:"1px solid #1c1c2a",borderRadius:12,padding:24}}>
          <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>💰 ROI Signal — Best Investment Potential</h3>
          <p style={{color:"#64748b",fontSize:12,margin:"0 0 16px"}}>Models with rising demand + low supply ratio + strong price momentum</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {BRANDS.flatMap(b=>b.models.filter(m=>m.yearlyProd<50000).map(m=>({...m,brand:b.name,icon:b.icon,spread:((m.ceiling-m.floor)/m.floor*100).toFixed(0),supplyRatio:(m.items.length/m.yearlyProd)}))).sort((a,b)=>b.spread-a.spread).slice(0,8).map(m=>(
              <div key={`${m.brand}-${m.slug}`} style={{background:"#0d0d18",border:"1px solid #1c1c2a",borderRadius:10,padding:16}}>
                <div style={{fontSize:24,marginBottom:6}}>{m.icon}</div>
                <div style={{fontWeight:700,fontSize:13}}>{m.name}</div>
                <div style={{fontSize:11,color:"#475569",marginBottom:8}}>{m.brand}</div>
                <div style={{fontSize:10,color:"#475569"}}>Floor → Ceiling Spread</div>
                <div style={{fontSize:20,fontWeight:900,fontFamily:"monospace",color:"#22c55e"}}>{m.spread}%</div>
                <div style={{marginTop:6,fontSize:10,color:"#475569"}}>Floor: {fmtFull(m.floor)} → {fmtFull(m.ceiling)}</div>
                <div style={{marginTop:4,fontSize:10,color:m.supplyRatio<0.002?"#22c55e":"#eab308"}}>Supply: {m.supplyRatio<0.002?"Scarce":"Moderate"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0b0b14}::-webkit-scrollbar-thumb{background:#22222e;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#2563eb}
        select{cursor:pointer}select option{background:#111119;color:#e2e8f0}
        input:focus{border-color:#2563eb!important;outline:none;box-shadow:0 0 0 2px rgba(37,99,235,.2)}
        button{transition:all .15s}button:hover{filter:brightness(1.1)}
      `}</style>
      <Nav />
      <div style={{paddingBottom:60}}>
        {page==="discover" && <Discover />}
        {page==="collections" && <Collections />}
        {page==="brand" && <BrandPage />}
        {page==="item" && <ItemPage />}
        {page==="activity" && <Activity />}
        {page==="analytics" && <Analytics />}
      </div>
    </div>
  );
}
