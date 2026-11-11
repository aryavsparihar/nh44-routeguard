require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const results = [];
const csvFilePath = 'data/incidents.csv';

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Wait/Filter option: Uncomment the next line if you ever want to insert ONLY authentic (flag === 1) rows
    // if (parseInt(row.flag, 10) === 0) return;

    results.push({
      date: row.date,
      zone_id: parseInt(row.zone_id, 10),
      place: row.place,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      hazard_type: row.hazard_type.trim().toLowerCase(),
      hours_closed: parseFloat(row.hours_closed),
      trucks_stranded: parseInt(row.trucks_stranded, 10),
      source_url: row.source_url
    });
  })
  .on('end', async () => {
    console.log(`Parsed ${results.length} records from ${csvFilePath}. Inserting into Supabase...`);

    const { error } = await supabase
      .from('incidents')
      .insert(results);

    if (error) {
      console.error('Supabase insert error:', error.message);
    } else {
      console.log('Successfully seeded all records into public.incidents.');
    }
  })
  .on('error', (err) => {
    console.error('Error reading CSV file:', err.message);
  });
