#!/usr/bin/env node

/**
 * Test script to send PDF to /analyze-statements-pdf/ endpoint
 *
 * USAGE:
 * node test_pdf_upload.js /path/to/statement.pdf "HDFC Bank" "01-01-2024" "31-12-2024"
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const BASE_URL = 'http://127.0.0.1:7500';
const ENDPOINT = '/analyze-statements-pdf/';

// Parse command line arguments
const [, , pdfPath, bankName = 'HDFC Bank', startDate = '01-01-2024', endDate = '31-12-2024', password = '', caseId = 'TEST_CASE'] = process.argv;

if (!pdfPath) {
  console.error('❌ Error: Please provide a PDF path');
  console.log('\nUsage: node test_pdf_upload.js <pdf_path> [bank_name] [start_date] [end_date] [password] [case_id]');
  console.log('Example: node test_pdf_upload.js ./statement.pdf "HDFC Bank" "01-01-2024" "31-12-2024"');
  process.exit(1);
}

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ Error: PDF file not found at ${pdfPath}`);
  process.exit(1);
}

// Sample category master data (required by backend)
const categoryMasterData = [
  {
    id: 1,
    Category: 'Salary',
    Description: 'Monthly salary and wages',
    Particulars: 'Income',
    Preferences: 1,
    debit_credit: 'Credit'
  },
  {
    id: 2,
    Category: 'Rent',
    Description: 'Rent payment',
    Particulars: 'Expenses',
    Preferences: 1,
    debit_credit: 'Debit'
  },
  {
    id: 3,
    Category: 'Utilities',
    Description: 'Electricity, water, gas',
    Particulars: 'Expenses',
    Preferences: 2,
    debit_credit: 'Debit'
  },
  {
    id: 4,
    Category: 'Food & Dining',
    Description: 'Groceries and restaurant',
    Particulars: 'Expenses',
    Preferences: 2,
    debit_credit: 'Debit'
  },
  {
    id: 5,
    Category: 'Transfer',
    Description: 'Bank transfers',
    Particulars: 'Contra',
    Preferences: 3,
    debit_credit: 'Both'
  }
];

async function sendPDFToAnalyze() {
  console.log('\n🚀 Starting PDF Analysis...');
  console.log('━'.repeat(60));
  console.log(`📄 PDF File: ${pdfPath}`);
  console.log(`🏦 Bank Name: ${bankName}`);
  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log(`🔑 Case ID: ${caseId}`);
  console.log(`🔒 Password: ${password ? '***' : '(none)'}`);
  console.log('━'.repeat(60));

  try {
    // Create FormData instance
    const form = new FormData();

    // Append the PDF file
    form.append('files', fs.createReadStream(pdfPath), {
      filename: path.basename(pdfPath),
      contentType: 'application/pdf'
    });

    // Append form fields
    form.append('bank_names', bankName);
    form.append('passwords', password);
    form.append('start_date', startDate);
    form.append('end_date', endDate);
    form.append('ca_id', caseId);
    form.append('is_ocr', 'false');

    // Append category master data as JSON string
    form.append('categoryMasterData', JSON.stringify(categoryMasterData));

    console.log('\n📤 Sending request to:', BASE_URL + ENDPOINT);
    console.log('⏳ Processing... (this may take 30-120 seconds)\n');

    const startTime = Date.now();

    // Send POST request
    const response = await axios.post(BASE_URL + ENDPOINT, form, {
      headers: {
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000, // 5 minutes timeout
      validateStatus: (status) => status === 200
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Response received!\n');
    console.log('━'.repeat(60));
    console.log('📊 RESPONSE SUMMARY');
    console.log('━'.repeat(60));

    const data = response.data;

    // Display status
    console.log(`\n🔹 Status: ${data.status}`);
    console.log(`🔹 Message: ${data.message}`);
    console.log(`🔹 Request Duration: ${duration}s`);

    if (data.status === 'success') {
      console.log('\n✅ SUCCESS - Analysis completed!\n');

      // Processing times
      if (data.processing_times) {
        console.log('⏱️  Processing Times:');
        console.log(`   - NER Processing: ${data.processing_times.ner_processing?.toFixed(2)}s`);
        console.log(`   - Extraction: ${data.processing_times.extraction?.toFixed(2)}s`);
        console.log(`   - Total: ${data.processing_times.total?.toFixed(2)}s`);
      }

      // NER Results
      if (data.ner_results) {
        console.log('\n👤 Extracted Information:');
        console.log(`   - Account Holder: ${data.ner_results.Name?.[0] || 'Not found'}`);
        console.log(`   - Account Number: ${data.ner_results['Acc Number']?.[0] || 'Not found'}`);
      }

      // Success page number
      if (data.success_page_number) {
        console.log(`\n📄 Pages Processed: ${data.success_page_number}`);
      }

      // Parse the data JSON
      let parsedData;
      try {
        parsedData = JSON.parse(data.data);

        console.log('\n📈 Summary Statement:');
        if (parsedData.Transactions) {
          console.log(`   - Total Transactions: ${parsedData.Transactions.length}`);
        }
        if (parsedData.EOD) {
          console.log(`   - EOD Entries: ${parsedData.EOD.length}`);
        }
        if (parsedData.Particulars) {
          console.log(`   - Categories: ${parsedData.Particulars.length}`);
        }
        if (parsedData['Income Receipts']) {
          console.log(`   - Income Categories: ${parsedData['Income Receipts'].length}`);
        }
        if (parsedData['Important Expenses']) {
          console.log(`   - Important Expenses: ${parsedData['Important Expenses'].length}`);
        }
        if (parsedData['Other Expenses']) {
          console.log(`   - Other Expenses: ${parsedData['Other Expenses'].length}`);
        }
        if (parsedData['Opportunity to Earn']) {
          console.log(`   - Opportunities to Earn: ${parsedData['Opportunity to Earn'].length}`);
        }

        // Sample transactions
        if (parsedData.Transactions && parsedData.Transactions.length > 0) {
          console.log('\n💰 Sample Transactions (first 3):');
          parsedData.Transactions.slice(0, 3).forEach((txn, idx) => {
            console.log(`\n   ${idx + 1}. Date: ${txn['Value Date']}`);
            console.log(`      Description: ${txn.Description}`);
            console.log(`      Amount: ${txn.Debit > 0 ? `₹${txn.Debit} (Debit)` : `₹${txn.Credit} (Credit)`}`);
            console.log(`      Category: ${txn.Category}`);
            console.log(`      Balance: ₹${txn.Balance}`);
          });
        }

      } catch (err) {
        console.log('\n⚠️  Could not parse detailed data:', err.message);
      }

      // Missing months
      if (data.missing_months_list && data.missing_months_list.length > 0) {
        console.log('\n⚠️  Missing Months Detected:');
        data.missing_months_list.forEach(missing => {
          console.log(`   - ${missing}`);
        });
      }

      // Failed extractions
      if (data.pdf_paths_not_extracted && data.pdf_paths_not_extracted.paths?.length > 0) {
        console.log('\n❌ Some pages failed to extract:');
        data.pdf_paths_not_extracted.paths.forEach((failedPath, idx) => {
          console.log(`   ${idx + 1}. ${failedPath}`);
          if (data.pdf_paths_not_extracted.respective_reasons_for_error?.[idx]) {
            console.log(`      Reason: ${data.pdf_paths_not_extracted.respective_reasons_for_error[idx]}`);
          }
        });
      }

      // Save full response to file
      const outputFile = `response_${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
      console.log(`\n💾 Full response saved to: ${outputFile}`);

    } else {
      console.log('\n❌ FAILED - Analysis unsuccessful\n');
      console.log('Error Details:', data.message || 'Unknown error');

      if (data.pdf_paths_not_extracted) {
        console.log('\nFailed PDF Paths:', data.pdf_paths_not_extracted);
      }
    }

    console.log('\n' + '━'.repeat(60));
    console.log('✅ Script completed successfully');
    console.log('━'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR OCCURRED:\n');

    if (error.response) {
      // Server responded with error
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.error('No response received from server');
      console.error('Make sure the FastAPI server is running on', BASE_URL);
      console.error('\nTo start the server, run:');
      console.error('  cd backend');
      console.error('  uvicorn main:app --reload --port 7500');
    } else {
      // Other errors
      console.error('Error:', error.message);
    }

    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Check if server is running first
async function checkServerHealth() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    return true;
  } catch (err) {
    return false;
  }
}

// Main execution
(async () => {
  console.log('🔍 Checking if FastAPI server is running...');
  const isRunning = await checkServerHealth();

  if (!isRunning) {
    console.error('\n❌ FastAPI server is not running on', BASE_URL);
    console.error('\n📝 To start the server, run:');
    console.error('   cd backend');
    console.error('   uvicorn main:app --reload --port 7500');
    console.error('\nOr from frontend:');
    console.error('   npm run start:fastapi\n');
    process.exit(1);
  }

  console.log('✅ Server is running!\n');
  await sendPDFToAnalyze();
})();
