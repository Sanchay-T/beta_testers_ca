/**
 * Native fetch API example (Node.js 18+)
 * No external dependencies required
 *
 * USAGE: node fetch_pdf_test.js ./statement.pdf
 */

const fs = require('fs');
const path = require('path');

async function analyzePDFWithFetch(pdfPath) {
  // Read PDF file
  const fileBuffer = fs.readFileSync(pdfPath);
  const fileName = path.basename(pdfPath);

  // Create multipart boundary
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  // Build multipart form data manually
  const formParts = [];

  // Add PDF file
  formParts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n` +
    `Content-Type: application/pdf\r\n\r\n`
  );
  formParts.push(fileBuffer);
  formParts.push('\r\n');

  // Add form fields
  const fields = {
    bank_names: 'HDFC Bank',
    passwords: '',
    start_date: '01-01-2024',
    end_date: '31-12-2024',
    ca_id: 'TEST_CASE',
    is_ocr: 'false',
    categoryMasterData: JSON.stringify([
      {
        id: 1,
        Category: 'Salary',
        Description: 'Salary',
        Particulars: 'Income',
        Preferences: 1,
        debit_credit: 'Credit'
      }
    ])
  };

  for (const [key, value] of Object.entries(fields)) {
    formParts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  // End boundary
  formParts.push(`--${boundary}--\r\n`);

  // Combine all parts
  const bodyParts = [];
  for (const part of formParts) {
    if (typeof part === 'string') {
      bodyParts.push(Buffer.from(part, 'utf-8'));
    } else {
      bodyParts.push(part);
    }
  }
  const body = Buffer.concat(bodyParts);

  // Send request
  const response = await fetch('http://127.0.0.1:7500/analyze-statements-pdf/', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Run
const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error('Usage: node fetch_pdf_test.js <path-to-pdf>');
  console.error('Example: node fetch_pdf_test.js ./statement.pdf');
  process.exit(1);
}

console.log('📤 Sending PDF to FastAPI...');

analyzePDFWithFetch(pdfPath)
  .then(result => {
    console.log('✅ Status:', result.status);

    if (result.status === 'success') {
      const data = JSON.parse(result.data);
      console.log('📊 Transactions:', data.Transactions?.length);
      console.log('📊 EOD Entries:', data.EOD?.length);
      console.log('📊 Summary Categories:', data.Particulars?.length);

      fs.writeFileSync('fetch_result.json', JSON.stringify(result, null, 2));
      console.log('💾 Saved to fetch_result.json');
    } else {
      console.error('❌ Failed:', result.message);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  });
