/**
 * Database Category Fetcher Module
 * Reusable module to fetch category master data from the database
 * Mirrors the exact behavior of frontend/ipc/generateReport.js
 */

const fs = require('fs');
const path = require('path');
const { drizzle } = require('drizzle-orm/libsql');
const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

// Default database path
const DEFAULT_DB_PATH = path.resolve(__dirname, '..', 'frontend', 'db.sqlite3');

/**
 * Category_Master schema definition
 * Same as: frontend/db/schema/Category_Master.js
 */
const Category_Master = sqliteTable('Category_Master', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  debit_credit: text('debit_credit').notNull(),
  category: text('category').notNull(),
  particulars: text('particulars').notNull(),
  preferences: text('preferences'),
});

/**
 * Connect to the SQLite database
 * @param {string} dbPath - Path to the database file
 * @returns {object} Drizzle database instance
 */
function connectToDatabase(dbPath = DEFAULT_DB_PATH) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database not found at ${dbPath}. Please ensure the app has been initialized.`
    );
  }

  const dbUrl = `file:${dbPath}`;
  return drizzle(dbUrl);
}

/**
 * Fetch category master data from database
 * Mirrors: frontend/ipc/generateReport.js:933-944
 *
 * @param {object} db - Drizzle database instance (optional)
 * @param {string} dbPath - Path to database file (optional)
 * @returns {Promise<Array>} Transformed category master data
 */
async function fetchCategoryMasterData(db = null, dbPath = DEFAULT_DB_PATH) {
  // Connect if not already connected
  if (!db) {
    db = connectToDatabase(dbPath);
  }

  // Fetch all category data
  const categoryMasterData = await db.select().from(Category_Master);

  // Transform to required format (exactly as in generateReport.js:935-943)
  const transformedCategoryMasterData = categoryMasterData.map((item) => ({
    id: item.id,
    Category: item.category,
    Description: item.description,
    Particulars: item.particulars,
    Preferences: item.preferences,
    debit_credit: item.debit_credit,
  }));

  return transformedCategoryMasterData;
}

/**
 * Get category data as JSON string (ready for API)
 * @param {string} dbPath - Path to database file (optional)
 * @returns {Promise<string>} JSON string of category data
 */
async function getCategoryDataJSON(dbPath = DEFAULT_DB_PATH) {
  const categoryData = await fetchCategoryMasterData(null, dbPath);
  return JSON.stringify(categoryData);
}

/**
 * Validate category data structure
 * @param {Array} categoryData - Category data array
 * @returns {boolean} True if valid
 */
function validateCategoryData(categoryData) {
  if (!Array.isArray(categoryData) || categoryData.length === 0) {
    throw new Error('Category data must be a non-empty array');
  }

  const requiredFields = ['id', 'Category', 'Description', 'Particulars', 'debit_credit'];

  for (const category of categoryData) {
    for (const field of requiredFields) {
      if (!(field in category)) {
        throw new Error(`Category missing required field: ${field}`);
      }
    }
  }

  return true;
}

/**
 * Get default sample category data (fallback if DB not available)
 * @returns {Array} Sample category data
 */
function getDefaultCategoryData() {
  return [
    {
      id: 1,
      Category: 'Salary',
      Description: 'Monthly salary and wages',
      Particulars: 'Income',
      Preferences: '1',
      debit_credit: 'Credit'
    },
    {
      id: 2,
      Category: 'Rent',
      Description: 'Rent payment',
      Particulars: 'Expenses',
      Preferences: '1',
      debit_credit: 'Debit'
    },
    {
      id: 3,
      Category: 'Utilities',
      Description: 'Electricity, water, gas',
      Particulars: 'Expenses',
      Preferences: '2',
      debit_credit: 'Debit'
    },
    {
      id: 4,
      Category: 'Food & Dining',
      Description: 'Groceries and restaurant',
      Particulars: 'Expenses',
      Preferences: '2',
      debit_credit: 'Debit'
    },
    {
      id: 5,
      Category: 'Bank Transfer',
      Description: 'Inter-bank transfers',
      Particulars: 'Contra',
      Preferences: '3',
      debit_credit: 'Both'
    }
  ];
}

module.exports = {
  connectToDatabase,
  fetchCategoryMasterData,
  getCategoryDataJSON,
  validateCategoryData,
  getDefaultCategoryData,
  Category_Master,
  DEFAULT_DB_PATH
};
