# PDF Analysis API Test Scripts

Scripts to test the FastAPI `/analyze-statements-pdf/` endpoint that processes bank statement PDFs and returns summary statements.

## Prerequisites

1. **FastAPI Server Running**:
   ```bash
   cd backend
   uvicorn main:app --reload --port 7500
   ```
   Or from frontend: `npm run start:fastapi`

2. **Install Node.js Dependencies** (for axios-based scripts):
   ```bash
   npm install axios form-data
   ```

## Test Scripts

### 1. **Full Featured Script** (`test_pdf_upload.js`)

Complete script with detailed output, health checks, and error handling.

```bash
# Usage
node test_pdf_upload.js <pdf_path> [bank_name] [start_date] [end_date] [password] [case_id]

# Example
node test_pdf_upload.js ./statement.pdf "HDFC Bank" "01-01-2024" "31-12-2024"
```

**Features**:
- ✅ Server health check before sending
- ✅ Detailed progress logging
- ✅ Transaction samples display
- ✅ Processing time breakdown
- ✅ Saves full response to JSON file
- ✅ Error handling with helpful messages

### 2. **Simple Script** (`simple_pdf_test.js`)

Minimal implementation showing core payload construction.

```bash
# Usage
node simple_pdf_test.js ./statement.pdf
```

**Features**:
- ✅ Clean, minimal code
- ✅ Basic success/error handling
- ✅ Saves result to `result.json`

### 3. **Native Fetch API** (`fetch_pdf_test.js`)

Uses Node.js 18+ native fetch (no external dependencies).

```bash
# Usage (requires Node.js 18+)
node fetch_pdf_test.js ./statement.pdf
```

**Features**:
- ✅ No external dependencies
- ✅ Manual multipart form construction
- ✅ Modern fetch API

### 4. **PowerShell Script** (`test_pdf_endpoint.ps1`)

For Windows users who prefer PowerShell.

```powershell
# Usage
.\test_pdf_endpoint.ps1 -PdfPath "C:\path\to\statement.pdf"

# With all parameters
.\test_pdf_endpoint.ps1 -PdfPath "C:\statement.pdf" -BankName "ICICI Bank" -StartDate "01-01-2024" -EndDate "31-12-2024"
```

### 5. **Bash Script** (`test_pdf_endpoint.sh`)

For Linux/Mac users.

```bash
# Usage
bash test_pdf_endpoint.sh /path/to/statement.pdf
```

## API Endpoint Details

### **Endpoint**: `POST /analyze-statements-pdf/`

**URL**: `http://127.0.0.1:7500/analyze-statements-pdf/`

### Request Payload (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File | ✅ Yes | PDF file(s) to analyze |
| `bank_names` | String | ✅ Yes | Bank name (e.g., "HDFC Bank") |
| `passwords` | String | ❌ No | PDF password (if protected) |
| `start_date` | String | ❌ No | Start date (dd-mm-yyyy) |
| `end_date` | String | ❌ No | End date (dd-mm-yyyy) |
| `ca_id` | String | ✅ Yes | Case/Client ID |
| `is_ocr` | String | ✅ Yes | "true" or "false" |
| `categoryMasterData` | JSON String | ✅ Yes | Category definitions |

### Response Structure

```json
{
  "status": "success",
  "message": "Bank statements analyzed successfully",
  "data": "{JSON string containing analysis results}",
  "pdf_paths_not_extracted": {
    "paths": [],
    "bank_names": [],
    "respective_reasons_for_error": []
  },
  "ner_results": {
    "Name": ["Account Holder Name"],
    "Acc Number": ["XXXXXXXXXXX"]
  },
  "success_page_number": 15,
  "missing_months_list": [],
  "processing_times": {
    "ner_processing": 0.5,
    "extraction": 45.2,
    "total": 45.7
  }
}
```

### Parsed Data Structure (inside `data` field)

```json
{
  "Transactions": [
    {
      "Value Date": "01-01-2024",
      "Description": "Salary Credit",
      "Debit": 0,
      "Credit": 50000,
      "Balance": 50000,
      "Category": "Salary",
      "Bank": "HDFC Bank",
      "Entity": "Employer Ltd",
      "Voucher type": "Receipt"
    }
  ],
  "EOD": [
    { "Day": 1, "Jan-24": 50000, "Feb-24": 55000 }
  ],
  "Particulars": ["Salary", "Rent", "Utilities"],
  "Income Receipts": [
    { "Category": "Salary", "Amount": 50000 }
  ],
  "Important Expenses": [
    { "Category": "Rent", "Amount": 15000 }
  ],
  "Other Expenses": [
    { "Category": "Utilities", "Amount": 2000 }
  ],
  "Contra Debit": [],
  "Contra Credit": [],
  "Opportunity to Earn": [
    { "Product": "Home Loan", "Amount": 5000000 }
  ]
}
```

## Example Category Master Data

Minimum required structure:

```json
[
  {
    "id": 1,
    "Category": "Salary",
    "Description": "Monthly salary and wages",
    "Particulars": "Income",
    "Preferences": 1,
    "debit_credit": "Credit"
  },
  {
    "id": 2,
    "Category": "Rent",
    "Description": "Rent payment",
    "Particulars": "Expenses",
    "Preferences": 1,
    "debit_credit": "Debit"
  }
]
```

## Troubleshooting

### Server Not Running
```
❌ FastAPI server is not running on http://127.0.0.1:7500
```

**Solution**:
```bash
cd backend
uvicorn main:app --reload --port 7500
```

### File Not Found
```
❌ PDF file not found at ./statement.pdf
```

**Solution**: Provide correct absolute or relative path to PDF file.

### Module Not Found (axios/form-data)
```
Error: Cannot find module 'axios'
```

**Solution**:
```bash
npm install axios form-data
```

### Timeout Error
```
Error: timeout of 300000ms exceeded
```

**Solution**: Large PDFs take time to process. This is normal for 100+ page statements.

## Integration with Electron App

The Electron app uses this endpoint at:
- **File**: `frontend/ipc/generateReport.js:779`
- **Handler**: `ipcMain.handle('generate-report', ...)`

The IPC handler constructs the same payload and sends it to the FastAPI backend.

## Processing Times

Typical processing times:
- **Small PDF** (1-10 pages): 5-15 seconds
- **Medium PDF** (10-50 pages): 15-60 seconds
- **Large PDF** (50-200 pages): 60-180 seconds

## Output Files

Scripts save responses to:
- `response_[timestamp].json` (full featured script)
- `result.json` (simple script)
- `fetch_result.json` (fetch script)

These contain the complete API response for analysis.

## Summary Statement Location

The summary statement data is in the response at:
- `response.data.data` (JSON string, needs parsing)

After parsing:
- `parsedData.Particulars` - Categories
- `parsedData["Income Receipts"]` - Income breakdown
- `parsedData["Important Expenses"]` - Major expenses
- `parsedData["Other Expenses"]` - Minor expenses
- `parsedData["Contra Debit"]` / `parsedData["Contra Credit"]` - Transfers
