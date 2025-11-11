#!/bin/bash

# Test the /analyze-statements-pdf/ endpoint
# This endpoint processes PDF bank statements and returns summary data

# USAGE:
# bash test_pdf_endpoint.sh /path/to/your/statement.pdf

PDF_PATH="${1:-sample_statement.pdf}"
BASE_URL="http://127.0.0.1:7500"

curl -X POST "$BASE_URL/analyze-statements-pdf/" \
  -F "files=@$PDF_PATH" \
  -F "bank_names=HDFC Bank" \
  -F "passwords=" \
  -F "start_date=01-01-2024" \
  -F "end_date=31-12-2024" \
  -F "ca_id=TEST_CASE_001" \
  -F "is_ocr=false" \
  -F 'categoryMasterData=[{"id":1,"Category":"Salary","Description":"Monthly salary","Particulars":"Income","Preferences":1,"debit_credit":"Credit"}]' \
  -H "Accept: application/json" \
  --max-time 300 \
  -v

# The response will include:
# - status: "success" or "failed"
# - data: { Transactions, EOD, Particulars, Income Receipts, Important Expenses, etc. }
# - ner_results: { Name: [], "Acc Number": [] }
# - pdf_paths_not_extracted: { paths: [], reasons: [] }
# - processing_times: { ner_processing, extraction, total }
