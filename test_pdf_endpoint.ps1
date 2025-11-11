# PowerShell script to test the /analyze-statements-pdf/ endpoint
# This endpoint processes PDF bank statements and returns summary data

# USAGE:
# .\test_pdf_endpoint.ps1 -PdfPath "C:\path\to\your\statement.pdf"

param(
    [string]$PdfPath = "sample_statement.pdf",
    [string]$BaseUrl = "http://127.0.0.1:7500",
    [string]$BankName = "HDFC Bank",
    [string]$StartDate = "01-01-2024",
    [string]$EndDate = "31-12-2024",
    [string]$CaseId = "TEST_CASE_001"
)

# Category master data (required for categorization)
$categoryMasterData = @(
    @{
        id = 1
        Category = "Salary"
        Description = "Monthly salary"
        Particulars = "Income"
        Preferences = 1
        debit_credit = "Credit"
    }
) | ConvertTo-Json -Compress

# Create multipart form data
$boundary = [System.Guid]::NewGuid().ToString()
$contentType = "multipart/form-data; boundary=$boundary"

# Read the PDF file as bytes
$fileBytes = [System.IO.File]::ReadAllBytes($PdfPath)
$fileName = [System.IO.Path]::GetFileName($PdfPath)

# Build the multipart form body
$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"files`"; filename=`"$fileName`"",
    "Content-Type: application/pdf",
    "",
    [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
    "--$boundary",
    "Content-Disposition: form-data; name=`"bank_names`"",
    "",
    $BankName,
    "--$boundary",
    "Content-Disposition: form-data; name=`"passwords`"",
    "",
    "",
    "--$boundary",
    "Content-Disposition: form-data; name=`"start_date`"",
    "",
    $StartDate,
    "--$boundary",
    "Content-Disposition: form-data; name=`"end_date`"",
    "",
    $EndDate,
    "--$boundary",
    "Content-Disposition: form-data; name=`"ca_id`"",
    "",
    $CaseId,
    "--$boundary",
    "Content-Disposition: form-data; name=`"is_ocr`"",
    "",
    "false",
    "--$boundary",
    "Content-Disposition: form-data; name=`"categoryMasterData`"",
    "",
    $categoryMasterData,
    "--$boundary--"
)

$body = $bodyLines -join "`r`n"

Write-Host "Sending request to: $BaseUrl/analyze-statements-pdf/" -ForegroundColor Cyan
Write-Host "PDF File: $PdfPath" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/analyze-statements-pdf/" `
        -Method Post `
        -ContentType $contentType `
        -Body ([System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body)) `
        -TimeoutSec 300

    Write-Host "`n✅ Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`n📄 Response Content:" -ForegroundColor Yellow

    $jsonResponse = $response.Content | ConvertFrom-Json
    $jsonResponse | ConvertTo-Json -Depth 10

    # Display summary information
    if ($jsonResponse.status -eq "success") {
        Write-Host "`n✅ Analysis Successful!" -ForegroundColor Green
        Write-Host "   - Transactions extracted" -ForegroundColor Green
        Write-Host "   - Summary statement generated" -ForegroundColor Green
        Write-Host "   - Processing time: $($jsonResponse.processing_times.total) seconds" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Analysis Failed" -ForegroundColor Red
        Write-Host "   Message: $($jsonResponse.message)" -ForegroundColor Red
    }

} catch {
    Write-Host "`n❌ Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Response structure includes:
# {
#   "status": "success",
#   "message": "Bank statements analyzed successfully",
#   "data": {
#     "Transactions": [...],           # All extracted transactions
#     "EOD": [...],                    # End of day balances
#     "Particulars": [...],            # Summary categories
#     "Income Receipts": [...],        # Income breakdown
#     "Important Expenses": [...],     # Major expenses
#     "Other Expenses": [...],         # Minor expenses
#     "Contra Debit": [...],           # Contra entries (debit)
#     "Contra Credit": [...],          # Contra entries (credit)
#     "Opportunity to Earn": [...]     # Financial recommendations
#   },
#   "pdf_paths_not_extracted": {
#     "paths": [],
#     "bank_names": [],
#     "respective_reasons_for_error": []
#   },
#   "ner_results": {
#     "Name": [],                      # Extracted account holder names
#     "Acc Number": []                 # Extracted account numbers
#   },
#   "success_page_number": 15,         # Number of pages processed
#   "missing_months_list": [],         # Missing statement months
#   "processing_times": {
#     "ner_processing": 0.5,
#     "extraction": 45.2,
#     "total": 45.7
#   }
# }
