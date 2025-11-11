# Dynamic Category Data from Database

Guide for fetching category master data from the database and using it to construct API payloads dynamically.

## Overview

The Electron app fetches category master data from the SQLite database (`frontend/db.sqlite3`) before sending PDFs to the FastAPI backend. This ensures that the latest category definitions are always used for transaction categorization.

**Key Files in Electron App**:
- `frontend/ipc/generateReport.js:933-944` - Fetches and transforms category data
- `frontend/db/schema/Category_Master.js` - Database schema definition

## Quick Start

### 1. **View Categories in Database**

```bash
node view_categories.js
```

This will:
- ✅ Show all categories grouped by Particulars (Income/Expenses/Contra)
- ✅ Display transformation format (as sent to API)
- ✅ Save full category data to `category_master_data.json`
- ✅ Show statistics (counts by type)

**Example Output**:
```
📊 Category Master Data Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Database: C:\Users\sanch\Desktop\beta_testers_ca\frontend\db.sqlite3

✅ Found 45 categories
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 INCOME
────────────────────────────────────────────────────────────────────────────────
     1. Salary                         | Credit     | Pref: 1
        Monthly salary and wages
     2. Interest Income                | Credit     | Pref: 2
        Interest earned on deposits
```

### 2. **Test PDF Upload with Dynamic Categories** (Simple)

```bash
node test_pdf_dynamic.js ./statement.pdf "HDFC Bank"
```

Clean, minimal script that:
- ✅ Fetches categories from database
- ✅ Constructs payload dynamically
- ✅ Sends to FastAPI
- ✅ Displays summary results

**Example Output**:
```
📊 PDF Analysis with Dynamic Category Data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Step 1: Fetching category data from database...
✅ Loaded 45 categories from database

🔄 Step 2: Constructing payload...
✅ Payload constructed

🔄 Step 3: Sending to FastAPI...
   URL: http://127.0.0.1:7500/analyze-statements-pdf/
   PDF: statement.pdf
   Bank: HDFC Bank

✅ Response received in 42.3s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 RESULTS

Status: success
✅ Success!

Summary:
  - Transactions: 245
  - EOD Entries: 31
  - Categories Used: 12
  - Income Categories: 3
  - Important Expenses: 8
  - Other Expenses: 15

Top 5 Categories in Transactions:
  - Salary: 2 transactions
  - Rent: 1 transactions
  - Food & Dining: 45 transactions
  - Utilities: 12 transactions
  - Transport: 38 transactions

💾 Full response saved to: response_1234567890.json
```

### 3. **Full Featured Test** (Detailed)

```bash
node test_pdf_with_db.js ./statement.pdf "HDFC Bank" "01-01-2024" "31-12-2024"
```

Comprehensive script with:
- ✅ Server health check
- ✅ Database connection with error handling
- ✅ Detailed progress logging
- ✅ Sample transaction display
- ✅ Category usage analysis
- ✅ Processing time breakdown

## Database Schema

### Category_Master Table

**Location**: `frontend/db/schema/Category_Master.js`

**Schema**:
```javascript
{
  id: integer PRIMARY KEY AUTOINCREMENT,
  description: text NOT NULL,
  debit_credit: text NOT NULL,  // "Credit", "Debit", or "Both"
  category: text NOT NULL,
  particulars: text NOT NULL,   // "Income", "Expenses", or "Contra"
  preferences: text
}
```

**Example Row**:
```json
{
  "id": 1,
  "description": "Monthly salary and wages",
  "debit_credit": "Credit",
  "category": "Salary",
  "particulars": "Income",
  "preferences": "1"
}
```

## How It Works (Code Flow)

### 1. **Database Connection**

```javascript
const { drizzle } = require('drizzle-orm/libsql');
const DB_PATH = path.resolve(__dirname, 'frontend', 'db.sqlite3');

const dbUrl = `file:${DB_PATH}`;
const db = drizzle(dbUrl);
```

### 2. **Fetch Categories** (from `generateReport.js:933`)

```javascript
const { Category_Master } = require('./db/schema/Category_Master');

// Fetch all categories
const categoryMasterData = await db.select().from(Category_Master);
```

### 3. **Transform to API Format** (from `generateReport.js:935-943`)

```javascript
const transformedCategoryMasterData = categoryMasterData.map((item) => ({
  id: item.id,
  Category: item.category,           // ← Note: Capitalized
  Description: item.description,     // ← Note: Capitalized
  Particulars: item.particulars,     // ← Note: Capitalized
  Preferences: item.preferences,     // ← Note: Capitalized
  debit_credit: item.debit_credit,   // ← Note: lowercase with underscore
}));
```

