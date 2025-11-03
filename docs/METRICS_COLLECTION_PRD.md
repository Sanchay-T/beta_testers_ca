# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## CypherEdge Metrics Collection & CEO Dashboard System

**Document Version**: 1.0
**Date**: October 27, 2025
**Status**: Draft - Brainstorming Phase
**Author**: Technical Architecture Team
**Stakeholder**: CEO, Product Team, Development Team

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current State Analysis](#current-state-analysis)
4. [Goals & Objectives](#goals--objectives)
5. [User Personas](#user-personas)
6. [Requirements](#requirements)
7. [Proposed Solution Options](#proposed-solution-options)
8. [Technical Architecture](#technical-architecture)
9. [Data Schema](#data-schema)
10. [Implementation Phases](#implementation-phases)
11. [Success Metrics](#success-metrics)
12. [Risks & Mitigations](#risks--mitigations)
13. [Open Questions](#open-questions)
14. [Appendix](#appendix)

---

## EXECUTIVE SUMMARY

### The Problem
CypherEdge is a **desktop offline application** deployed on multiple user PCs. Each installation maintains its own **local SQLite database** with user activity, PDF processing data, and error logs. Currently, there is **no mechanism** to aggregate this data across all users, making it **impossible for CEO and stakeholders to understand**:
- Who is using the app and how often
- What features are being used
- What errors/failures users are experiencing
- Overall app health and performance metrics
- License utilization across user base

### The Goal
Create a **simple, efficient system** to:
1. **Collect metrics** from all offline app installations
2. **Aggregate data** from distributed users
3. **Present insights** to CEO via dashboard
4. **Start simple** (manual export) with **path to automation** (auto-upload to Django)

### Success Criteria
- CEO can see aggregated metrics from all users within **1 week** of implementation
- Minimal user friction (1-click export or fully automatic)
- Data privacy preserved (hash sensitive information)
- Scalable architecture (works for 10 users, works for 1000 users)
- Phased approach (quick wins now, full automation later)

---

## PROBLEM STATEMENT

### Current Situation

**Application Architecture**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED OFFLINE APPS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User PC 1           User PC 2           User PC 3             │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐          │
│  │Electron │         │Electron │         │Electron │          │
│  │  App    │         │  App    │         │  App    │          │
│  └────┬────┘         └────┬────┘         └────┬────┘          │
│       │                   │                   │                │
│  ┌────▼────┐         ┌────▼────┐         ┌────▼────┐          │
│  │SQLite DB│         │SQLite DB│         │SQLite DB│          │
│  │ Local   │         │ Local   │         │ Local   │          │
│  └─────────┘         └─────────┘         └─────────┘          │
│                                                                 │
│  Data Isolated       Data Isolated       Data Isolated         │
└─────────────────────────────────────────────────────────────────┘

                    ⬇️ NO CONNECTION ⬇️

┌─────────────────────────────────────────────────────────────────┐
│                          CEO / STAKEHOLDERS                      │
│                                                                 │
│  ❌ Cannot see aggregated metrics                               │
│  ❌ Cannot identify common errors                               │
│  ❌ Cannot understand user behavior                             │
│  ❌ Cannot track feature adoption                               │
│  ❌ Cannot optimize product roadmap                             │
└─────────────────────────────────────────────────────────────────┘
```

**The Gap**:
- **Data exists** in each SQLite database but is **isolated**
- **No communication** between app installations and central server
- **Manual inspection** requires physical access to each user's PC
- **CEO has zero visibility** into app usage across user base

### Specific Pain Points

1. **CEO Cannot Answer Basic Questions**:
   - "How many users actively use the app this month?"
   - "What's our PDF processing success rate?"
   - "Which banks have the highest failure rates?"
   - "Are users experiencing system compatibility issues?"
   - "Which features are most/least used?"

2. **Support Team Blind**:
   - Users report errors, but support has no aggregated error logs
   - Cannot identify systemic issues (e.g., "HDFC PDFs fail for everyone with <8GB RAM")
   - Reactive support only (wait for user complaints)

3. **Product Decisions Uninformed**:
   - No data on feature usage → Cannot prioritize roadmap
   - No performance metrics → Cannot optimize slow operations
   - No user behavior patterns → Cannot improve UX

4. **License Management Opacity**:
   - Cannot see which licenses are actively used vs dormant
   - Cannot forecast license renewals
   - Cannot identify power users vs casual users

---

## CURRENT STATE ANALYSIS

### What Data EXISTS in SQLite (Per User PC)

**13 Database Tables Currently Populated**:

| Table | Purpose | Example Row Count | Metrics Value |
|-------|---------|-------------------|---------------|
| `users` | User account info | 1 (per PC) | User email, role, join date |
| `cases` | Projects/cases created | 5-50 | Case count, total pages |
| `statements` | Successful PDF processing | 20-200 | PDF count, banks used |
| `transactions` | Extracted transactions | 500-5000 | Transaction count |
| `failed_statements` | Failed PDF processing | 2-20 | Error messages, failure rate |
| `summary` | Case summaries | 5-50 | Report generation data |
| `eod` | End-of-day balances | 5-50 | Financial summaries |
| `categories` | Transaction categories | 50-100 | Category usage |
| `tally_voucher` | Tally templates | 10-20 | Tally export usage |
| + 4 more tables | Various | Various | Additional metrics |

**System Information Collected (Not Stored in DB)**:
- Device ID (Windows SID): `S-1-5-21-xxx`
- Hardware UUID
- MAC Address
- Hostname
- OS Info (Platform, Release, Architecture)
- RAM (Total/Free)
- CPU (Model, Cores, Speed)
- Compatibility Mode (SCAN/UNSCAN/HYBRID)

**License Information (Encrypted File Only)**:
- License Key
- License Expiry
- Max Users
- Max Statements
- Active Sessions

### What Data is MISSING

**Critical Gaps for Metrics**:
1. ❌ **License Key NOT stored in database** - Cannot group users by license family
2. ❌ **Device specs NOT persisted** - Cannot correlate errors with hardware
3. ❌ **Session duration NOT tracked** - Cannot measure engagement
4. ❌ **Processing time NOT captured** - Cannot identify performance bottlenecks
5. ❌ **Batch tracking MISSING** - Cannot calculate success/failure ratios
6. ❌ **User actions NOT logged** - Cannot understand feature usage
7. ❌ **Error context INCOMPLETE** - Errors logged but system state not captured

### Current Logging Infrastructure (Underutilized)

**Available but NOT Integrated**:
- `electron-log`: Basic app lifecycle logging to `cyphersol.log` file
- `CyphersolLogger.js` (448 lines): Comprehensive structured logger - **NOT USED**
- `UIFlowLogger.js` (483 lines): UI event tracker - **NOT USED**

**Gateway Service Metrics** (Not Synced to App DB):
- Session assignments/releases
- Active session count
- Statement usage counter
- License validation attempts

---

## GOALS & OBJECTIVES

### Primary Goal
**Enable CEO to see aggregated metrics from all app users within 1 week**

### Secondary Goals
1. **Minimal User Friction**: Export should be 1-click or fully automatic
2. **Privacy Preserved**: Hash/anonymize sensitive data (emails, license keys, IPs)
3. **Scalable Design**: Solution works for 10 users today, 1000 users tomorrow
4. **Phased Implementation**: Quick manual solution now, full automation later
5. **Data Accuracy**: Ensure collected metrics are reliable and complete

### Non-Goals (Out of Scope for Initial Phase)
- ❌ Real-time live metrics (daily/weekly aggregation sufficient)
- ❌ User-facing analytics (CEO dashboard only)
- ❌ Predictive analytics / ML models
- ❌ Multi-tenant license management improvements
- ❌ Mobile app support

---

## USER PERSONAS

### Persona 1: CEO / Stakeholder
**Name**: Rajesh Kumar
**Role**: CEO / Product Owner
**Technical Level**: Non-technical

**Needs**:
- See high-level metrics (KPIs): total users, success rates, error trends
- Identify problem areas (which banks fail most, which features unused)
- Make data-driven product decisions
- Monthly reports for board meetings

**Pain Points**:
- Currently has ZERO visibility into app usage
- Must rely on anecdotal user feedback
- Cannot justify development priorities with data

**Success Criteria**:
- Can answer "How is the app performing?" in 5 minutes
- Dashboard accessible via web browser
- Data refreshed at least weekly

---

### Persona 2: End User (CA Professional)
**Name**: Priya Sharma
**Role**: Chartered Accountant using CypherEdge daily
**Technical Level**: Moderate (comfortable with desktop apps)

**Needs**:
- App works smoothly without interruptions
- Minimal extra steps (don't want to manually export metrics)
- Privacy assured (financial data not shared)

**Pain Points**:
- Busy with client work, no time for admin tasks
- Suspicious of "data collection" (needs transparency)
- May forget to export metrics if manual

**Success Criteria**:
- Metrics export is automatic OR 1-click in settings
- Clear privacy disclosure (what's collected, what's NOT)
- Optional opt-out if concerned

---

### Persona 3: Support Engineer
**Name**: Amit Patel
**Role**: Technical support, handles user issues
**Technical Level**: High (developer background)

**Needs**:
- Aggregated error logs to identify common issues
- User context when debugging (system specs, compatibility mode)
- Trend analysis (are errors increasing after recent update?)

**Pain Points**:
- Users report vague errors ("PDF failed"), no details
- Cannot reproduce issues without exact system specs
- Reactive support only (no proactive monitoring)

**Success Criteria**:
- Can see top 10 errors across all users
- Can filter errors by system specs (e.g., "<8GB RAM")
- Can identify systemic issues vs user-specific problems

---

### Persona 4: Developer
**Name**: Sanchay Thalneker
**Role**: Full-stack developer, builds CypherEdge
**Technical Level**: Expert

**Needs**:
- Implement metrics collection with minimal code changes
- Ensure performance impact is negligible (<5% overhead)
- Design scalable architecture for future features

**Pain Points**:
- Limited time for large refactors
- Must maintain backward compatibility
- Need to balance features vs technical debt

**Success Criteria**:
- Metrics system implemented in 1-2 weeks
- No breaking changes to existing app
- Clear documentation for future enhancements

---

## REQUIREMENTS

### Functional Requirements

#### FR1: Metrics Data Collection
**Priority**: CRITICAL
**Description**: App must collect comprehensive metrics from existing SQLite database and system information

**Data to Collect**:
1. **User Information**:
   - Email (hashed)
   - Role (CA, Admin, etc.)
   - Date joined
   - Last login timestamp

2. **System Information**:
   - Device ID (Windows SID)
   - Hostname
   - OS (Platform, Release, Architecture)
   - RAM (Total GB)
   - CPU (Model, Cores)
   - Compatibility Mode (SCAN/UNSCAN/HYBRID)

3. **License Information**:
   - License Key (SHA256 hash)
   - License Expiry Date
   - Max Users
   - License Type (Direct / Network Floating)

4. **Usage Statistics**:
   - Total cases created
   - Total PDFs processed (successful)
   - Total PDFs failed
   - Success rate percentage
   - Banks used (list)
   - Total transactions extracted
   - Reports generated count
   - Tally exports count

5. **Failed PDFs Details**:
   - File name (sanitized path)
   - Bank type
   - Error message
   - Error code
   - Timestamp
   - System context (RAM, CPU at time of failure)

6. **Date Range**:
   - First activity timestamp
   - Last activity timestamp
   - Export timestamp

**Acceptance Criteria**:
- All data collected from existing SQLite tables (no schema changes initially)
- Sensitive data (emails, license keys) hashed with SHA256
- File paths sanitized (only basename, no full paths)
- Export completes in <5 seconds for typical user database (~100 PDFs)

---

#### FR2: Export Mechanism
**Priority**: CRITICAL
**Description**: User can trigger metrics export via UI

**User Flow**:
```
1. User opens CypherEdge app
2. Navigates to Settings
3. Sees "Export Metrics Report" section
4. Clicks "Generate Report" button
5. App shows progress indicator ("Collecting metrics...")
6. App generates JSON file: cypheredge_metrics_[email]_[timestamp].json
7. App opens file explorer with file selected OR auto-saves to Downloads
8. User sees success message: "Report saved to Downloads"
```

**Export Formats** (Phase 1):
- **JSON**: Structured data for programmatic parsing
- **Future**: CSV, Excel for manual review

**Acceptance Criteria**:
- Export button visible in Settings page
- Progress indicator during export
- File saved to user-selectable location (default: Downloads)
- Success/error messages shown
- Export can be canceled mid-process
- Export includes timestamp and version identifier

---

#### FR3: Data Aggregation (CEO Side)
**Priority**: HIGH
**Description**: CEO/Admin can aggregate metrics from multiple user exports

**Options**:

**Option A: Manual Aggregation** (Phase 1)
- CEO collects JSON files from users (email, shared drive)
- Runs Python script: `python aggregate_metrics.py --input ./user_exports/`
- Script generates Excel report with:
  - Summary statistics (total users, PDFs, failures)
  - Failed PDF list (all users)
  - Per-user breakdown
  - Charts (success rates, bank usage)

**Option B: Web Upload Portal** (Phase 1.5)
- Simple web page: `metrics.yourcompany.com/upload`
- Users upload JSON files via drag-and-drop
- Backend stores files
- CEO accesses dashboard: `metrics.yourcompany.com/dashboard`
- Dashboard shows aggregated metrics from all uploads

**Option C: Auto-Upload System** (Phase 2)
- App automatically uploads metrics daily (background)
- Django endpoint: `POST /api/ingest-metrics/`
- CEO sees live dashboard with latest data

**Acceptance Criteria** (Option A - Phase 1):
- Python script aggregates 50+ JSON files in <30 seconds
- Excel report generated with all required metrics
- Script handles malformed JSON gracefully (skip + log error)

---

#### FR4: CEO Dashboard (Web Interface)
**Priority**: MEDIUM (Phase 2)
**Description**: Web dashboard displaying aggregated metrics

**Dashboard Sections**:

1. **Overview KPIs** (Top Cards):
   ```
   ┌──────────────┬──────────────┬──────────────┬──────────────┐
   │ Total Users  │ PDFs         │ Success Rate │ Active       │
   │     150      │ Processed    │    94.5%     │ Licenses     │
   │              │   5,234      │              │     45       │
   └──────────────┴──────────────┴──────────────┴──────────────┘
   ```

2. **Failed PDFs Analysis**:
   - Total failures
   - Top 10 error messages
   - Failure rate by bank
   - Failure rate by system specs (RAM/CPU)

3. **User Activity**:
   - Active users last 30 days
   - New users this month
   - User distribution by license family
   - Most active users (by PDFs processed)

4. **System Health**:
   - Compatibility mode distribution (SCAN/UNSCAN/HYBRID)
   - System specs histogram (RAM, CPU)
   - Error trends over time

5. **Feature Usage**:
   - Reports generated count
   - Tally exports count
   - Most used banks

**Filters**:
- Date range (last 7/30/90 days, custom)
- License family
- User email
- Bank type
- System specs

**Acceptance Criteria**:
- Dashboard loads in <3 seconds
- Responsive design (desktop/tablet)
- Export dashboard to PDF for board meetings
- Role-based access (CEO, Support, Admin)

---

### Non-Functional Requirements

#### NFR1: Performance
- Metrics export completes in <5 seconds (typical database ~100 PDFs)
- Metrics export completes in <30 seconds (large database ~1000 PDFs)
- Export process does not block app UI (background worker thread)
- Export adds <100MB to app memory usage
- Aggregation script processes 100 user exports in <1 minute

#### NFR2: Privacy & Security
- All personally identifiable information (PII) hashed:
  - User emails → SHA256
  - License keys → SHA256
  - Device IDs → SHA256 (if transmitted remotely)
- File paths sanitized (remove user directories, keep basename only)
- No PDF content included in metrics
- No bank account numbers included
- Clear privacy disclosure in app (Settings → Privacy Policy)
- Optional opt-out mechanism (checkbox: "Participate in usage analytics")

#### NFR3: Reliability
- Export mechanism must not crash app if database is corrupted
- Graceful handling of missing tables/columns (backward compatibility)
- Export retries up to 3 times on transient errors
- Partial export successful (if some data unavailable, export rest)

#### NFR4: Scalability
- Solution works for 10 users (current beta)
- Solution works for 1000 users (future growth)
- Database queries optimized (use indexes, avoid full table scans)
- Auto-upload (Phase 2) uses batch API calls (not 1 request per metric)

#### NFR5: Maintainability
- Metrics export code modular (separate service class)
- Well-documented functions and data schema
- Versioned export format (v1.0, v1.1, etc. for compatibility)
- Automated tests for metrics collection logic

---

## PROPOSED SOLUTION OPTIONS

### Option 1: Manual Export + Email Collection ⭐ SIMPLEST
**Implementation Time**: 4-6 hours
**Infrastructure**: None (works offline)

**How It Works**:
1. User clicks "Export Metrics Report" in app Settings
2. App generates `cypheredge_metrics_[email]_[date].json`
3. File saved to Downloads folder
4. User emails file to: `metrics@yourcompany.com`
5. CEO/Admin collects emails, saves attachments to folder
6. Opens each JSON manually to review (or uses text editor search)

**Pros**:
- ✅ Fastest to implement (4-6 hours)
- ✅ No server infrastructure required
- ✅ Works immediately
- ✅ No network dependencies

**Cons**:
- ❌ Relies on users remembering to export + email
- ❌ Manual collection tedious for CEO (50+ emails)
- ❌ No aggregation (CEO reviews individual files)
- ❌ Not scalable (100+ users = unmanageable)

**When to Use**:
- Very small beta test (5-10 users)
- Need data THIS WEEK
- No development resources for server infrastructure

---

### Option 2: Manual Export + Aggregation Script ⭐ RECOMMENDED (Phase 1)
**Implementation Time**: 8-10 hours
**Infrastructure**: CEO runs Python script locally

**How It Works**:
1. User clicks "Export Metrics Report" in app Settings
2. App generates JSON file
3. User uploads to Google Drive / OneDrive shared folder (or emails)
4. CEO downloads all JSON files to local folder: `./user_exports/`
5. CEO runs: `python aggregate_metrics.py --input ./user_exports/ --output report.xlsx`
6. Script aggregates all files and generates Excel report with:
   - Summary sheet (KPIs, totals)
   - Failed PDFs sheet (all users combined)
   - Per-user breakdown sheet
   - Charts sheet (success rates, bank usage)

**Aggregation Script Features**:
```python
# aggregate_metrics.py
import os
import json
import pandas as pd
from collections import defaultdict

def aggregate_metrics(input_dir):
    all_users = []
    all_failed_pdfs = []
    statistics = defaultdict(int)

    for file in os.listdir(input_dir):
        if file.endswith('.json'):
            with open(os.path.join(input_dir, file)) as f:
                data = json.load(f)
                all_users.append(data['user_info'])
                all_failed_pdfs.extend(data['failed_pdfs'])

                # Aggregate stats
                statistics['total_pdfs'] += data['statistics']['total_statements_processed']
                statistics['failed_pdfs'] += data['statistics']['total_failed_statements']

    # Generate Excel report
    with pd.ExcelWriter('metrics_report.xlsx') as writer:
        pd.DataFrame(all_users).to_excel(writer, sheet_name='Users')
        pd.DataFrame(all_failed_pdfs).to_excel(writer, sheet_name='Failed PDFs')
        pd.DataFrame([statistics]).to_excel(writer, sheet_name='Summary')
```

**Pros**:
- ✅ CEO gets aggregated data (no manual review)
- ✅ Still no server infrastructure needed
- ✅ Excel output easy to share/present
- ✅ Quick to implement (8-10 hours)

**Cons**:
- ❌ Still relies on users exporting
- ❌ CEO must manually collect files and run script
- ❌ Not real-time (weekly/monthly batches)

**When to Use**:
- Beta test with 10-50 users
- CEO comfortable with Python (or dev team runs script)
- Need results within 1-2 weeks
- Budget to build proper infrastructure later

---

### Option 3: Manual Export + Web Upload Portal
**Implementation Time**: 12-15 hours
**Infrastructure**: Simple Node.js/PHP web server + MySQL

**How It Works**:
1. User clicks "Export Metrics Report" in app Settings
2. App generates JSON and shows: "Upload Report" button
3. Button opens browser to: `https://metrics.yourcompany.com/upload`
4. User drags JSON file to upload form
5. Backend stores file in database + blob storage
6. CEO accesses: `https://metrics.yourcompany.com/dashboard`
7. Dashboard shows aggregated metrics from all uploaded files (live updates)

**Architecture**:
```
┌─────────────┐
│ Electron App│
│   (User)    │
└──────┬──────┘
       │ JSON Upload
       ▼
┌─────────────────────┐
│ Web Server          │
│ (Node.js/Express)   │
│                     │
│ POST /api/upload    │
│ GET /dashboard      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ MySQL Database      │
│ - uploads table     │
│ - metrics_summary   │
└─────────────────────┘
```

**Pros**:
- ✅ Centralized data storage
- ✅ CEO sees live dashboard (no manual script)
- ✅ Scalable to 100+ users
- ✅ Can add user authentication later

**Cons**:
- ❌ Requires server hosting ($10-20/month)
- ❌ More complex to build (12-15 hours)
- ❌ Still requires users to manually export + upload

**When to Use**:
- 20-100 users
- Budget for simple hosting
- Want professional dashboard for CEO
- Plan to keep manual export (no auto-upload)

---

### Option 4: Automatic Upload System (Phase 2) ⭐ FUTURE STATE
**Implementation Time**: 20-30 hours
**Infrastructure**: Django backend + PostgreSQL

**How It Works**:
1. App automatically collects metrics (no user action)
2. Background job uploads metrics daily (or on logout)
3. POST to Django: `/api/ingest-metrics/`
4. Django stores in PostgreSQL
5. CEO accesses Django admin dashboard
6. Full-featured analytics (filters, charts, exports)

**Automatic Upload Triggers**:
- Daily at 2 AM (user PC on)
- On user logout
- Manual trigger ("Sync Now" button in Settings)

**Opt-In Mechanism**:
```javascript
// Settings → Privacy
[✓] Participate in usage analytics
    Help us improve CypherEdge by sharing anonymous usage data.
    [Learn more about what we collect]

    Last sync: October 27, 2025 at 10:30 AM
    [Sync Now]
```

**Pros**:
- ✅ Fully automated (no user action required)
- ✅ Real-time data (CEO sees latest metrics)
- ✅ Scalable to 1000+ users
- ✅ Powerful analytics capabilities

**Cons**:
- ❌ Complex to build (20-30 hours + Django API work)
- ❌ Requires Django infrastructure now
- ❌ Users may be concerned about privacy (need clear disclosure)

**When to Use**:
- 100+ users
- Django backend ready
- Budget for full-time developer
- Long-term solution (not quick fix)

---

## TECHNICAL ARCHITECTURE

### Phase 1 Architecture (Manual Export)

```
┌───────────────────────────────────────────────────────────────┐
│                     USER'S ELECTRON APP                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Settings Page (React)                              │    │
│  │                                                      │    │
│  │  ┌────────────────────────────────────────────┐    │    │
│  │  │ [📊 Export Metrics Report]                 │    │    │
│  │  │                                             │    │    │
│  │  │ Generate a report of your app usage to     │    │    │
│  │  │ share with our team.                       │    │    │
│  │  │                                             │    │    │
│  │  │ Last export: October 25, 2025              │    │    │
│  │  └────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                   │
│                           │ IPC: 'metrics:export'             │
│                           ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Main Process (Electron)                            │    │
│  │                                                      │    │
│  │  ┌───────────────────────────────────────────┐     │    │
│  │  │ MetricsExportService.js                   │     │    │
│  │  │                                            │     │    │
│  │  │ - collectUserInfo()                       │     │    │
│  │  │ - collectSystemInfo()                     │     │    │
│  │  │ - collectLicenseInfo()                    │     │    │
│  │  │ - collectUsageStatistics()                │     │    │
│  │  │ - collectFailedPDFs()                     │     │    │
│  │  │ - generateJSON()                          │     │    │
│  │  │ - saveToFile()                            │     │    │
│  │  └───────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                   │
│                           │ Query                             │
│                           ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SQLite Database                                     │    │
│  │  - users, cases, statements, transactions            │    │
│  │  - failed_statements, summary, eod                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                   │
│                           │ Read                              │
│                           ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SystemInformation.js                                │    │
│  │  - collectSystemInfo() → RAM, CPU, OS                │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                   │
│                           │ Read                              │
│                           ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LicenseManager.js                                   │    │
│  │  - getLicenseInfo() → license key, expiry           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Output
                           ▼
              ┌─────────────────────────────┐
              │ cypheredge_metrics_*.json   │
              │ Saved to Downloads folder   │
              └─────────────────────────────┘
                           │
                           │ User action: Email/Upload
                           ▼
              ┌─────────────────────────────┐
              │ CEO Collects Files          │
              └─────────────────────────────┘
                           │
                           │ Run script
                           ▼
              ┌─────────────────────────────┐
              │ aggregate_metrics.py        │
              │ → Excel Report              │
              └─────────────────────────────┘
```

---

### Phase 2 Architecture (Auto-Upload)

```
┌───────────────────────────────────────────────────────────────┐
│                     USER'S ELECTRON APP                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Background Worker (Node.js)                        │    │
│  │                                                      │    │
│  │  setInterval(() => {                                │    │
│  │    const metrics = MetricsService.collect();       │    │
│  │    uploadToDjango(metrics);                        │    │
│  │  }, 24 * 60 * 60 * 1000); // Daily                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                           │
                           │ HTTPS POST
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                     DJANGO BACKEND SERVER                     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Endpoint: POST /api/ingest-metrics/           │    │
│  │                                                      │    │
│  │  @api_view(['POST'])                                │    │
│  │  def ingest_metrics(request):                       │    │
│  │      data = request.data                            │    │
│  │      # Validate + Store in PostgreSQL               │    │
│  │      Metric.objects.create(...)                     │    │
│  │      return Response({'success': True})             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                   │
│                           │ Store                             │
│                           ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PostgreSQL Database                                 │    │
│  │  - user_metrics                                      │    │
│  │  - failed_pdfs                                       │    │
│  │  - usage_statistics                                  │    │
│  │  - device_specs                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Query
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                     CEO DASHBOARD (Web)                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  URL: https://metrics.yourcompany.com/dashboard              │
│                                                               │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐  │
│  │ Total Users  │ PDFs         │ Success Rate │ Errors   │  │
│  │     150      │ Processed    │    94.5%     │   287    │  │
│  │              │   5,234      │              │          │  │
│  └──────────────┴──────────────┴──────────────┴──────────┘  │
│                                                               │
│  📊 Charts: Success rates, error trends, user activity       │
│  📋 Tables: Failed PDFs, top errors, user breakdown           │
│  🔍 Filters: Date range, license, bank, system specs          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## DATA SCHEMA

### Export JSON Format (v1.0)

```json
{
  "export_version": "1.0",
  "export_timestamp": 1730000000000,
  "export_date": "2025-10-27T10:30:00Z",

  "user_info": {
    "email": "user@example.com",
    "email_hash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    "role": "CA",
    "date_joined": "2025-01-15T00:00:00Z",
    "last_login": "2025-10-27T09:00:00Z"
  },

  "system_info": {
    "device_id": "S-1-5-21-1528785399-2081840107-184672005-1001",
    "device_id_hash": "abc123...",
    "hostname": "DESKTOP-FC1RG82",
    "os": {
      "platform": "win32",
      "release": "10.0.19045",
      "arch": "x64"
    },
    "hardware": {
      "ram_total_gb": 8,
      "ram_free_gb": 4,
      "cpu_model": "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
      "cpu_cores": 8,
      "cpu_speed_mhz": 1800
    },
    "compatibility_mode": "UNSCAN"
  },

  "license_info": {
    "license_key_hash": "046322900c3f4e2e8b9d1a7c5f6e3d2a...",
    "license_type": "network_floating",
    "expiry_date": "2025-12-31T23:59:59Z",
    "max_users": 5,
    "max_statements": 20000000,
    "active": true
  },

  "statistics": {
    "total_cases": 5,
    "total_statements_processed": 50,
    "total_statements_failed": 5,
    "total_transactions": 500,
    "success_rate_percent": 90.0,
    "banks_used": ["HDFC", "ICICI", "SBI", "Axis", "Kotak"],
    "reports_generated": 10,
    "tally_exports": 2,
    "date_range": {
      "first_activity": "2025-01-20T00:00:00Z",
      "last_activity": "2025-10-25T18:30:00Z"
    }
  },

  "failed_pdfs": [
    {
      "file_name": "hdfc_statement_corrupted.pdf",
      "bank_type": "HDFC",
      "error_code": "TEXT_EXTRACTION_FAILED",
      "error_message": "Unable to extract text from scanned PDF",
      "error_category": "pdf_processing",
      "timestamp": "2025-10-20T10:30:00Z",
      "system_context": {
        "ram_free_gb": 3.5,
        "cpu_usage_percent": 65
      }
    }
  ],

  "usage_summary": {
    "most_used_bank": "HDFC",
    "avg_transactions_per_statement": 10,
    "total_pages_processed": 750
  }
}
```

---

### Database Schema (Phase 2 - Django/PostgreSQL)

**Django Models**:

```python
# models.py

class UserMetric(models.Model):
    """Stores one metrics export per user"""
    export_id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    email_hash = models.CharField(max_length=64, db_index=True)
    license_key_hash = models.CharField(max_length=64, db_index=True)
    device_id_hash = models.CharField(max_length=64, db_index=True)

    # Statistics (denormalized for fast queries)
    total_statements_processed = models.IntegerField()
    total_statements_failed = models.IntegerField()
    total_transactions = models.IntegerField()
    success_rate_percent = models.FloatField()

    # System info
    os_platform = models.CharField(max_length=50)
    ram_gb = models.FloatField()
    cpu_model = models.CharField(max_length=200)
    compatibility_mode = models.CharField(max_length=20)

    # Timestamps
    export_timestamp = models.DateTimeField(db_index=True)
    date_range_start = models.DateTimeField()
    date_range_end = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

class FailedPDF(models.Model):
    """Stores individual PDF failure events"""
    metric = models.ForeignKey(UserMetric, on_delete=models.CASCADE, related_name='failed_pdfs')
    file_name = models.CharField(max_length=500)
    bank_type = models.CharField(max_length=50, db_index=True)
    error_code = models.CharField(max_length=100, db_index=True)
    error_message = models.TextField()
    error_category = models.CharField(max_length=50)
    timestamp = models.DateTimeField()

    # System context at time of failure
    ram_free_gb = models.FloatField(null=True)
    cpu_usage_percent = models.IntegerField(null=True)

class MetricsSummary(models.Model):
    """Daily aggregated metrics across all users"""
    date = models.DateField(unique=True, db_index=True)
    total_users = models.IntegerField()
    total_pdfs_processed = models.IntegerField()
    total_pdfs_failed = models.IntegerField()
    overall_success_rate = models.FloatField()
    top_errors = models.JSONField()  # List of {error_code, count}

    created_at = models.DateTimeField(auto_now_add=True)
```

---

## IMPLEMENTATION PHASES

### Phase 1: Manual Export (Week 1)
**Timeline**: 1 week
**Effort**: 8-10 hours development + 2-3 hours testing

**Deliverables**:
1. ✅ MetricsExportService.js (collects metrics from SQLite + system info)
2. ✅ Export button in Settings page (React component)
3. ✅ IPC handler for 'metrics:export'
4. ✅ JSON file generation with v1.0 schema
5. ✅ Privacy disclosure in Settings (what's collected)
6. ✅ Python aggregation script (aggregate_metrics.py)
7. ✅ Documentation for users (how to export + share)
8. ✅ Documentation for CEO (how to run aggregation script)

**Tasks**:
| Task | Owner | Hours | Status |
|------|-------|-------|--------|
| Create MetricsExportService.js | Dev | 3 | Not Started |
| Add Export button to Settings UI | Dev | 1 | Not Started |
| Implement IPC handler | Dev | 1 | Not Started |
| Query SQLite for metrics data | Dev | 2 | Not Started |
| Hash sensitive data (email, license key) | Dev | 1 | Not Started |
| Generate JSON file | Dev | 1 | Not Started |
| Write Python aggregation script | Dev | 3 | Not Started |
| Write user documentation | Product | 1 | Not Started |
| Write CEO documentation | Product | 1 | Not Started |
| Testing with beta users | QA | 2 | Not Started |
| **TOTAL** | | **16 hours** | |

**Success Criteria**:
- ✅ Export button works without crashing app
- ✅ JSON file contains all required fields
- ✅ Aggregation script produces Excel report
- ✅ CEO can see aggregated metrics from 10+ users

---

### Phase 1.5: Web Upload Portal (Week 2-3)
**Timeline**: 1-2 weeks
**Effort**: 12-15 hours development + 3-5 hours deployment

**Deliverables**:
1. ✅ Simple web server (Node.js/Express)
2. ✅ Upload page at /upload (drag-and-drop interface)
3. ✅ Dashboard page at /dashboard (aggregated metrics display)
4. ✅ MySQL database for storing uploads
5. ✅ Charts and visualizations (Chart.js)
6. ✅ Deployed to cloud (AWS/DigitalOcean/Heroku)

**Tasks** (Skipped if going straight to Phase 2)

---

### Phase 2: Auto-Upload System (Week 4-6)
**Timeline**: 2-3 weeks
**Effort**: 20-30 hours development + 5-10 hours Django API work

**Deliverables**:
1. ✅ Background metrics collection service (runs daily)
2. ✅ Django API endpoint: POST /api/ingest-metrics/
3. ✅ PostgreSQL models (UserMetric, FailedPDF, MetricsSummary)
4. ✅ Opt-in consent UI in app Settings
5. ✅ CEO dashboard (Django admin + custom views)
6. ✅ Aggregation job (daily summary generation)
7. ✅ Monitoring and alerting (error rate spikes)

**Tasks**:
| Task | Owner | Hours | Status |
|------|-------|-------|--------|
| Implement background worker in Electron | Dev | 4 | Not Started |
| Add opt-in consent UI | Dev | 2 | Not Started |
| Create Django models | Backend | 3 | Not Started |
| Implement /api/ingest-metrics/ endpoint | Backend | 4 | Not Started |
| Build CEO dashboard views | Backend | 6 | Not Started |
| Add charts and visualizations | Backend | 4 | Not Started |
| Implement daily aggregation job | Backend | 3 | Not Started |
| Write tests (Electron + Django) | Dev/Backend | 6 | Not Started |
| Deploy Django to production | DevOps | 3 | Not Started |
| Security audit (API authentication) | Security | 2 | Not Started |
| **TOTAL** | | **37 hours** | |

**Success Criteria**:
- ✅ Metrics auto-upload without user action
- ✅ CEO dashboard shows live data
- ✅ <1% upload failure rate
- ✅ Dashboard loads in <3 seconds

---

## SUCCESS METRICS

### KPIs for Metrics System

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **User Adoption Rate** | >80% of users export metrics | Track: # users who exported / total active users |
| **Export Success Rate** | >95% exports succeed | Track: successful exports / attempted exports |
| **CEO Time Saved** | 2+ hours/week | Compare: time to review individual files vs aggregated report |
| **Data Coverage** | >90% of users represented | Track: # users with metrics / total app installations |
| **Dashboard Load Time** | <3 seconds | Measure: time from page load to fully rendered |
| **Aggregation Accuracy** | 100% correct totals | Test: manually verify sums match individual files |
| **Insight Generation** | CEO can answer 10+ questions | Validate: CEO questionnaire after 1 month |

### Business Impact Metrics

| Metric | Baseline (Before) | Target (After 3 months) |
|--------|-------------------|-------------------------|
| **Informed Product Decisions** | 0% data-driven | 80% data-driven |
| **Error Resolution Time** | Unknown | Reduced 50% (identify systemic issues faster) |
| **User Support Satisfaction** | Unknown | Track via NPS score |
| **Feature Prioritization Accuracy** | Guess-based | Usage data-driven |
| **License Optimization** | Unknown utilization | Identify unused licenses, optimize costs |

---

## RISKS & MITIGATIONS

### Risk 1: Low User Adoption (Manual Export)
**Probability**: High
**Impact**: High
**Description**: Users forget/ignore request to export metrics

**Mitigation**:
- Add reminder notification in app ("Export your usage report - 1 click!")
- Incentivize exports (e.g., "Help us improve" messaging)
- Make export prominent in UI (Settings → first option)
- Send email reminders to users monthly
- Track adoption rate; if <50%, fast-track to Phase 2 (auto-upload)

---

### Risk 2: Privacy Concerns
**Probability**: Medium
**Impact**: High
**Description**: Users refuse to share data due to privacy fears (CA professionals handle sensitive financial data)

**Mitigation**:
- Clear privacy disclosure: "We collect app usage only, NOT your financial data"
- List exactly what IS collected vs what IS NOT
- Hash all PII (emails, license keys)
- Sanitize file paths (remove user directories)
- Optional opt-out checkbox
- Link to full privacy policy
- Transparency: Show users the exported JSON before saving

---

### Risk 3: Export Performance Issues
**Probability**: Medium
**Impact**: Medium
**Description**: Export takes too long (>30 seconds) on large databases, users cancel

**Mitigation**:
- Optimize SQLite queries (use indexes, LIMIT results if needed)
- Show progress indicator with ETA
- Run export in background thread (don't block UI)
- Test with large database (1000+ PDFs) before release
- Add timeout with graceful fallback ("Export took too long, try again later")

---

### Risk 4: Data Loss in Transit
**Probability**: Low (Phase 1), Medium (Phase 2)
**Impact**: Medium
**Description**: JSON file lost in email, upload fails, network error during auto-upload

**Mitigation**:
- **Phase 1**: Instruct users to keep backup copy of JSON file
- **Phase 2**: Implement retry logic (3 attempts with exponential backoff)
- Log upload failures locally, retry on next app launch
- CEO dashboard shows "last seen" timestamp per user to detect missing data

---

### Risk 5: Database Schema Changes Break Export
**Probability**: Medium
**Impact**: High
**Description**: Future app updates change SQLite schema, export code crashes

**Mitigation**:
- Version the export format (v1.0, v1.1, etc.)
- Graceful degradation: if column missing, use null/default
- Add schema version check before export
- Backward compatibility tests (test export with old database versions)

---

### Risk 6: CEO Cannot Interpret Data
**Probability**: Low
**Impact**: High
**Description**: Aggregated report is too technical, CEO doesn't understand insights

**Mitigation**:
- Create executive summary in Excel (plain language, no jargon)
- Add charts/visualizations (easier to understand than tables)
- Provide interpretation guide ("High failure rate for HDFC PDFs means...")
- Train CEO/stakeholders on using dashboard (Phase 2)
- Provide example questions the dashboard can answer

---

## OPEN QUESTIONS

### Technical Questions

1. **Export Frequency**: How often should users export metrics?
   - Daily? (high friction)
   - Weekly? (good balance)
   - Monthly? (low friction but delayed insights)
   - On-demand only? (risk of users forgetting)

2. **Export Size Limits**: What if JSON file is huge (10MB+)?
   - Compress with gzip?
   - Split into multiple files?
   - Limit data to last 90 days only?

3. **Backward Compatibility**: Should export work on old app versions?
   - Support N-1 versions?
   - Require users to update before exporting?

4. **Error Handling**: What if export fails mid-way?
   - Retry automatically?
   - Prompt user to retry?
   - Send error report to support?

### Business Questions

1. **User Incentives**: How to encourage users to export?
   - Financial incentive? (discount on renewal?)
   - Gamification? (badge for contributing metrics?)
   - Just goodwill? ("Help us improve")

2. **Data Retention**: How long to keep metrics in Django DB?
   - 1 year? (sufficient for trends)
   - 3 years? (long-term analysis)
   - Forever? (becomes expensive)

3. **Dashboard Access**: Who should access CEO dashboard?
   - CEO only?
   - CEO + Product team?
   - CEO + Product + Support?
   - Add role-based access control?

4. **Monetization**: Could metrics be used for upselling?
   - Identify power users → offer premium features?
   - Identify struggling users → offer training?

### Privacy & Compliance Questions

1. **GDPR Compliance**: Is GDPR required?
   - Are users in EU?
   - Need data export/deletion features?
   - Need explicit consent (not opt-out)?

2. **Data Anonymization**: Is hashing sufficient?
   - Should we use differential privacy?
   - Should we aggregate at license family level only (no per-user)?

3. **Third-Party Sharing**: Will metrics be shared with partners?
   - If yes, need additional consent
   - If no, state clearly in privacy policy

---

## APPENDIX

### Appendix A: Sample Metrics Export (JSON)

See [Data Schema](#data-schema) section above for full example.

---

### Appendix B: Aggregation Script Pseudocode

```python
# aggregate_metrics.py

import os
import json
import pandas as pd
from datetime import datetime

def load_all_exports(input_dir):
    """Load all JSON exports from directory"""
    exports = []
    for filename in os.listdir(input_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(input_dir, filename)
            with open(filepath, 'r') as f:
                try:
                    data = json.load(f)
                    exports.append(data)
                except json.JSONDecodeError as e:
                    print(f"Error loading {filename}: {e}")
    return exports

def aggregate_statistics(exports):
    """Aggregate statistics across all users"""
    total_users = len(exports)
    total_pdfs = sum(e['statistics']['total_statements_processed'] for e in exports)
    total_failed = sum(e['statistics']['total_statements_failed'] for e in exports)
    success_rate = (total_pdfs - total_failed) / total_pdfs * 100 if total_pdfs > 0 else 0

    return {
        'total_users': total_users,
        'total_pdfs_processed': total_pdfs,
        'total_pdfs_failed': total_failed,
        'overall_success_rate': round(success_rate, 2)
    }

def aggregate_failed_pdfs(exports):
    """Combine all failed PDFs from all users"""
    all_failed = []
    for export in exports:
        user_email = export['user_info']['email']
        for failed_pdf in export.get('failed_pdfs', []):
            all_failed.append({
                'user_email': user_email,
                'file_name': failed_pdf['file_name'],
                'bank_type': failed_pdf['bank_type'],
                'error_message': failed_pdf['error_message'],
                'timestamp': failed_pdf['timestamp']
            })
    return all_failed

def generate_excel_report(exports, output_file):
    """Generate Excel report with multiple sheets"""
    with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
        # Sheet 1: Summary
        summary = aggregate_statistics(exports)
        pd.DataFrame([summary]).to_excel(writer, sheet_name='Summary', index=False)

        # Sheet 2: Failed PDFs
        failed_pdfs = aggregate_failed_pdfs(exports)
        pd.DataFrame(failed_pdfs).to_excel(writer, sheet_name='Failed PDFs', index=False)

        # Sheet 3: Per-User Breakdown
        user_data = [{
            'email': e['user_info']['email'],
            'total_pdfs': e['statistics']['total_statements_processed'],
            'failed_pdfs': e['statistics']['total_statements_failed'],
            'success_rate': e['statistics']['success_rate_percent']
        } for e in exports]
        pd.DataFrame(user_data).to_excel(writer, sheet_name='Users', index=False)

        print(f"Report saved to {output_file}")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Directory with JSON exports')
    parser.add_argument('--output', default='metrics_report.xlsx', help='Output Excel file')
    args = parser.parse_args()

    exports = load_all_exports(args.input)
    print(f"Loaded {len(exports)} user exports")

    generate_excel_report(exports, args.output)
```

---

### Appendix C: Related Documents

- **METRICS_ARCHITECTURE_MASTER_DOCUMENT.md** - Full technical architecture
- **KEY_METRICS_AUDIT_SUMMARY.csv** - Detailed metrics breakdown
- **DATABASE_TABLES_AUDIT.csv** - Database schema analysis
- **METRICS_AUDIT_CURRENT_VS_NEEDED.csv** - Comprehensive metrics comparison

---

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| **Electron App** | Desktop application framework (web tech in native wrapper) |
| **SQLite** | Embedded database (file-based, no server) |
| **Django** | Python web framework (backend API + admin interface) |
| **PostgreSQL** | Relational database (server-based, production) |
| **Hash (SHA256)** | One-way encryption for privacy (can't reverse to original) |
| **Metrics** | Quantitative measurements of app usage and performance |
| **Aggregation** | Combining data from multiple sources into summary |
| **IPC** | Inter-Process Communication (Electron main ↔ renderer) |
| **Opt-In** | User must explicitly agree (vs opt-out = default yes) |
| **GDPR** | EU data privacy regulation |

---

## DOCUMENT CHANGELOG

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-27 | Technical Team | Initial draft for brainstorming |

---

**END OF PRD**
