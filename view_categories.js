#!/usr/bin/env node

/**
 * View categories from the database
 * Useful to see what category data will be sent to the API
 *
 * USAGE: node view_categories.js
 */

const fs = require('fs');
const path = require('path');
const { drizzle } = require('drizzle-orm/libsql');
const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

// Database path
const DB_PATH = path.resolve(__dirname, 'frontend', 'db.sqlite3');

// Category_Master schema
const Category_Master = sqliteTable('Category_Master', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  debit_credit: text('debit_credit').notNull(),
  category: text('category').notNull(),
  particulars: text('particulars').notNull(),
  preferences: text('preferences'),
});

async function viewCategories() {
  console.log('📊 Category Master Data Viewer\n');
  console.log('━'.repeat(80));

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found at: ${DB_PATH}`);
    console.error('\nPlease ensure the Electron app has been initialized first.');
    process.exit(1);
  }

  console.log(`📁 Database: ${DB_PATH}\n`);

  try {
    // Connect to database
    const dbUrl = `file:${DB_PATH}`;
    const db = drizzle(dbUrl);

    // Fetch all categories
    const categories = await db.select().from(Category_Master);

    console.log(`✅ Found ${categories.length} categories\n`);
    console.log('━'.repeat(80));

    // Group by particulars
    const byParticulars = {};
    categories.forEach(cat => {
      if (!byParticulars[cat.particulars]) {
        byParticulars[cat.particulars] = [];
      }
      byParticulars[cat.particulars].push(cat);
    });

    // Display grouped
    Object.keys(byParticulars).sort().forEach(particular => {
      console.log(`\n📋 ${particular.toUpperCase()}`);
      console.log('─'.repeat(80));

      byParticulars[particular].forEach(cat => {
        console.log(`   ${cat.id.toString().padStart(3)}. ${cat.category.padEnd(30)} | ${cat.debit_credit.padEnd(10)} | Pref: ${cat.preferences || 'N/A'}`);
        console.log(`        ${cat.description}`);
      });
    });

    // Display transformation format (as sent to API)
    console.log('\n\n🔧 TRANSFORMED FORMAT (as sent to FastAPI)');
    console.log('━'.repeat(80));

    const transformed = categories.map((item) => ({
      id: item.id,
      Category: item.category,
      Description: item.description,
      Particulars: item.particulars,
      Preferences: item.preferences,
      debit_credit: item.debit_credit,
    }));

    console.log(JSON.stringify(transformed.slice(0, 3), null, 2));
    console.log(`\n... (${categories.length} total categories)\n`);

    // Save to file
    const outputFile = 'category_master_data.json';
    fs.writeFileSync(outputFile, JSON.stringify(transformed, null, 2));
    console.log(`💾 Full category data saved to: ${outputFile}\n`);

    // Statistics
    console.log('📊 STATISTICS');
    console.log('━'.repeat(80));
    console.log(`Total Categories: ${categories.length}`);
    console.log(`Income (Credit): ${categories.filter(c => c.debit_credit.toLowerCase().includes('credit')).length}`);
    console.log(`Expenses (Debit): ${categories.filter(c => c.debit_credit.toLowerCase().includes('debit')).length}`);
    console.log(`Contra (Both): ${categories.filter(c => c.debit_credit.toLowerCase().includes('both')).length}`);
    console.log('\nBy Particulars:');
    Object.keys(byParticulars).forEach(particular => {
      console.log(`   - ${particular}: ${byParticulars[particular].length} categories`);
    });

    console.log('\n━'.repeat(80));
    console.log('✅ Done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
viewCategories();
