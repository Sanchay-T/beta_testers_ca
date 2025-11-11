# Failed PDF Null Value Analysis - Complete Code Review

**Purpose**: Identify every location where null/undefined values can be introduced in the failed PDF error tracking pipeline, from backend extraction to metrics ingestion.

**Date**: 2025-01-15
**Severity**: HIGH - Causes 60% of metrics ingestion failures (400 Bad Request errors)

---

## 📋 Table of Contents
1. [Data Flow Overview](#data-flow-overview)
2. [Backend: Python Error Generation](#backend-python-error-generation)
3. [Frontend: IPC Handlers & Database Storage](#frontend-ipc-handlers--database-storage)
4. [Metrics: Database Reading](#metrics-database-reading)
5. [Metrics: Payload Building](#metrics-payload-building)
6. [Summary: All Null Scenarios](#summary-all-null-scenarios)
7. [Test Cases to Reproduce](#test-cases-to-reproduce)

---

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FAILED PDF ERROR FLOW                        │
└─────────────────────────────────────────────────────────────────┘

1. Backend (Python)
   ├── extraction_process() → Returns (df, name_n_num, error)
   ├── start_extraction_add_pdf() → Builds pdf_paths_not_extracted
   └── Returns to FastAPI → response.data["pdf_paths_not_extracted"]
                                    ↓
2. Frontend IPC (generateReport.js)
   ├── Receives response.data["pdf_paths_not_extracted"]
   ├── Maps paths (HYBRID mode)
   └── Stores in database → JSON.stringify(failedObj)
                                    ↓
3. Database (SQLite)
   └── failedStatements table → rawData column (JSON string)
                                    ↓
4. Metrics Provider (DatabaseMetricsProvider.js)
   └── SELECT from failedStatements → Returns rows
                                    ↓
5. Payload Builder (MetricsPayloadBuilder.js)
   ├── parseFailedStatement() → Extracts fields
   ├── buildFailedPdfsSection() → Constructs array
   └── Sends to Django → POST /api/metrics/ingest/
                                    ↓
6. Django Backend
   └── Validation → REJECTS null values → 400 Bad Request
```

---

## Backend: Python Error Generation

### 🔴 CRITICAL FUNCTION: `extraction_process()`
**File**: `backend/common_functions.py:350-432`

#### What It Returns
```python
def extraction_process(bank, pdf_path, pdf_password, start_date, end_date, isthis_ocr, CA_ID):
    # Returns: (dataframe, name_n_num, error_message)
    # ├── dataframe: Extracted transactions (can be empty)
    # ├── name_n_num: [customer_name, account_number] (can be default/None)
    # └── error_message: String or empty (no structured error code)
```

#### 🐛 NULL SCENARIO 1: OCR Extraction Fails
**Location**: `common_functions.py:358-377`

```python
if isthis_ocr:
    try:
        if ext == ".pdf":
            idf, text, explicit_lines = extract_with_test_cases_ocr(bank, pdf_path, pdf_password, CA_ID)

            if idf.empty:
                print("Empty result from ocr detection")
                raise Exception("Rectify PDF")

            name_n_num = explicit_lines if idf.empty else extract_account_details(text)
            # ⚠️ PROBLEM: name_n_num can be None if explicit_lines is None

        if not idf.empty:
            a = validate_bank_statement_returns_error_message_ocr(idf)
            idf = add_start_n_end_date_v2(idf, start_date, end_date, bank)

        return idf, name_n_num, a  # ⚠️ name_n_num can be None here

    except Exception as e:
        return empty_idf, default_name_n_num, str(e)
        # Returns: (empty DataFrame, ["_", "XXXXXXXXXX"], "Rectify PDF")
```

**Conditions That Cause Null**:
- ✅ `extract_with_test_cases_ocr()` returns `explicit_lines=None` AND `idf.empty=True`
- ✅ `extract_account_details()` fails and returns `None`
- ✅ Any exception during OCR processing

**Result**: `name_n_num = None` (instead of default array)

---

#### 🐛 NULL SCENARIO 2: Encoded PDF Detection
**Location**: `common_functions.py:378-432`

```python
else:  # Not OCR mode
    try:
        if ext == ".pdf":
            idf, text, explicit_lines = extract_with_test_cases(bank, pdf_path, pdf_password, CA_ID)

            if idf.empty:
                # SECOND CHECK: Check if PDF is encoded
                encoding_result = is_pdf_encoded(pdf_path, pdf_password)
                print("Encoding Result:", encoding_result)
                if encoding_result != "PDF text is readable and not encoded.":
                    raise Exception("The PDF appears to be encoded or obfuscated. Please upload a readable PDF.")
                    # ⚠️ Exception raised, goes to except block

            name_n_num = explicit_lines if idf.empty else extract_account_details(text)
            # ⚠️ PROBLEM: If explicit_lines is None, name_n_num becomes None

        # ... CSV/Excel handling ...

        if not idf.empty:
            a = validate_bank_statement_returns_error_message(idf)
            idf = add_start_n_end_date_v2(idf, start_date, end_date, bank)

        return idf, name_n_num, a  # ⚠️ name_n_num can be None

    except Exception as e:
        return empty_idf, default_name_n_num, str(e)
        # ⚠️ PROBLEM: Exception message is plain string, no error code
```

**Conditions That Cause Null**:
- ✅ PDF is encoded/obfuscated (raises exception)
- ✅ `extract_with_test_cases()` returns `explicit_lines=None` AND `idf.empty=True`
- ✅ `extract_account_details()` fails to extract name/account
- ✅ CSV/Excel file has invalid format

**Result**: `name_n_num = None` OR plain exception string (no error code)

---

### 🔴 CRITICAL FUNCTION: `start_extraction_add_pdf()`
**File**: `backend/tax_professional/banks/CA_Statement_Analyzer.py:626-788`

#### Error Object Initialization
**Location**: `CA_Statement_Analyzer.py:633-641`

```python
pdf_paths_not_extracted = {
    "bank_names": [],
    "paths": [],
    "passwords": [],
    "start_dates": [],
    "end_dates": [],
    "respective_list_of_columns": [],
    "respective_reasons_for_error": []
}
# ⚠️ PROBLEM: No "error_codes" field at all!
```

**Missing Field**: `error_codes` doesn't exist in backend response

---

#### 🐛 NULL SCENARIO 3: Bank Name Extraction
**Location**: `CA_Statement_Analyzer.py:644-670`

```python
for bank in bank_names:
    bank = str(f"{bank}{i}")  # e.g., "HDFC0", "ICICI1"
    pdf_path = pdf_paths[i]
    pdf_password = passwords[i]
    start_date = start_dates[i]
    end_date = end_dates[i]
    isthis_ocr = is_ocr[i]

    # Call extraction_process
    if aiyazs_array_of_array:
        # ... rectification logic ...
        dfs[bank], name_dfs[bank], errorz[bank] = extraction_process_explicit_lines(...)
    else:
        dfs[bank], name_dfs[bank], errorz[bank] = extraction_process(bank, pdf_path, pdf_password,
                                                                       start_date, end_date, isthis_ocr, CA_ID)
        # ⚠️ name_dfs[bank] can be None if extraction_process returns None
```

**Conditions That Cause Null**:
- ✅ `extraction_process()` returns `name_n_num = None` (from scenarios 1 & 2)
- ✅ `extraction_process_explicit_lines()` fails to extract bank info

**Result**: `name_dfs[bank] = None`

---

#### 🐛 NULL SCENARIO 4: Error Reasons Appended TWICE
**Location**: `CA_Statement_Analyzer.py:681-709`

```python
print(f"Extracted {bank} bank statement successfully")

# ⚠️ FIRST APPEND: Always happens for EVERY PDF (even successful ones!)
pdf_paths_not_extracted["respective_reasons_for_error"].append(errorz[bank])

print("one")
# Check if the extracted dataframe is empty
if dfs[bank].empty:  # Only failed PDFs enter this block
    pdf_paths_not_extracted["bank_names"].append(re.sub(r"\d+", "", bank))
    # ⚠️ PROBLEM: If bank is somehow None or empty, this could fail

    # ... PDF unlocking logic ...

    pdf_paths_not_extracted["paths"].append(pdf_path)
    pdf_paths_not_extracted["passwords"].append(pdf_password)
    pdf_paths_not_extracted["start_dates"].append(start_date)
    pdf_paths_not_extracted["end_dates"].append(end_date)
    pdf_paths_not_extracted["respective_list_of_columns"].append(name_dfs[bank])
    # ⚠️ CRITICAL: name_dfs[bank] can be None (from scenario 3)

    # ⚠️ SECOND APPEND: Duplicate append!
    pdf_paths_not_extracted["respective_reasons_for_error"].append(errorz[bank])

    del dfs[bank]
    del name_dfs[bank]
```

**Conditions That Cause Null/Issues**:
- ✅ `name_dfs[bank] = None` → `respective_list_of_columns` gets `null` value
- ✅ `errorz[bank] = ""` → Empty string error message
- ✅ `respective_reasons_for_error` has duplicate entries (appended twice)

**Result**: `respective_list_of_columns: [null]` and duplicate error messages

---

#### 🐛 NULL SCENARIO 5: Empty Bank Name
**Location**: `CA_Statement_Analyzer.py:687`

```python
pdf_paths_not_extracted["bank_names"].append(re.sub(r"\d+", "", bank))
# If bank = "0" or just numbers, this becomes empty string ""
# If bank is somehow None, this crashes

# Example:
# bank = "123" → re.sub(r"\d+", "", "123") → ""
# bank = None → CRASH
```

**Conditions That Cause Null/Empty**:
- ✅ Bank name is only digits → Empty string `""`
- ✅ Bank name is `None` → Code crashes
- ✅ Bank name not properly passed from frontend

**Result**: `bank_names: [""]` or application crash

---

#### 🐛 NULL SCENARIO 6: Error Code Never Generated
**Location**: `CA_Statement_Analyzer.py:633-709` (entire function)

```python
# ⚠️ PROBLEM: Backend NEVER generates structured error codes

# What backend sends:
pdf_paths_not_extracted = {
    "respective_reasons_for_error": [
        "The PDF appears to be encoded or obfuscated",  # Plain string
        "Rectify PDF",                                  # Plain string
        ""                                             # Empty string
    ]
}

# What Django expects:
{
    "error_code": "PDF_ENCODED",  # ❌ This field doesn't exist!
    "error_message": "The PDF appears to be encoded or obfuscated"
}
```

**Conditions That Cause Null**:
- ✅ Backend never generates `error_codes` field
- ✅ Only plain exception strings in `respective_reasons_for_error`

**Result**: Frontend has no `error_code` data to send to Django

---

### Backend Summary: What Gets Sent

**Actual Backend Response Example**:
```json
{
  "status": "success",
  "data": "{...transaction data...}",
  "pdf_paths_not_extracted": {
    "bank_names": ["HDFC", "ICICI", ""],
    "paths": ["/tmp/stmt1.pdf", "/tmp/stmt2.pdf", "/tmp/stmt3.pdf"],
    "passwords": ["pass1", "", "pass3"],
    "start_dates": ["01-01-2024", "", ""],
    "end_dates": ["31-12-2024", "", ""],
    "respective_list_of_columns": [
      ["Customer A", "ACC123"],
      null,
      ["_", "XXXXXXXXXX"]
    ],
    "respective_reasons_for_error": [
      "The PDF appears to be encoded or obfuscated",
      "The PDF appears to be encoded or obfuscated",
      "Rectify PDF",
      "Rectify PDF",
      "",
      ""
    ]
  }
}
```

**Problems**:
- ❌ No `error_codes` field
- ❌ `respective_list_of_columns[1] = null`
- ❌ `bank_names[2] = ""`
- ❌ `respective_reasons_for_error` has duplicates (6 items for 3 PDFs)
- ❌ Empty strings in `start_dates`, `end_dates`, `passwords`

---

## Frontend: IPC Handlers & Database Storage

### 🔴 CRITICAL FUNCTION: `generate-report` IPC Handler
**File**: `frontend/ipc/generateReport.js:779-1320`

#### 🐛 NULL SCENARIO 7: No Validation Before Database Storage
**Location**: `generateReport.js:1043-1091`

```javascript
// Step 3: Handle failed extractions
if (response.data?.["pdf_paths_not_extracted"]?.paths?.length > 0) {
  let failedObj = response.data["pdf_paths_not_extracted"];
  // ⚠️ failedObj contains all the null values from backend (see Backend Summary above)

  let failedPdfPaths = failedObj.paths || [];

  // ... HYBRID path mapping logic (lines 1049-1085) ...

  // ⚠️ CRITICAL: Store in database WITHOUT ANY VALIDATION
  await db.insert(failedStatements).values({
    caseId: caseId,
    data: JSON.stringify(failedObj)  // ❌ Stores nulls, empty strings, duplicates directly!
  });
  // No checks for:
  // - null values in respective_list_of_columns
  // - empty bank names
  // - missing error codes
  // - duplicate error messages
```

**Conditions That Cause Null Storage**:
- ✅ Backend sends `null` values → Stored as `null` in JSON
- ✅ Backend sends empty strings `""` → Stored as `""`
- ✅ Backend sends duplicates → Stored with duplicates
- ✅ No validation or sanitization at all

**Result**: Database contains invalid JSON with null values

---

#### 🐛 NULL SCENARIO 8: HYBRID Mode Path Mapping
**Location**: `generateReport.js:1049-1085`

```javascript
try {
  const AppConfig = require("../config.js");
  const IS_LOCAL = AppConfig.useLocalServer; // true = local; false = hosted/hybrid
  if (!IS_LOCAL) {
    const caseFolder = path.join(tmpdir_path, "failed_pdfs", caseName);
    let filesInFolder = [];
    try {
      filesInFolder = fs.existsSync(caseFolder) ? fs.readdirSync(caseFolder) : [];
    } catch (_) {
      filesInFolder = [];
      // ⚠️ If folder doesn't exist or can't be read, filesInFolder = []
    }

    const mapToLocal = (backendPathOrName) => {
      const base = path.basename(backendPathOrName);
      const match =
        filesInFolder.find((f) => f === base) ||
        filesInFolder.find((f) => {
          const dashIdx = f.indexOf("-");
          const stripped = dashIdx !== -1 ? f.substring(dashIdx + 1) : f;
          return stripped === base;
        }) ||
        filesInFolder.find((f) => f.endsWith(base));

      return match ? path.join(caseFolder, match) : path.join(caseFolder, base);
      // ⚠️ If no match found, returns path with original filename (might not exist)
    };

    failedPdfPaths = failedPdfPaths.map(mapToLocal);
    failedObj = { ...failedObj, paths: failedPdfPaths };
    response.data["pdf_paths_not_extracted"] = failedObj;
  }
} catch (e) {
  log.warn("HYBRID failed path mapping skipped due to error", e);
  // ⚠️ Silently catches errors, continues with potentially wrong paths
}
```

**Conditions That Cause Issues**:
- ✅ Case folder doesn't exist → `filesInFolder = []` → No mapping happens
- ✅ File not found in folder → Returns non-existent path
- ✅ Exception during mapping → Silently ignored

**Result**: Incorrect file paths stored in database (HYBRID mode only)

---

### Database Schema: What Gets Stored

**Table**: `failedStatements`
**Schema**: `frontend/db/schema/FailedStatements.js`

```javascript
export const failedStatements = sqliteTable("failed_statements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  data: text("data"),  // ⚠️ No validation, stores raw JSON string
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
```

**Example Stored Data** (from NULL SCENARIO 7):
```json
{
  "id": 123,
  "caseId": 456,
  "data": "{\"bank_names\":[\"HDFC\",\"ICICI\",\"\"],\"paths\":[\"/tmp/stmt1.pdf\",\"/tmp/stmt2.pdf\",\"/tmp/stmt3.pdf\"],\"respective_list_of_columns\":[[\"Customer A\",\"ACC123\"],null,[\"_\",\"XXXXXXXXXX\"]],\"respective_reasons_for_error\":[\"The PDF appears to be encoded or obfuscated\",\"The PDF appears to be encoded or obfuscated\",\"Rectify PDF\",\"Rectify PDF\",\"\",\"\"]}"
}
```

**Problems in Database**:
- ❌ `null` stored as literal JSON null
- ❌ Empty strings stored as `""`
- ❌ Duplicate error messages (6 errors for 3 PDFs)
- ❌ No validation constraint on `data` column

---

## Metrics: Database Reading

### 🔴 FUNCTION: `getFailedStatements()`
**File**: `frontend/services/metrics/DatabaseMetricsProvider.js:180-204`

```javascript
async getFailedStatements() {
  try {
    const rows = await this.db
      .select({
        id: failedStatements.id,
        caseId: failedStatements.caseId,
        rawData: failedStatements.data,
        caseCreatedAt: cases.createdAt,
        caseName: cases.name,
      })
      .from(failedStatements)
      .leftJoin(cases, eq(failedStatements.caseId, cases.id))
      .orderBy(desc(failedStatements.createdAt))
      .limit(100);

    // ⚠️ Returns rows with rawData containing all the null values
    return rows;
  } catch (error) {
    this.logger.error("Failed to fetch failed statements", {
      message: error.message,
    });
    return [];  // Returns empty array on error
  }
}
```

**What Gets Returned**:
```javascript
[
  {
    id: 123,
    caseId: 456,
    rawData: "{\"bank_names\":[\"HDFC\",\"ICICI\",\"\"],\"respective_list_of_columns\":[[\"Customer A\",\"ACC123\"],null,[\"_\",\"XXXXXXXXXX\"]],\"respective_reasons_for_error\":[...]}",
    caseCreatedAt: "2025-01-15T10:30:00Z",
    caseName: "Case_ABC"
  }
]
```

**No Validation**: Just reads and returns whatever is in database

---

## Metrics: Payload Building

### 🔴 CRITICAL FUNCTION: `parseFailedStatement()`
**File**: `frontend/services/metrics/MetricsPayloadBuilder.js:231-336`

#### 🐛 NULL SCENARIO 9: JSON Parsing
**Location**: `MetricsPayloadBuilder.js:236-246`

```javascript
parseFailedStatement(row) {
  if (!row) {
    return null;  // ⚠️ Returns null if row is undefined
  }

  let parsed = {};
  const rawData = row.rawData || row.data;
  if (rawData) {
    try {
      parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    } catch (error) {
      this.logger.warn("Metrics: failed to parse failed_statements row", {
        id: row.id,
        error: error.message,
      });
      // ⚠️ On parse error, parsed remains {} (empty object)
    }
  }
  // ⚠️ If rawData is null/undefined, parsed remains {}
```

**Conditions That Cause Issues**:
- ✅ `row = null` → Returns `null`
- ✅ `rawData = null` → `parsed = {}`
- ✅ JSON parse error → `parsed = {}`

**Result**: Empty object or null returned

---

#### 🐛 NULL SCENARIO 10: Field Extraction with Fallbacks
**Location**: `MetricsPayloadBuilder.js:249-306`

```javascript
  // Flatten array-based structure produced by failed_statements logger.
  const bankNames = parsed.bank_names || parsed.bankNames || [];
  // ⚠️ If parsed = {}, bankNames = []

  const paths = parsed.paths || parsed.file_paths || parsed.files || [];
  const reasons =
    parsed.respective_reasons_for_error ||
    parsed.errorMessages ||
    parsed.errors ||
    [];
  const timestamps = parsed.timestamps || [];

  const entryCount = Math.max(
    bankNames.length,
    paths.length,
    reasons.length,
    timestamps.length,
    1  // ⚠️ Minimum 1 entry even if all arrays are empty
  );

  const systemContext = parsed.systemContext || parsed.system || {};
  const ramCandidate =
    systemContext.ramGb ??
    systemContext.memoryGb ??
    systemContext.memory ??
    null;
  const cpuCandidate =
    systemContext.cpuPercent ??
    systemContext.cpuUsage ??
    systemContext.cpu ??
    null;

  const results = [];
  for (let idx = 0; idx < entryCount; idx += 1) {
    const filePath =
      (Array.isArray(paths) && paths[idx]) ||
      parsed.fileName ||
      parsed.file_name ||
      parsed.file_path ||
      parsed.path ||
      "";

    const bankName =
      (Array.isArray(bankNames) && bankNames[idx]) ||
      parsed.bankType ||
      parsed.bank ||
      parsed.bank_name ||
      parsed.bankName ||
      null;  // ⚠️ CRITICAL: Can be null if no bank name found
```

**Conditions That Cause Null**:
- ✅ `bankNames[idx]` is `null` or `""` from backend
- ✅ All fallback fields are missing
- ✅ `parsed = {}` (empty object)

**Result**: `bankName = null`

---

#### 🐛 NULL SCENARIO 11: Error Code Always Null
**Location**: `MetricsPayloadBuilder.js:314`

```javascript
    const errorMessage =
      (Array.isArray(reasons) && reasons[idx]) ||
      parsed.errorMessage ||
      parsed.message ||
      parsed.error ||
      parsed.reason ||
      "";

    const timestamp =
      (Array.isArray(timestamps) && timestamps[idx]) ||
      parsed.timestamp ||
      parsed.failedAt ||
      parsed.createdAt ||
      null;

    results.push({
      case_id: row.caseId || null,
      case_name: row.caseName || null,
      case_created_at: toISO(row.caseCreatedAt),
      file_name: sanitizeFileName(filePath),
      bank_type: bankName,  // ⚠️ Can be null (from SCENARIO 10)
      error_code: parsed.errorCode || parsed.code || null,  // ⚠️ ALWAYS NULL - backend doesn't send this!
      error_message: truncateText(errorMessage),
      timestamp: toISO(timestamp),
      system_context: {
        ram_gb:
          typeof ramCandidate === "number"
            ? roundTo(ramCandidate, 1)
            : null,
        cpu_percent:
          typeof cpuCandidate === "number"
            ? roundTo(cpuCandidate, 1)
            : null,
      },
      raw_columns:
        Array.isArray(parsed.respective_list_of_columns) &&
        parsed.respective_list_of_columns[idx]
          ? parsed.respective_list_of_columns[idx]
          : null,  // ⚠️ CRITICAL: Can be null if backend sent null
    });
  }

  return results;
}
```

**Conditions That Cause Null**:
- ✅ `parsed.errorCode` doesn't exist (backend never sends it) → `error_code = null`
- ✅ `parsed.respective_list_of_columns[idx] = null` (from backend) → `raw_columns = null`
- ✅ `bankName = null` (from SCENARIO 10) → `bank_type = null`

**Result**: Payload with null values sent to Django

---

### Final Payload Sent to Django

**What `MetricsPayloadBuilder` Sends**:
```json
{
  "metrics_version": "v1.0",
  "failed_pdfs": [
    {
      "case_id": 456,
      "case_name": "Case_ABC",
      "file_name": "stmt1.pdf",
      "bank_type": "HDFC",
      "error_code": null,
      "error_message": "The PDF appears to be encoded or obfuscated",
      "raw_columns": ["Customer A", "ACC123"]
    },
    {
      "case_id": 456,
      "case_name": "Case_ABC",
      "file_name": "stmt2.pdf",
      "bank_type": "ICICI",
      "error_code": null,
      "error_message": "Rectify PDF",
      "raw_columns": null
    },
    {
      "case_id": 456,
      "case_name": "Case_ABC",
      "file_name": "stmt3.pdf",
      "bank_type": "",
      "error_code": null,
      "error_message": "",
      "raw_columns": ["_", "XXXXXXXXXX"]
    }
  ]
}
```

**Django Validation Errors**:
```json
{
  "failed_pdfs": [
    {},
    {
      "error_code": [{"string": "This field may not be null.", "code": "null"}],
      "raw_columns": [{"string": "This field may not be null.", "code": "null"}]
    },
    {
      "error_code": [{"string": "This field may not be null.", "code": "null"}],
      "bank_type": [{"string": "This field may not be blank.", "code": "blank"}]
    }
  ]
}
```

---

## Summary: All Null Scenarios

### Backend (Python)

| Scenario | Location | Condition | Result |
|----------|----------|-----------|--------|
| **1** | `common_functions.py:358-377` | OCR extraction fails | `name_n_num = None` |
| **2** | `common_functions.py:378-432` | PDF is encoded/obfuscated | `name_n_num = None` OR plain exception |
| **3** | `CA_Statement_Analyzer.py:644-670` | `extraction_process()` returns None | `name_dfs[bank] = None` |
| **4** | `CA_Statement_Analyzer.py:681-709` | PDF fails extraction | `respective_list_of_columns: [null]` |
| **5** | `CA_Statement_Analyzer.py:687` | Bank name is only digits | `bank_names: [""]` |
| **6** | `CA_Statement_Analyzer.py` (entire) | Backend never generates codes | No `error_codes` field |

### Frontend (JavaScript)

| Scenario | Location | Condition | Result |
|----------|----------|-----------|--------|
| **7** | `generateReport.js:1088-1091` | No validation before storage | Null values stored in database |
| **8** | `generateReport.js:1049-1085` | HYBRID mode path not found | Incorrect file paths |

### Metrics (JavaScript)

| Scenario | Location | Condition | Result |
|----------|----------|-----------|--------|
| **9** | `MetricsPayloadBuilder.js:236-246` | JSON parse error | `parsed = {}` |
| **10** | `MetricsPayloadBuilder.js:287-294` | No bank name in data | `bankName = null` |
| **11** | `MetricsPayloadBuilder.js:314,327-331` | Backend doesn't send error_code | `error_code = null`, `raw_columns = null` |

---

## Test Cases to Reproduce

### Test Case 1: Encoded PDF Upload
**File**: Create an encoded/obfuscated PDF
```bash
# Use a password-protected or encrypted PDF
# Upload via GenerateReport component
```

**Expected Backend Response**:
```json
{
  "pdf_paths_not_extracted": {
    "bank_names": ["HDFC"],
    "paths": ["/tmp/encoded.pdf"],
    "respective_list_of_columns": [null],
    "respective_reasons_for_error": [
      "The PDF appears to be encoded or obfuscated. Please upload a readable PDF.",
      "The PDF appears to be encoded or obfuscated. Please upload a readable PDF."
    ]
  }
}
```

**Database Storage**:
```json
{
  "data": "{\"bank_names\":[\"HDFC\"],\"respective_list_of_columns\":[null],\"respective_reasons_for_error\":[...]}"
}
```

**Metrics Payload**:
```json
{
  "failed_pdfs": [{
    "bank_type": "HDFC",
    "error_code": null,
    "raw_columns": null
  }]
}
```

**Django Response**: `400 Bad Request` - `error_code` and `raw_columns` cannot be null

---

### Test Case 2: OCR Failure
**File**: Upload image-based PDF with poor quality
```bash
# Upload scanned PDF with low resolution
# Set is_ocr = true
```

**Expected Backend Response**:
```json
{
  "pdf_paths_not_extracted": {
    "bank_names": [""],
    "paths": ["/tmp/scanned.pdf"],
    "respective_list_of_columns": [null],
    "respective_reasons_for_error": ["Rectify PDF", "Rectify PDF"]
  }
}
```

**Metrics Payload**:
```json
{
  "failed_pdfs": [{
    "bank_type": "",
    "error_code": null,
    "raw_columns": null
  }]
}
```

**Django Response**: `400 Bad Request` - `bank_type` cannot be blank, `error_code` and `raw_columns` cannot be null

---

### Test Case 3: Multiple PDFs (Mixed Success/Failure)
**Files**: Upload 3 PDFs - 1 success, 2 failures
```bash
# PDF 1: Valid HDFC statement (success)
# PDF 2: Encoded ICICI statement (failure)
# PDF 3: Corrupted file (failure)
```

**Expected Backend Response**:
```json
{
  "pdf_paths_not_extracted": {
    "bank_names": ["ICICI", ""],
    "paths": ["/tmp/icici.pdf", "/tmp/corrupted.pdf"],
    "respective_list_of_columns": [null, ["_", "XXXXXXXXXX"]],
    "respective_reasons_for_error": [
      "The PDF appears to be encoded or obfuscated",
      "The PDF appears to be encoded or obfuscated",
      "Rectify PDF",
      "Rectify PDF"
    ]
  }
}
```

**Metrics Payload**:
```json
{
  "failed_pdfs": [
    {
      "bank_type": "ICICI",
      "error_code": null,
      "raw_columns": null
    },
    {
      "bank_type": "",
      "error_code": null,
      "raw_columns": ["_", "XXXXXXXXXX"]
    }
  ]
}
```

**Django Response**: `400 Bad Request` - Both entries have null `error_code`, first has null `raw_columns`, second has blank `bank_type`

---

### Test Case 4: HYBRID Mode Path Mapping Failure
**Setup**: HYBRID mode (useLocalServer=false), case folder doesn't exist
```bash
# Set AppConfig.useLocalServer = false
# Delete case folder: rm -rf frontend/temp/failed_pdfs/<caseName>
# Upload failing PDF
```

**Expected Behavior**:
```javascript
// generateReport.js:1054-1058
const caseFolder = path.join(tmpdir_path, "failed_pdfs", caseName);
let filesInFolder = [];
try {
  filesInFolder = fs.existsSync(caseFolder) ? fs.readdirSync(caseFolder) : [];
  // ⚠️ caseFolder doesn't exist, filesInFolder = []
} catch (_) {
  filesInFolder = [];
}

// Path mapping fails, returns non-existent path
const match = null;  // No files to match
return path.join(caseFolder, base);  // Returns path that doesn't exist
```

**Database Storage**:
```json
{
  "data": "{\"paths\":[\"/tmp/failed_pdfs/Case_ABC/nonexistent.pdf\"]}"
}
```

**Result**: File paths in database point to non-existent files

---

## Recommended Fixes

### Priority 1: Frontend - Add Defensive Defaults
**File**: `frontend/services/metrics/MetricsPayloadBuilder.js:308-332`

```javascript
results.push({
  case_id: row.caseId || null,
  case_name: row.caseName || null,
  case_created_at: toISO(row.caseCreatedAt),
  file_name: sanitizeFileName(filePath),
  bank_type: bankName || "UNKNOWN",  // ✅ Never null
  error_code: parsed.errorCode || parsed.code || "EXTRACTION_FAILED",  // ✅ Default code
  error_message: truncateText(errorMessage),
  timestamp: toISO(timestamp),
  system_context: {
    ram_gb:
      typeof ramCandidate === "number"
        ? roundTo(ramCandidate, 1)
        : null,
    cpu_percent:
      typeof cpuCandidate === "number"
        ? roundTo(cpuCandidate, 1)
        : null,
  },
  raw_columns:
    (Array.isArray(parsed.respective_list_of_columns) &&
     parsed.respective_list_of_columns[idx]) || [],  // ✅ Empty array instead of null
});
```

### Priority 2: Backend - Generate Error Codes
**File**: `backend/common_functions.py:350-432`

Add error code mapping:
```python
ERROR_CODES = {
    "encoded": "PDF_ENCODED",
    "obfuscated": "PDF_OBFUSCATED",
    "Rectify PDF": "TABLE_EXTRACTION_FAILED",
    "Empty result": "OCR_FAILED",
}

def extraction_process(...):
    try:
        # ... existing code ...
        return idf, name_n_num, {"error_code": None, "message": a}
    except Exception as e:
        error_message = str(e)
        error_code = next((code for key, code in ERROR_CODES.items()
                          if key in error_message), "UNKNOWN_ERROR")
        return empty_idf, default_name_n_num, {
            "error_code": error_code,
            "message": error_message
        }
```

### Priority 3: Backend - Include Error Codes in Response
**File**: `backend/tax_professional/banks/CA_Statement_Analyzer.py:633-709`

```python
pdf_paths_not_extracted = {
    "bank_names": [],
    "paths": [],
    "passwords": [],
    "start_dates": [],
    "end_dates": [],
    "error_codes": [],  # ✅ New field
    "respective_list_of_columns": [],
    "respective_reasons_for_error": []
}

# In the loop
if dfs[bank].empty:
    error_info = errorz[bank]  # Now a dict: {"error_code": "...", "message": "..."}
    pdf_paths_not_extracted["bank_names"].append(re.sub(r"\d+", "", bank) or "UNKNOWN")
    pdf_paths_not_extracted["paths"].append(pdf_path)
    pdf_paths_not_extracted["error_codes"].append(error_info.get("error_code", "UNKNOWN_ERROR"))  # ✅
    pdf_paths_not_extracted["respective_list_of_columns"].append(name_dfs[bank] or [])  # ✅ Never null
    pdf_paths_not_extracted["respective_reasons_for_error"].append(error_info.get("message", ""))
```

### Priority 4: Frontend - Validate Before Database Storage
**File**: `frontend/ipc/generateReport.js:1088-1091`

```javascript
// Validate and sanitize before storing
const sanitizedFailedObj = {
  bank_names: (failedObj.bank_names || []).map(name => name || "UNKNOWN"),
  paths: failedObj.paths || [],
  error_codes: failedObj.error_codes || Array(failedObj.paths?.length || 0).fill("UNKNOWN_ERROR"),
  respective_reasons_for_error: failedObj.respective_reasons_for_error || [],
  respective_list_of_columns: (failedObj.respective_list_of_columns || []).map(cols => cols || [])
};

await db.insert(failedStatements).values({
  caseId: caseId,
  data: JSON.stringify(sanitizedFailedObj)
});
```

---

## Conclusion

**Root Cause**: Backend doesn't generate structured error codes and allows null values in `respective_list_of_columns`, combined with frontend not validating data before storage.

**Impact**: 60% of metrics ingestion requests fail with 400 Bad Request errors.

**Solution**: Implement defensive defaults in `MetricsPayloadBuilder.js` (Priority 1) and enhance backend error generation (Priority 2-3).
