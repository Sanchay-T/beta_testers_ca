/**
 * Minimal example - Send PDF to FastAPI for analysis
 *
 * USAGE: node simple_pdf_test.js ./your-statement.pdf
 */

const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function analyzePDF(pdfPath) {
  // Create form data
  const form = new FormData();

  // Attach PDF file
  form.append('files', fs.createReadStream(pdfPath), {
    filename: 'statement.pdf',
    contentType: 'application/pdf'
  });

  // Basic parameters
  form.append('bank_names', 'HDFC Bank');
  form.append('passwords', '');
  form.append('start_date', '01-01-2024');
  form.append('end_date', '31-12-2024');
  form.append('ca_id', 'TEST_CASE');
  form.append('is_ocr', 'false');

  // Minimal category data (required)
  form.append('categoryMasterData', JSON.stringify([
    {
      id: 1,
      Category: 'Salary',
      Description: 'Salary',
      Particulars: 'Income',
      Preferences: 1,
      debit_credit: 'Credit'
    }
  ]));

  // Send request
  const response = await axios.post(
    'http://127.0.0.1:7500/analyze-statements-pdf/',
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 300000
    }
  );

  return response.data;
}

// Run
const pdfPath = process.argv[2] || './statement.pdf';

if (!fs.existsSync(pdfPath)) {
  console.error('PDF not found:', pdfPath);
  process.exit(1);
}

console.log('Analyzing PDF:', pdfPath);

analyzePDF(pdfPath)
  .then(result => {
    console.log('\n✅ Success!');
    console.log('Status:', result.status);

    // Parse the main data
    const data = JSON.parse(result.data);
    console.log('Transactions:', data.Transactions?.length);
    console.log('EOD Entries:', data.EOD?.length);
    console.log('Categories:', data.Particulars?.length);

    // Save full response
    fs.writeFileSync('result.json', JSON.stringify(result, null, 2));
    console.log('\n💾 Full response saved to result.json');
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  });
