#!/usr/bin/env node
/**
 * OpenWatch Global Market Scan Orchestrator
 * 
 * Runs the global market scanner on all priority refs and stores results.
 * Designed to run via cron or on-demand.
 * 
 * Usage:
 *   node scripts/run-global-scan.mjs              # scan all priority refs
 *   node scripts/run-global-scan.mjs --ref 126610LN  # scan specific ref
 *   node scripts/run-global-scan.mjs --quick      # fast mode: US+DE+JP only
 * 
 * Cron: 0 6 * * *  (6am daily, before US market opens)
 */

import { execSync, spawn } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const [key, ...vals] = line.split("=");
      if (key && vals.length > 0) process.env[key.trim()] = vals.join("=").trim();
    }
  } catch {}
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Priority Refs to Scan ─────────────────────────────────────────────────────
// These are the refs with highest trading volume and arbitrage potential
const PRIORITY_REFS = [
  // Rolex — most liquid, biggest arbitrage
  { ref: "126610LN",      brand: "Rolex",            model: "Submariner Date" },
  { ref: "126610LV",      brand: "Rolex",            model: "Submariner Green Bezel" },
  { ref: "126710BLRO",    brand: "Rolex",            model: "GMT-Master II Pepsi" },
  { ref: "126710BLNR",    brand: "Rolex",            model: "GMT-Master II Batman" },
  { ref: "126500LN",      brand: "Rolex",            model: "Daytona Oystersteel" },
  { ref: "126720VTNR",    brand: "Rolex",            model: "GMT-Master II SpriteM" },
  { ref: "124060",        brand: "Rolex",            model: "Submariner No-Date" },
  { ref: "126333",        brand: "Rolex",            model: "Datejust 41 Oystersteel" },
  { ref: "228238",        brand: "Rolex",            model: "Day-Date 40 Yellow Gold" },
  { ref: "326938",        brand: "Rolex",            model: "Sky-Dweller" },
  
  // Patek Philippe — highest value arbitrage
  { ref: "5711/1A-011",   brand: "Patek Philippe",   model: "Nautilus Olive" },
  { ref: "5726/1A-001",   brand: "Patek Philippe",   model: "Annual Calendar Nautilus" },
  { ref: "5980/1AR-001",  brand: "Patek Philippe",   model: "Nautilus Chronograph" },
  
  // Audemars Piguet
  { ref: "15510ST.OO.1320ST.06", brand: "Audemars Piguet", model: "Royal Oak 41 Blue" },
  { ref: "26240ST.OO.1320ST.02", brand: "Audemars Piguet", model: "Royal Oak 41 Slate" },
  { ref: "26331ST.OO.1220ST.03", brand: "Audemars Piguet", model: "Royal Oak Chrono" },
  
  // Vacheron Constantin
  { ref: "4500V/110A-B128", brand: "Vacheron Constantin", model: "Overseas 41" },
];

// ── Quick mode: fewer markets for faster scanning ─────────────────────────────
const QUICK_MARKETS = "US,DE,JP";  // US price, EU price, Japan price
const ALL_MARKETS = "US,DE,FR,UK,JP,HK,SG,CH,AE";

async function runPythonScraper(ref, markets) {
  return new Promise((resolve) => {
    const script = join(__dirname, "scrape-global-markets.py");
    const args = [script, "--ref", ref, "--markets", markets];
    
    console.log(`  🌍 Scanning ${ref} across [${markets}]...`);
    
    const proc = spawn("python3", args, {
      cwd: join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    
    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", (d) => { /* ignore scrapling logs */ });
    
    proc.on("close", (code) => {
      // Extract arbitrage summary from output
      const profitMatch = output.match(/NET PROFIT:\s+\$([0-9,]+)\s+\(([+-]?[\d.]+)%\)/);
      const cheapestMatch = output.match(/Cheapest:\s+(\w+).*?=\s+\$([0-9,]+)/);
      const priciest = output.match(/Priciest:\s+(\w+).*?=\s+\$([0-9,]+)/);
      
      resolve({
        ref,
        success: code === 0,
        netProfit: profitMatch ? parseFloat(profitMatch[2]) : null,
        cheapestMarket: cheapestMatch ? cheapestMatch[1] : null,
        output: output.substring(0, 500),
      });
    });
    
    // Timeout after 5 minutes per ref
    setTimeout(() => { proc.kill(); resolve({ ref, success: false, error: "timeout" }); }, 300000);
  });
}

async function saveSnapshot(results) {
  if (!results.length) return;
  
  const date = new Date().toISOString().split("T")[0];
  
  for (const result of results) {
    if (!result.success) continue;
    
    try {
      // Record scan in price_history for trend tracking
      await sb.from("price_history").upsert({
        ref_number: result.ref,
        source: "global_scan",
        snapshot_date: date,
        created_at: new Date().toISOString(),
      }, { onConflict: "ref_number,source,market_code,snapshot_date" }).execute();
    } catch {}
  }
}

async function main() {
  const args = process.argv.slice(2);
  const refArg = args[args.indexOf("--ref") + 1];
  const quickMode = args.includes("--quick");
  const markets = quickMode ? QUICK_MARKETS : ALL_MARKETS;
  
  const refsToScan = refArg
    ? [PRIORITY_REFS.find(r => r.ref === refArg) || { ref: refArg, brand: "Unknown" }]
    : PRIORITY_REFS;

  console.log(`\n🌍 OpenWatch Global Market Scan`);
  console.log(`   Mode: ${quickMode ? "Quick (US/DE/JP)" : "Full (9 markets)"}`);
  console.log(`   Refs: ${refsToScan.length}`);
  console.log(`   Started: ${new Date().toLocaleString()}\n`);

  const results = [];
  
  // Scan refs with small delay between each to avoid rate limiting
  for (const { ref, brand, model } of refsToScan) {
    console.log(`\n[${results.length + 1}/${refsToScan.length}] ${brand} ${model || ""} (${ref})`);
    const result = await runPythonScraper(ref, markets);
    results.push(result);
    
    if (result.netProfit !== null) {
      const emoji = result.netProfit > 5 ? "🟢" : result.netProfit > 0 ? "🟡" : "🔴";
      console.log(`    ${emoji} Net profit: ${result.netProfit > 0 ? "+" : ""}${result.netProfit?.toFixed(1)}% | Cheapest: ${result.cheapestMarket}`);
    }
    
    // 3 second delay between refs
    if (results.length < refsToScan.length) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Save scan metadata
  await saveSnapshot(results);

  // Summary
  const successful = results.filter(r => r.success);
  const profitable = results.filter(r => r.netProfit > 5);
  
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  SCAN COMPLETE`);
  console.log(`  Scanned: ${successful.length}/${refsToScan.length} refs`);
  console.log(`  Profitable arb opportunities (>5%): ${profitable.length}`);
  
  if (profitable.length > 0) {
    console.log(`\n  TOP OPPORTUNITIES:`);
    profitable
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 5)
      .forEach(r => {
        console.log(`    ${r.ref}: ${r.netProfit?.toFixed(1)}% net from ${r.cheapestMarket}`);
      });
  }
  
  console.log(`\n  View analytics: https://openwatch-two.vercel.app/analytics`);
  console.log(`  Finished: ${new Date().toLocaleString()}`);
}

main().catch(console.error);