**Why Transform?**
- Database uses lowercase snake_case: `category`, `description`, `debit_credit`
- FastAPI expects PascalCase for most fields: `Category`, `Description`, `Particulars`
- This matches the exact transformation in `generateReport.js`

### 4. **Attach to Payload** (from `generateReport.js:956`)

```javascript
form.append('categoryMasterData', JSON.stringify(transformedCategoryMasterData));
```

### 5. **Send to FastAPI**

```javascript
const response = await axios.post(
  'http://127.0.0.1:7500/analyze-statements-pdf/',
  form,
  {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    timeout: 300000
  }
);
```

## Reusable Helper Module

**Location**: `helpers/dbCategoryFetcher.js`

Use this module in your own scripts:

```javascript
const { fetchCategoryMasterData } = require('./helpers/dbCategoryFetcher');

// Fetch categories
const categoryData = await fetchCategoryMasterData();

// Use in payload
form.append('categoryMasterData', JSON.stringify(categoryData));
```

**Available Functions**:

| Function | Description |
|----------|-------------|
| `connectToDatabase(dbPath)` | Connect to SQLite database |
| `fetchCategoryMasterData(db, dbPath)` | Fetch and transform categories |
| `getCategoryDataJSON(dbPath)` | Get categories as JSON string |
| `validateCategoryData(data)` | Validate category data structure |
| `getDefaultCategoryData()` | Get fallback sample categories |

## Category Data Format

### Raw Database Format

```json
{
  "id": 1,
  "description": "Monthly salary and wages",
  "debit_credit": "Credit",
  "category": "Salary",
  "particulars": "Income",
  "preferences": "1"
}
```

### Transformed API Format

```json
{
  "id": 1,
  "Category": "Salary",
  "Description": "Monthly salary and wages",
  "Particulars": "Income",
  "Preferences": "1",
  "debit_credit": "Credit"
}
```

**Key Differences**:
- Field names capitalized (except `debit_credit`)
- Field order rearranged
- Same data, different structure

## Complete Payload Structure

```javascript
// Multipart form data
{
  files: <PDF file stream>,
  bank_names: "HDFC Bank",
  passwords: "",
  start_date: "01-01-2024",
  end_date: "31-12-2024",
  ca_id: "TEST_CASE",
  is_ocr: "false",
  categoryMasterData: "[{...45 categories from database...}]"  // ← Dynamic from DB
}
```

## Database Location

**Development**: `frontend/db.sqlite3`
**Production**: `%APPDATA%/CypherEdge/db.sqlite3` (or similar)

## Troubleshooting

### Database Not Found
```
❌ Database not found at: C:\Users\sanch\Desktop\beta_testers_ca\frontend\db.sqlite3
```

**Solution**: Ensure the Electron app has been run at least once to initialize the database.

### No Categories Found
```
✅ Found 0 categories
```

**Solution**: The database exists but is empty. Run the app and add categories through the UI, or seed the database.

### Wrong Category Format
```
Error: Category missing required field: Category
```

**Solution**: Make sure you're using the transformed format (capitalized field names), not the raw database format.

## Example: Custom Script

```javascript
const { fetchCategoryMasterData } = require('./helpers/dbCategoryFetcher');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function myCustomAnalysis(pdfPath) {
  // Step 1: Get categories from database
  const categories = await fetchCategoryMasterData();
  console.log(`Loaded ${categories.length} categories`);

  // Step 2: Build payload
  const form = new FormData();
  form.append('files', fs.createReadStream(pdfPath));
  form.append('bank_names', 'My Bank');
  form.append('ca_id', 'MY_CASE');
  form.append('is_ocr', 'false');
  form.append('categoryMasterData', JSON.stringify(categories)); // ← Dynamic!

  // Step 3: Send
  const response = await axios.post(
    'http://127.0.0.1:7500/analyze-statements-pdf/',
    form,
    { headers: form.getHeaders() }
  );

  return response.data;
}

// Use it
myCustomAnalysis('./statement.pdf')
  .then(result => console.log('Success:', result.status))
  .catch(err => console.error('Error:', err.message));
```

## Summary

**Key Points**:
1. ✅ Category data is stored in `frontend/db.sqlite3` → `Category_Master` table
2. ✅ Fetch using Drizzle ORM: `db.select().from(Category_Master)`
3. ✅ Transform field names: `category` → `Category`, etc.
4. ✅ Send as JSON string in `categoryMasterData` form field
5. ✅ FastAPI uses this data to categorize transactions

**Scripts**:
- `view_categories.js` - View what's in the database
- `test_pdf_dynamic.js` - Simple test with dynamic categories
- `test_pdf_with_db.js` - Full featured test with detailed output
- `helpers/dbCategoryFetcher.js` - Reusable module for your scripts

All scripts mirror the exact behavior of the Electron app's `generateReport.js`!
