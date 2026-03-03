// scripts/snapshot-fx-rates.mjs
// Fetch live FX rates from frankfurter.app and store in Supabase fx_rates table.
// Only inserts a new row if the last row is > 1 hour old.
// Run daily via cron, or manually: node scripts/snapshot-fx-rates.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FX_API_URL = 'https://api.frankfurter.app/latest?from=USD&to=EUR,CHF,GBP,JPY,AED,SGD,HKD';
const ONE_HOUR_MS = 60 * 60 * 1000;

async function fetchLiveRates() {
  const res = await fetch(FX_API_URL);
  if (!res.ok) {
    throw new Error(`Frankfurter API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.rates; // { EUR: 0.92, CHF: 0.89, ... }
}

async function main() {
  console.log('\n💱 FX Rate Snapshot — frankfurter.app → fx_rates');

  // Check if the last row is fresh enough
  const { data: lastRow, error: fetchErr } = await sb
    .from('fx_rates')
    .select('id, fetched_at, rates')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    // Table might not exist yet — will be created implicitly on first insert
    // or we fall through and try inserting anyway
    console.warn('Could not fetch latest fx_rates row (table may not exist yet):', fetchErr.message);
  }

  if (lastRow) {
    const age = Date.now() - new Date(lastRow.fetched_at).getTime();
    if (age < ONE_HOUR_MS) {
      const minutesOld = Math.round(age / 60_000);
      console.log(`✅ Rates are fresh (${minutesOld}m old). No insert needed.`);
      console.log('   Current rates:', lastRow.rates);
      return;
    }
    const hoursOld = (age / ONE_HOUR_MS).toFixed(1);
    console.log(`⏰ Last snapshot is ${hoursOld}h old. Fetching fresh rates...`);
  } else {
    console.log('📭 No existing rates found. Fetching initial rates...');
  }

  // Fetch live rates
  let rates;
  try {
    rates = await fetchLiveRates();
  } catch (err) {
    console.error('❌ Failed to fetch from frankfurter.app:', err.message);
    process.exit(1);
  }

  // Insert new row
  const { error: insertErr } = await sb
    .from('fx_rates')
    .insert({
      base_currency: 'USD',
      rates,
      fetched_at: new Date().toISOString(),
    });

  if (insertErr) {
    console.error('❌ Failed to insert fx_rates row:', insertErr.message);
    // If it's a table-not-found error, print the SQL hint
    if (insertErr.code === '42P01') {
      console.error('\nHint: Run scripts/setup-analytics-tables.sql in Supabase first.');
    }
    process.exit(1);
  }

  console.log('\n✅ FX rates inserted successfully:');
  const currencies = Object.keys(rates);
  for (const currency of currencies) {
    console.log(`   1 USD = ${rates[currency].toFixed(4)} ${currency}`);
  }
  console.log(`\n   Base: USD | Currencies tracked: ${currencies.join(', ')}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
