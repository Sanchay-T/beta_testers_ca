#!/usr/bin/env node

/**
 * Send PDF to FastAPI with dynamic category data from database
 * Simple, clean implementation using the helper module
 *
 * USAGE:
 * node test_pdf_dynamic.js ./statement.pdf "HDFC Bank"
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { fetchCategoryMasterData } = require('./helpers/dbCategoryFetcher');

// Configuration
const BASE_URL = 'http://127.0.0.1:7500';

async function analyzePDF(pdfPath, bankName = 'HDFC Bank', options = {}) {
  const {
    startDate = '01-01-2024',
    endDate = '31-12-2024',
    password = '',
    caseId = 'TEST_CASE',
    isOcr = false
  } = options;

  console.log('🔄 Step 1: Fetching category data from database...');

  // Fetch category data from database (same as Electron app)
  const categoryMasterData = await fetchCategoryMasterData();

  console.log(`✅ Loaded ${categoryMasterData.length} categories from database\n`);

  console.log('🔄 Step 2: Constructing payload...');

  // Create form data
  const form = new FormData();

  // Attach PDF file
  form.append('files', fs.createReadStream(pdfPath), {
    filename: path.basename(pdfPath),
    contentType: 'application/pdf'
  });

  // Basic parameters
  form.append('bank_names', bankName);
  form.append('passwords', password);
  form.append('start_date', startDate);
  form.append('end_date', endDate);
  form.append('ca_id', caseId);
  form.append('is_ocr', String(isOcr));

  // Category data from database (this is the key part!)
  form.append('categoryMasterData', JSON.stringify(categoryMasterData));

  console.log('✅ Payload constructed\n');

  console.log('🔄 Step 3: Sending to FastAPI...');
  console.log(`   URL: ${BASE_URL}/analyze-statements-pdf/`);
  console.log(`   PDF: ${path.basename(pdfPath)}`);
  console.log(`   Bank: ${bankName}\n`);

  // Send request
  const startTime = Date.now();

  const response = await axios.post(
    `${BASE_URL}/analyze-statements-pdf/`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000
    }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Response received in ${duration}s\n`);

  return response.data;
}

// Main execution
(async () => {
  const pdfPath = process.argv[2];
  const bankName = process.argv[3] || 'HDFC Bank';

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Usage: node test_pdf_dynamic.js <pdf_path> [bank_name]');
    console.error('   Example: node test_pdf_dynamic.js ./statement.pdf "HDFC Bank"');
    process.exit(1);
  }

  console.log('📊 PDF Analysis with Dynamic Category Data\n');
  console.log('━'.repeat(60));

  try {
    const result = await analyzePDF(pdfPath, bankName);

    // Display results
    console.log('━'.repeat(60));
    console.log('📋 RESULTS\n');

    console.log(`Status: ${result.status}`);

    if (result.status === 'success') {
      const data = JSON.parse(result.data);

      console.log(`✅ Success!\n`);
      console.log('Summary:');
      console.log(`  - Transactions: ${data.Transactions?.length || 0}`);
      console.log(`  - EOD Entries: ${data.EOD?.length || 0}`);
      console.log(`  - Categories Used: ${data.Particulars?.length || 0}`);
      console.log(`  - Income Categories: ${data['Income Receipts']?.length || 0}`);
      console.log(`  - Important Expenses: ${data['Important Expenses']?.length || 0}`);
      console.log(`  - Other Expenses: ${data['Other Expenses']?.length || 0}`);

      // Show processing times
      if (result.processing_times) {
        console.log(`\nProcessing Times:`);
        console.log(`  - Extraction: ${result.processing_times.extraction?.toFixed(2)}s`);
        console.log(`  - Total: ${result.processing_times.total?.toFixed(2)}s`);
      }

      // Show sample categories used
      if (data.Transactions?.length > 0) {
        const categoryCounts = {};
        data.Transactions.forEach(t => {
          categoryCounts[t.Category] = (categoryCounts[t.Category] || 0) + 1;
        });

        const topCategories = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        console.log(`\nTop 5 Categories in Transactions:`);
        topCategories.forEach(([cat, count]) => {
          console.log(`  - ${cat}: ${count} transactions`);
        });
      }

      // Save response
      const outputFile = `response_${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`\n💾 Full response saved to: ${outputFile}`);

    } else {
      console.log(`❌ Failed: ${result.message}`);
    }

    console.log('\n━'.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.response) {
      console.error('Server response:', error.response.status);
      if (error.response.data) {
        console.error('Details:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure FastAPI server is running:');
      console.error('  cd backend && uvicorn main:app --reload --port 7500');
    }

    process.exit(1);
  }
})();
