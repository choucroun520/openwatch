// scripts/seed-app-settings.mjs
// Seeds default (empty) rows into app_settings so the settings page renders correctly.
// Run: node scripts/seed-app-settings.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULTS = [
  { key: 'EBAY_CLIENT_ID', value: '' },
  { key: 'EBAY_CLIENT_SECRET', value: '' },
  { key: 'WATCHCHARTS_API_KEY', value: '' },
  { key: 'REDDIT_CLIENT_ID', value: '' },
  { key: 'REDDIT_CLIENT_SECRET', value: '' },
  { key: 'OPENAI_API_KEY', value: '' },
  { key: 'ANTHROPIC_API_KEY', value: '' },
];

async function main() {
  console.log('\n⚙️  Seeding app_settings defaults...');

  let seeded = 0;
  let skipped = 0;

  for (const row of DEFAULTS) {
    // Check if key already exists
    const { data: existing } = await sb
      .from('app_settings')
      .select('key, value')
      .eq('key', row.key)
      .maybeSingle();

    if (existing) {
      console.log(`  skip: ${row.key} already exists (value: ${existing.value ? '[set]' : '[empty]'})`);
      skipped++;
      continue;
    }

    const { error } = await sb.from('app_settings').insert(row);
    if (error) {
      console.error(`  error: ${row.key} — ${error.message}`);
    } else {
      console.log(`  ✓ ${row.key}`);
      seeded++;
    }
  }

  console.log(`\n✅ Done! Seeded ${seeded} keys, skipped ${skipped} (already exist).`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
