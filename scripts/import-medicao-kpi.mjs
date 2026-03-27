/**
 * Import missing MedicaoKPI records from Base44 export into Supabase.
 * Usage: node scripts/import-medicao-kpi.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://glernwcsuwcyzwsnelad.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZXJud2NzdXdjeXp3c25lbGFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4NDgzMywiZXhwIjoyMDg4MzYwODMzfQ.EgDe_4UxQfRytcc5o2UZ5NHoOwX3DMT4C5RZbNkuL-4';
const SGA_EMPRESA_ID = '128bc692-3fae-4825-9c55-40565dbedcfb';
const TABLE = 'medicao_k_p_i';
const BATCH_SIZE = 50;

// Fields to remove from each record
const REMOVE_FIELDS = new Set(['id', 'created_by_id', 'is_sample', '__v', '_id']);

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Read JSON
  const raw = readFileSync(join(__dirname, 'data', 'medicao_kpi.json'), 'utf-8');
  const records = JSON.parse(raw);
  console.log(`Loaded ${records.length} records from JSON`);

  // 2. Check current count in Supabase
  const { count: existingCount } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true });
  console.log(`Existing records in Supabase: ${existingCount}`);

  // 3. Transform records
  const transformed = records.map((rec) => {
    const row = { ...rec };

    // Remove unwanted fields
    for (const f of REMOVE_FIELDS) {
      delete row[f];
    }

    // Set empresa_id
    if (!row.empresa_id || !UUID_RE.test(row.empresa_id)) {
      row.empresa_id = SGA_EMPRESA_ID;
    }

    // Set updated_by
    row.updated_by = 'importacao_base44';

    return row;
  });

  console.log(`Transformed ${transformed.length} records`);
  console.log('Sample record keys:', Object.keys(transformed[0]).join(', '));

  // 4. Insert in batches with ignoreDuplicates (onConflict skips duplicates)
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails = [];

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(transformed.length / BATCH_SIZE);

    const { data, error, count } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: 'created_date,created_by', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`Batch ${batchNum}/${totalBatches} ERROR: ${error.message}`);
      errors += batch.length;
      errorDetails.push({ batch: batchNum, error: error.message, hint: error.hint || '' });
    } else {
      const insertedCount = data ? data.length : 0;
      const skippedCount = batch.length - insertedCount;
      inserted += insertedCount;
      skipped += skippedCount;
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(`Batch ${batchNum}/${totalBatches}: +${insertedCount} inserted, ${skippedCount} skipped`);
      }
    }
  }

  // 5. Final count
  const { count: finalCount } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true });

  console.log('\n=== IMPORT SUMMARY ===');
  console.log(`Source records:    ${records.length}`);
  console.log(`Before import:     ${existingCount}`);
  console.log(`Inserted:          ${inserted}`);
  console.log(`Skipped (dupes):   ${skipped}`);
  console.log(`Errors:            ${errors}`);
  console.log(`After import:      ${finalCount}`);
  console.log(`Net new:           ${finalCount - existingCount}`);

  if (errorDetails.length > 0) {
    console.log('\nError details:');
    for (const e of errorDetails) {
      console.log(`  Batch ${e.batch}: ${e.error} ${e.hint}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
