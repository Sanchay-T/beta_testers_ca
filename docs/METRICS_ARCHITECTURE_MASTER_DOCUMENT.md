# COMPREHENSIVE METRICS ARCHITECTURE & IMPLEMENTATION GUIDE
## CypherEdge CA Application - Complete Technical Documentation

**Document Version**: 1.0
**Date**: October 27, 2025
**Author**: Architecture & Metrics Implementation Team
**Branch Analyzed**: UAT (with cross-reference to main/beta_testers_ca)
**Status**: ✅ PRODUCTION-READY ARCHITECTURE DOCUMENTED

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [The Problem Statement](#the-problem-statement)
3. [Current Architecture Deep Dive](#current-architecture-deep-dive)
4. [.NET Gateway Service Architecture](#net-gateway-service-architecture)
5. [Electron Application Architecture](#electron-application-architecture)
6. [Data Flow & Integration Points](#data-flow-integration-points)
7. [Metrics Implementation Design](#metrics-implementation-design)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Security & Privacy Considerations](#security-privacy-considerations)
10. [Testing & Validation Strategy](#testing-validation-strategy)

---

## EXECUTIVE SUMMARY

### The Challenge
CypherEdge stakeholders need comprehensive metrics to understand:
- **WHO** is using the app (user identity, license families, device grouping)
- **HOW** the app is being used (feature adoption, session patterns, processing volumes)
- **WHAT** is failing (PDF extraction errors, system failures, performance bottlenecks)
- **WHERE** users are struggling (error patterns, workflow abandonment, support needs)

### Current State
- ✅ **Robust Authentication System**: User login with bcrypt, session management, license validation
- ✅ **Network Floating License**: .NET Gateway with session tracking, device fingerprinting
- ✅ **Complete Device Identification**: Windows SID, Hardware UUID, MAC Address, Hostname
- ✅ **Existing Logging Infrastructure**: electron-log, CyphersolLogger, UIFlowLogger (underutilized)
- ❌ **NO Metrics Infrastructure**: Zero usage tracking, no error aggregation, no analytics database
- ❌ **NO License Hierarchy**: Users not grouped by license families, no org/team structure
- ❌ **NO Stakeholder Dashboard**: No centralized view of app health, user behavior, or errors

### The Solution
**Phase 1 (Local SQLite Metrics)**: 2-3 weeks implementation
- Create 5 new database tables for metrics tracking
- Inject metrics collection at 25+ integration points
- Build local metrics dashboard for stakeholders
- Implement data retention and privacy controls

**Phase 2-4 (Optional)**: Remote sync, advanced analytics, real-time monitoring

### Key Insight
**NO major architectural changes required**. The app already collects all necessary identifiers and has mature infrastructure. We just need to add the metrics layer on top.

---

## THE PROBLEM STATEMENT

### Business Context
**Stakeholder Request**: "I need to enable metrics for my stakeholders to view based on who and how the app is being used. A few metrics to start with are: failed PDF, failed extraction errors."

### The Deeper Challenge
Before tracking metrics, we must solve the **identity and grouping problem**:

#### 1. User Identity Hierarchy
```
License Key (The Family/Organization)
  ├── License Metadata
  │   ├── maxUsers: 5 (concurrent)
  │   ├── maxStatements: 20,000,000
  │   ├── expiryDate: 2025-12-31
  │   └── licenseType: "Floating Network"
  │
  ├── Users (Members of the License Family)
  │   ├── User 1: email=john@ca.com, role=CA
  │   ├── User 2: email=jane@ca.com, role=CA
  │   └── User 3: email=admin@ca.com, role=Admin
  │
  └── Devices (PCs under the License)
      ├── Device 1: PC-OFFICE-01, SID=S-1-5-21-xxx
      ├── Device 2: PC-HOME-LAPTOP, SID=S-1-5-21-yyy
      └── Device 3: PC-BACKUP, SID=S-1-5-21-zzz
```

#### 2. Metrics Attribution Challenge
When a PDF fails, we need to answer:
- **WHO**: Which user (email)?
- **WHERE**: Which device (Hostname, Windows SID)?
- **WHICH LICENSE**: Which license family/organization?
- **WHEN**: Timestamp, session duration?
- **WHAT**: Error details, file name, bank type?
- **WHY**: System specs, compatibility mode, resource constraints?

#### 3. Current Gap
**Problem**: Users table has NO `licenseKey` field
```sql
-- CURRENT (Insufficient)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  role TEXT,
  password TEXT,
  dateJoined TIMESTAMP,
  expiryDate TIMESTAMP,
  lastLogin TIMESTAMP
);
-- Missing: licenseKeyHash, deviceId, organizationId
```

**Solution**: Add license hierarchy
```sql
-- PROPOSED (Complete)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  role TEXT,
  password TEXT,
  license_key_hash TEXT,  -- 👈 Links to license family
  device_id TEXT,         -- 👈 Links to device
  dateJoined TIMESTAMP,
  expiryDate TIMESTAMP,
  lastLogin TIMESTAMP
);
```

### Metrics Requirements (Stakeholder Priorities)

#### Tier 1: Critical Metrics (Launch Requirement)
1. **Failed PDF Extraction**
   - Count by user, license, bank type
   - Error messages and stack traces
   - File metadata (size, pages, password-protected)
   - System context (RAM, CPU, compatibility mode)

2. **Failed PDF Upload**
   - File format validation failures
   - Corruption detection
   - Size/permission errors

3. **User Activity Tracking**
   - Login/logout events
   - Session duration
   - Feature usage frequency

4. **License Utilization**
   - Active sessions per license
   - Concurrent user peaks
   - Statement consumption rates

#### Tier 2: Operational Metrics (Post-Launch)
5. **System Performance**
   - PDF processing time (by bank type)
   - Database query latency
   - Memory/CPU usage patterns

6. **Feature Adoption**
   - Report generation frequency
   - Tally export usage
   - Dashboard views by type

7. **Error Patterns**
   - Top 10 errors by frequency
   - Error correlation with system specs
   - Resolution rates

#### Tier 3: Strategic Metrics (Long-term)
8. **User Behavior Analytics**
   - Workflow completion rates
   - Feature discovery patterns
   - Support ticket correlation

9. **Business Intelligence**
   - Customer segmentation (by license type)
   - Churn prediction indicators
   - Upsell opportunities

---

## CURRENT ARCHITECTURE DEEP DIVE

### System Overview Diagram
```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S DESKTOP                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    ELECTRON MAIN PROCESS                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │ │
│  │  │ main.js      │  │ Session      │  │ License      │       │ │
│  │  │ (3,393 LOC)  │  │ Manager      │  │ Manager      │       │ │
│  │  │              │  │ (150 LOC)    │  │ (139 LOC)    │       │ │
│  │  │ - IPC Hub    │  │              │  │              │       │ │
│  │  │ - Window Mgr │  │ - User State │  │ - Validation │       │ │
│  │  │ - Lifecycle  │  │ - Countdown  │  │ - Encryption │       │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │ │
│  │                                                               │ │
│  │  ┌──────────────────────────────────────────────────────────┐│ │
│  │  │        IPC HANDLERS (15 modules, 7,878 total LOC)        ││ │
│  │  │  - authHandlers.js (1,285) - mainDashboard.js (150)     ││ │
│  │  │  - caseDashboard.js (200)  - reportHandlers.js (300)    ││ │
│  │  │  - tallyHandlers.js (400)  - [10 more modules...]       ││ │
│  │  └──────────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              │                                     │
│                              │ IPC                                 │
│                              ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    REACT FRONTEND (Port 3000)                 │ │
│  │  - Login UI              - Dashboard Components               │ │
│  │  - Case Management       - Report Generation                  │ │
│  │  - PDF Upload Interface  - Settings & Configuration           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              │                                     │
│                              │ HTTP                                │
│                              ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              PYTHON FASTAPI BACKEND (Port 7500)              │ │
│  │  - PDF Text Extraction   - Bank Statement Parsing            │ │
│  │  - NLP Entity Recognition - Transaction Categorization       │ │
│  │  - Machine Learning       - Data Validation                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              │                                     │
│                              ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                SQLite DATABASE (Drizzle ORM)                  │ │
│  │  13 Tables: users, cases, statements, transactions, summary, │ │
│  │  eod, failed_statements, categories, tally_voucher, etc.     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (License Validation)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│               .NET GATEWAY SERVICE (Port 7890)                      │
│  - License Validation      - Session Management                     │
│  - Network Floating Licenses - Statement Usage Tracking            │
│  - Device Fingerprinting   - Django Backend Integration            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (License Activation)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│         DJANGO BACKEND (cyphersol.co.in)                            │
│  - License Management      - User Registration                      │
│  - Payment Processing      - Subscription Management                │
│  - Analytics & Metrics     - Support Ticketing                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend Layer
- **Electron v28+**: Desktop app container, native OS integration
- **React 18**: UI components, state management
- **IPC**: Context-isolated communication between main/renderer processes
- **electron-log**: Application logging (currently basic)

#### Backend Layer
- **Python 3.x**: Core processing logic
- **FastAPI**: REST API framework
- **NLP Libraries**: spaCy, NLTK for text extraction
- **PyInstaller**: Production executable bundling

#### Data Layer
- **SQLite**: Local embedded database
- **Drizzle ORM**: Type-safe database queries
- **13 Tables**: Users, cases, statements, transactions, aggregations

#### License Layer
- **.NET 7/8**: Gateway service runtime
- **C#**: License management logic
- **ASP.NET Core**: HTTP API endpoints
- **PostgreSQL (Embedded)**: License state storage
- **Makaretu.Dns**: mDNS service discovery for network licenses

---

## .NET GATEWAY SERVICE ARCHITECTURE

### Overview
The Gateway is a **critical infrastructure component** that manages license validation, session tracking, and usage monitoring. It runs as a Windows Service and provides HTTP APIs for the Electron app.

### Core Components

#### 1. HttpApiServer.cs (1,650 lines)
**Role**: Main API server with all license endpoints

**Key Endpoints**:
```csharp
// Health Check
GET /api/health
→ Returns: HTML health status page

// License Validation
POST /api/validate-license
→ Input: { clientId, uuid, macAddress, hostname }
→ Returns: { status: "OK", license_key, number_of_users, expiry_timestamp }

// License Activation (Initial)
POST /api/activate-license
→ Input: { licenseKey, role, deviceInfo }
→ Calls: Django API at cyphersol.co.in/api/activate-offline-license/
→ Returns: Encrypted license data, saves to clientLicense.enc

// Session Assignment (Network License)
POST /api/license/assign
→ Input: { clientId, uuid, macAddress, hostname, username }
→ Logic: Check activeCount < maxUsers
→ Returns: { success, licenseKey, licenseExpiry, role, activeCount, maxUsers }

// Session Activation (Start Countdown)
POST /api/license/activate-session
→ Input: { clientId, uuid, macAddress, hostname, username }
→ Logic: Mark session Active=true, start heartbeat
→ Returns: { success, remainingSeconds, activeCount }
→ Side Effect: Async Django API call to log session activation

// Session Deactivation (Logout)
POST /api/license/deactivate-session
→ Input: { clientId, uuid, macAddress, hostname, username }
→ Logic: Mark session Active=false, release seat
→ Returns: { success, activeCount }
→ Side Effect: Async Django API call to log session deactivation

// Session Validation (Startup Check)
POST /api/license/validate-session
→ Input: { clientId, uuid, macAddress, hostname, macAddress }
→ Returns: { success, message, activeCount }

// Session Revocation (Force Disconnect)
POST /api/license/revoke-session
→ Input: { sessionKey }
→ Logic: Remove inactive session to free up slot
→ Returns: { success, message }

// Statement Usage Tracking
POST /api/license/use-statement
→ Logic: Increment UsedStatements counter
→ Returns: { success, remaining, used }

GET /api/license/check-statement-limit
→ Returns: { limitReached, remaining }

// All Sessions Dashboard
GET /license/status/all
→ Returns: Beautiful HTML dashboard with all active/inactive sessions
```

**Django Integration** (Lines 935-990, 1051-1108):
```csharp
// Session Activation Event
POST https://cyphersol.co.in/api/activate-license-session/
Body: {
  license_key: "046322900c3f...",
  device_info: { uuid, macAddress, hostname, clientId, username },
  timestamp: 1750327588,
  event_type: "session-activation"
}

// Session Deactivation Event
POST https://cyphersol.co.in/api/deactivate-license-session/
Body: { ...same structure, event_type: "session-deactivation" }

// Clock Tampering Report
POST https://cyphersol.co.in/api/report-clock-tampering/
Body: { license_key, device_info }
```

#### 2. LicenseStateManager.cs (546 lines)
**Role**: In-memory session state tracking and license usage enforcement

**Data Structures**:
```csharp
public class LicenseSession
{
    public string SessionId { get; set; }           // SHA256(UUID + Hostname + ClientId)
    public string ClientId { get; set; }            // Windows User SID
    public string UUID { get; set; }                // Hardware UUID
    public string Hostname { get; set; }            // Computer name
    public string Username { get; set; }            // OS username
    public string MACAddress { get; set; }          // Primary network adapter
    public DateTime AssignedAt { get; set; }        // When license granted
    public DateTime? LastHeartbeat { get; set; }    // Last activity
    public bool Active { get; set; }                // Currently using app?
}

private readonly ConcurrentDictionary<string, LicenseSession> _activeLicenses;
private int _maxLicenses;                           // From LicenseInfo.NumberOfUsers
private int _currentUsedStatements;                 // PDF statement counter
```

**Key Methods**:
- `GenerateSessionKey()`: SHA256(uuid + hostname + windowsUserSID) → unique identifier
- `TryUseLicense()`: Assign session if slots available
- `ReleaseLicense()`: Free up session slot
- `ActivateSession()`: Mark session Active=true, start heartbeat
- `InactivateSession()`: Mark session Active=false, release for revocation
- `RevokeInactiveSession()`: Force-remove session by sessionKey
- `TryUseStatement()`: Increment statement usage, flush to disk every 10 seconds
- `SaveSessionsToDisk()`: Persist sessions to encrypted file
- `LoadSessionsFromDisk()`: Restore sessions on startup (all marked Active=false)

**Statement Usage Tracking** (Lines 335-366):
```csharp
public bool TryUseStatement(out string message)
{
    lock (_lock)
    {
        if (!IsUnlimitedStatements && _currentUsedStatements >= _licenseInfo.NumberOfStatements)
        {
            message = "Statement limit reached.";
            return false;
        }

        _currentUsedStatements++;
        message = "Statement used successfully.";

        // Flush to disk every 10 seconds
        if (DateTime.UtcNow - _lastFlush >= _flushInterval)
        {
            FlushToDisk();  // Updates encrypted license file
        }
        return true;
    }
}
```

#### 3. LicenseInfoProvider.cs (170 lines)
**Role**: License metadata storage and retrieval

**Data Model**:
```csharp
public class LicenseInfo
{
    public string LicenseKey { get; set; }              // Actual license key
    public double CurrentTimestamp { get; set; }         // Server time when activated
    public double ExpiryTimestamp { get; set; }          // License expiry (Unix timestamp)
    public int NumberOfUsers { get; set; }               // Max concurrent users
    public int NumberOfStatements { get; set; }          // Max PDF statements (-1 = unlimited)
    public string Role { get; set; }                     // User role (CA, Admin, etc.)
    public int UsedStatements { get; set; }              // Current statement usage
    public long SystemUpTime { get; set; }               // System boot time (for clock tampering detection)

    public bool IsValid() =>
        !string.IsNullOrWhiteSpace(LicenseKey) &&
        CurrentTimestamp > 0 &&
        ExpiryTimestamp > CurrentTimestamp &&
        NumberOfUsers > 0 &&
        NumberOfStatements != 0;
}
```

**Storage Location**:
- Development: `%AppData%/CyphersolDev/license.enc`
- Production: `%AppData%/Cyphersol/license.enc`
- Format: AES-256 encrypted JSON

**Methods**:
- `LoadLicenseInfo()`: Decrypt and deserialize license file
- `SetExpiry()`: Update expiry timestamp (from polling)
- `SetServerCurrentTime()`: Sync with server time
- `SetSystemUpTime()`: Track system boot time for tampering detection

#### 4. License Polling & Synchronization (Lines 1134-1277)
**Background Task**: Every 3600 seconds (1 hour), sync license status with Django backend

```csharp
private async Task PollLicenseStatusAsync(CancellationToken stoppingToken)
{
    var checkInterval = TimeSpan.FromSeconds(3600);

    while (!stoppingToken.IsCancellationRequested)
    {
        try
        {
            // POST to Django: /api/check-license-status/
            var response = await _httpClient.PostAsync(apiUrl, content);
            var result = JsonSerializer.Deserialize<LicenseStatusResponse>(responseContent);

            // Update in-memory license info
            _licenseInfoProvider.SetExpiry(result.ExpiryTimestamp);
            _licenseInfoProvider.SetServerCurrentTime(result.CurrentTimestamp);
            _licenseStateManager._licenseInfo = _licenseInfoProvider.GetLicenseInfo();
        }
        catch { /* Log error */ }

        await Task.Delay(checkInterval, stoppingToken);
    }
}
```

### Gateway Service Startup Flow

```
Windows Service Manager
        ↓
Program.cs (Worker.cs background service)
        ↓
Initialize Dependencies:
  - LicenseHelper (encryption/decryption)
  - LicenseInfoProvider (load encrypted license file)
  - LicenseStateManager (restore sessions from disk)
  - HttpApiHost (API server)
  - ServiceDiscovery (mDNS broadcasting)
        ↓
Start HTTP API Server (port 7890)
  - Register all endpoints
  - Apply LicenseExpiryMiddleware
        ↓
Start mDNS Service Discovery
  - Broadcast: _license-server._tcp
  - Allow other PCs to discover this license server
        ↓
Start License Polling (1 hour interval)
  - Sync with Django backend
  - Update expiry timestamps
        ↓
Ready for Electron App Connections
```

### Service Discovery (Network Licenses)
**File**: `Worker.cs` (not provided, but referenced in HttpApiServer.cs)

**How It Works**:
1. License server PC runs Gateway as Windows Service
2. mDNS broadcasts `_license-server._tcp` on local network
3. Client PCs discover server via mDNS query (timeout: 5 seconds)
4. Fallback: UDP broadcast on port 41234
5. Client connects to discovered IP:7890

**Discovery Response**:
```json
{
  "ip": "192.168.1.100",
  "port": 7890,
  "licenseKey": "046322900c3f...",
  "maxUsers": 5,
  "activeCount": 2,
  "serviceName": "CypherEdge License Server"
}
```

### License Types Supported

#### Type 1: Direct Local License
**Flow**:
1. User enters license key in Electron app
2. POST to Gateway: `/api/activate-license`
3. Gateway forwards to Django: `cyphersol.co.in/api/activate-offline-license/`
4. Django validates key, returns license metadata
5. Gateway encrypts and saves to `clientLicense.enc`
6. License bound to this specific device (Windows SID + UUID)

**Characteristics**:
- ✅ Single-user, single-device
- ✅ Offline-capable (after activation)
- ✅ No network sharing
- ❌ Cannot transfer to another device without re-activation

#### Type 2: Network Floating License
**Flow**:
1. One PC runs Gateway as License Server
2. Other PCs discover server via mDNS/UDP
3. Client requests session: POST to Server IP:7890/api/license/assign
4. Server checks: activeCount < maxUsers?
5. If available: Assign session, return license metadata
6. If full: Return list of inactive sessions for revocation

**Characteristics**:
- ✅ Multi-user (up to `maxUsers` concurrent)
- ✅ Session-based allocation
- ✅ First-come-first-served
- ✅ Admin can revoke inactive sessions
- ❌ Requires network connectivity
- ❌ Server PC must stay online

### Session Lifecycle (Network License)

```
User opens app
    ↓
POST /api/license/assign
    { clientId, uuid, macAddress, hostname, username }
    ↓
Gateway checks: activeCount < maxUsers?
    ├─ YES: Assign session (Active=false)
    │       Return: { success: true, licenseKey, licenseExpiry, role }
    │
    └─ NO: Return: { success: false, inactiveLicenses: [...] }
           User can request admin to revoke inactive session
    ↓
User logs in successfully
    ↓
POST /api/license/activate-session
    { clientId, uuid, macAddress, hostname, username }
    ↓
Gateway marks session Active=true
    ↓
Start countdown timer (remainingSeconds from license expiry)
    ↓
User works in application
    (session heartbeat tracked by LastHeartbeat timestamp)
    ↓
User clicks Logout OR License expires
    ↓
POST /api/license/deactivate-session
    { clientId, uuid, macAddress, hostname, username }
    ↓
Gateway marks session Active=false
    ↓
Session slot released, available for next user
```

### Django Backend Integration Summary

**Endpoints Called by Gateway**:
1. `POST /api/activate-offline-license/` - Initial license activation
2. `POST /api/activate-license-session/` - Log session start (async, no blocking)
3. `POST /api/deactivate-license-session/` - Log session end (async)
4. `POST /api/check-license-status/` - Hourly license sync
5. `POST /api/report-clock-tampering/` - Security alert

**API Key**: `L4#gP93NEuzyXQFYAGk_KhY2SDHzJJ-O0fqFMlxJ46HZkNLtpdBI.CAgICAgICAk=`
(Hardcoded in HttpApiServer.cs lines 538, 971, 1089)

**Use Case for Metrics**:
- ✅ **Gateway already logs session events to Django**
- ✅ **We can piggyback on this for centralized metrics**
- ✅ **Add new endpoint: `/api/log-metrics/` for PDF failures, feature usage, etc.**

---

## ELECTRON APPLICATION ARCHITECTURE

### Overview (from UAT Branch Audit)
**Branch**: `origin/uat`
**Status**: Mature, well-structured, production-ready codebase

### Core Files Inventory

#### Main Process (Electron Backend)
```
frontend/
├── main.js (3,393 lines) - Application entry point
│   ├── IPC handler registration (all 15 modules)
│   ├── Window management (BrowserWindow)
│   ├── App lifecycle (ready, will-quit, activate)
│   ├── Gateway service initialization
│   ├── Python backend spawning
│   └── Database initialization
│
├── SessionManager.js (150 lines) - User session state
│   ├── setUser(userId, email, role, name)
│   ├── getUser() → current user context
│   ├── startLicenseCountdown(remainingSeconds)
│   ├── stopLicenseCountdown()
│   └── emit('licenseExpired') when countdown reaches 0
│
├── LicenseManager.js (139 lines) - License file management
│   ├── init() → Load encrypted license
│   ├── validateSession() → POST to Gateway /api/license/validate-session
│   ├── getLicenseInfo() → { licenseKey, clientId, uuid, macAddress, port, ip, licenseExpiry }
│   └── isActivated: boolean
│
├── SystemInformation.js (637 lines) - Device fingerprinting
│   ├── computeWindowsUserSID() → Windows SID (S-1-5-21-xxx)
│   ├── collectSystemInfo() → { uuid, macAddress, hostname, username, osInfo }
│   └── getCached data from encrypted files
│
└── InitiateGatewayServer.js (313 lines) - Gateway service lifecycle
    ├── Start/stop Windows Service
    ├── Health checks (/api/health endpoint)
    ├── Process management and logging
    └── Automatic recovery on failure
```

#### IPC Handlers (7,878 total lines across 15 files)
```
frontend/ipc/
├── authHandlers.js (1,285 lines) ⭐ CRITICAL FOR METRICS
│   ├── auth:login (lines 226-312)
│   │   ├── Query users table
│   │   ├── Bcrypt password validation
│   │   ├── Get SystemInformation (clientId, uuid, macAddress)
│   │   ├── POST Gateway: /api/license/activate-session
│   │   ├── SessionManager.setUser()
│   │   └── Return: { success, userId, email, role, remainingSeconds }
│   │
│   ├── auth:signup (lines 340-407)
│   │   ├── Bcrypt hash password
│   │   ├── Insert users table
│   │   └── Return: { success, userId }
│   │
│   ├── auth:logout (lines 314-322)
│   │   ├── POST Gateway: /api/license/deactivate-session
│   │   ├── SessionManager.stopLicenseCountdown()
│   │   └── SessionManager.setUser(null)
│   │
│   ├── license:activate-direct (lines 568-656)
│   │   └── POST Gateway: /api/activate-license → Django validation
│   │
│   └── license:activate-network (lines 658-878)
│       ├── Discover Gateway via mDNS/UDP
│       ├── POST /api/license/assign
│       └── If full: Show inactive sessions for revocation
│
├── mainDashboard.js (~150 lines)
│   ├── dashboard:get-stats
│   ├── dashboard:get-recent-reports
│   └── dashboard:get-user-activity
│
├── caseDashboard.js (~200 lines)
│   ├── case:create
│   ├── case:update
│   ├── case:delete
│   └── case:get-all
│
├── reportHandlers.js (~300 lines)
│   ├── report:generate
│   ├── report:export-excel
│   └── report:export-pdf
│
├── tallyHandlers.js (~400 lines)
│   ├── tally:export
│   └── tally:validate-connection
│
└── [10 more handler files...]
    - fileHandler.js
    - VoucherHandlers.js
    - excelDownloadHandler.js
    - editReportHandlers.js
    - opportunityToEarn.js
    - individualDashboard.js
    - generateReport.js
    - getData.js
    - appLevelIPC.js
```

#### Database Layer (Drizzle ORM)
```
frontend/db/
├── index.js - Database connection, migration runner
├── schema/
│   ├── User.js (18 lines) ⚠️ NEEDS MODIFICATION FOR METRICS
│   │   ├── id: integer (PK)
│   │   ├── name: text (unique)
│   │   ├── email: text (unique)
│   │   ├── role: text (default: "CA")
│   │   ├── password: text (bcrypt hashed)
│   │   ├── dateJoined: timestamp
│   │   ├── expiryDate: timestamp
│   │   └── lastLogin: timestamp (nullable)
│   │   // MISSING: license_key_hash, device_id
│   │
│   ├── Cases.js (19 lines)
│   │   ├── id: integer (PK)
│   │   ├── userId: integer (FK → users.id, CASCADE delete)
│   │   ├── name: text
│   │   ├── status: text
│   │   ├── pages: integer
│   │   ├── createdAt: timestamp
│   │   └── deleted: boolean
│   │
│   ├── Statements.js
│   │   ├── id: integer (PK)
│   │   ├── caseId: integer (FK → cases.id)
│   │   ├── accountNumber: text
│   │   ├── customerName: text
│   │   ├── bankName: text
│   │   ├── filePath: text
│   │   ├── password: text (nullable)
│   │   └── dates: text (JSON)
│   │
│   ├── Transactions.js
│   │   ├── id: integer (PK)
│   │   ├── statementId: integer (FK → statements.id)
│   │   ├── date: text
│   │   ├── description: text
│   │   ├── amount: real
│   │   ├── category: text
│   │   ├── type: text (debit/credit)
│   │   ├── balance: real
│   │   ├── bank: text
│   │   └── entity: text
│   │
│   ├── failed_statements.js ⭐ EXISTING ERROR TRACKING!
│   │   ├── id: integer (PK)
│   │   ├── caseId: integer (FK → cases.id)
│   │   └── data: text (JSON - error details, file info)
│   │
│   └── [8 more tables: summary, eod, categories, category_master,
│       tally_voucher, finance_vouchers, trade_vouchers, opportunity_to_earn]
│
└── drizzle/ - Migration files
```

#### Frontend (React)
```
frontend/react-app/
├── src/
│   ├── contexts/
│   │   └── AuthContext.js (200+ lines)
│   │       ├── useAuth() hook
│   │       ├── login(email, password)
│   │       ├── logout()
│   │       ├── onLicenseExpired() listener
│   │       └── User state management
│   │
│   ├── components/
│   │   ├── login-form.jsx
│   │   ├── activate-license.jsx
│   │   ├── MainDashboard.jsx
│   │   ├── CaseDashboard.jsx
│   │   ├── ReportGenerator.jsx
│   │   └── [many more...]
│   │
│   └── hooks/
│       └── useUILogger.js - UI event tracking (underutilized)
│
└── compatibility.html - 3-mode system UI (SCAN/UNSCAN/HYBRID)
```

#### Backend (Python FastAPI)
```
backend/
├── main.py - FastAPI app entry point
│   ├── POST /analyze-statements-pdf/ (lines 131-203) ⭐ KEY FOR METRICS
│   │   ├── Input: { bank_names, pdf_paths, passwords, start_date, end_date, ca_id }
│   │   ├── Processing: Extract text → Parse transactions → Apply NLP → Categorize
│   │   ├── Output: { sheets_in_json, pdf_paths_not_extracted, ner_results }
│   │   └── Errors: Logged to stdout (not structured)
│   │
│   ├── POST /analyze-statements/ (lines 204-356) - Non-PDF analysis
│   └── [Other endpoints for data validation, export, etc.]
│
└── tax_professional/banks/ - Bank-specific parsing logic
    ├── hdfc.py
    ├── icici.py
    ├── sbi.py
    └── [other banks...]
```

### Existing Logging Infrastructure (UNDERUTILIZED!)

#### 1. electron-log (Currently Active)
**File**: `frontend/main.js` (lines 36-82)
```javascript
const log = require('electron-log');

log.transports.console.level = 'debug';
log.transports.file.level = 'info';
log.transports.file.maxSize = 1002430; // 1MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.file.resolvePathFn = () => path.join(userDataPath, 'logs', 'cyphersol.log');

// Currently logs:
// - App lifecycle events (ready, quit, activate)
// - Error handlers (uncaughtException, unhandledRejection)
// - Database initialization
// - Gateway service startup
```

**Current Usage**: Only basic app lifecycle events, no feature usage tracking

#### 2. CyphersolLogger.js (NOT INTEGRATED!)
**File**: `frontend/utils/logger.js` (448 lines)
**Status**: ⚠️ **Comprehensive logger AVAILABLE but NOT USED**

**Features**:
```javascript
class CyphersolLogger {
  // Standard logging
  trace(component, message, context)
  debug(component, message, context)
  info(component, message, context)
  warn(component, message, context)
  error(component, message, context, error)
  fatal(component, message, context, error)

  // Specialized logging
  buildStart(buildId, context)
  buildEnd(buildId, duration, success, context)
  dbQuery(query, duration, rowCount, context)
  networkRequest(url, method, statusCode, duration, context)
  perfStart(operation) → returns stopFunction
  perfEnd(operation, duration)

  // Configuration
  setContext(sessionId, userId, buildId)
  setLogLevel('trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal')
}

// Log format:
{
  timestamp: '2025-10-27T04:32:15.123Z',
  level: 'INFO',
  component: 'authHandlers',
  message: 'User login successful',
  context: { userId: 123, email: 'user@example.com' },
  sessionId: 'abc123',
  pid: 1234,
  platform: 'win32'
}
```

**WHY NOT USED?**: No clear integration point, requires refactoring IPC handlers

#### 3. UIFlowLogger.js (NOT INTEGRATED!)
**File**: `frontend/utils/UIFlowLogger.js` (483 lines)
**Status**: ⚠️ **UI event tracker AVAILABLE but NOT USED**

**Features**:
```javascript
class UIFlowLogger {
  logNavigation(from, to, userId, context)
  logButtonClick(buttonId, screenId, userId, context)
  logComponentMount(componentName, screenId, userId, context)
  logComponentUnmount(componentName, screenId, userId, context)
  logError(errorMessage, errorStack, componentName, userId, context)
  logFormSubmit(formId, formData, userId, context)
  logApiCall(endpoint, method, statusCode, duration, userId, context)
}

// Output: frontend/logs/ui_flow_${timestamp}.log
// Enable: process.env.UI_FLOW_LOGGING=true
```

**WHY NOT USED?**: React components not instrumented with logger calls

### Authentication & Session Flow (Detailed)

#### Login Flow (authHandlers.js:226-312)
```
1. React: user enters email + password
   ↓
2. IPC: window.electron.auth.login(email, password)
   ↓
3. authHandlers.js: handle('auth:login')
   ↓
4. Query: SELECT * FROM users WHERE name = email
   ↓
5. Validate: bcrypt.compare(password, user.password)
   ↓
6. Device Info: SystemInformation.getCached()
   → { clientId, uuid, macAddress, hostname, username }
   ↓
7. Gateway API: POST http://{ip}:{port}/api/license/activate-session
   Request: { clientId, uuid, macAddress, hostname, username }
   Response: { success: true, remainingSeconds: 3600 }
   ↓
8. Session Manager: sessionManager.setUser({ userId, email, role, name })
   ↓
9. Session Manager: sessionManager.startLicenseCountdown(remainingSeconds)
   → setInterval(1000ms) → emit 'remainingSecondsUpdated'
   → At 0: emit 'licenseExpired' → Force logout
   ↓
10. React: Receives success, navigates to dashboard
    ↓
11. ⚠️ MISSING: No metrics logged!
    ⚠️ MISSING: No license_key_hash stored in users table!
    ⚠️ MISSING: No device_id associated with user!
```

#### Logout Flow (authHandlers.js:314-322)
```
1. React: user clicks Logout
   ↓
2. IPC: window.electron.auth.logout()
   ↓
3. authHandlers.js: handle('auth:logout')
   ↓
4. Device Info: SystemInformation.getCached()
   ↓
5. Gateway API: POST http://{ip}:{port}/api/license/deactivate-session
   Request: { clientId, uuid, macAddress, hostname, username }
   Response: { success: true, activeCount: 2 }
   ↓
6. Session Manager: sessionManager.stopLicenseCountdown()
   ↓
7. Session Manager: sessionManager.setUser(null)
   ↓
8. React: Navigates to login screen
   ↓
9. ⚠️ MISSING: No session duration logged!
    ⚠️ MISSING: No logout event tracked!
```

### PDF Processing Flow (Critical for Error Metrics)

#### Endpoint: POST /analyze-statements-pdf/
**File**: `backend/main.py` (lines 131-203)

```python
@app.post("/analyze-statements-pdf/")
async def analyze_statements_pdf(request: StatementRequest):
    # Input: bank_names, pdf_paths, passwords, start_date, end_date, ca_id

    # ⚠️ KEY FOR METRICS: ca_id is the user identifier!
    ca_id = request.ca_id

    # 1. Save PDFs to temp directory with ca_id prefix
    temp_paths = []
    for pdf_path, password in zip(request.pdf_paths, request.passwords):
        temp_path = f"{DATA_DIR}/{ca_id}_{random_filename}.pdf"
        shutil.copy(pdf_path, temp_path)
        temp_paths.append(temp_path)

    # 2. Process each PDF
    results = []
    failed_pdfs = []  # ⭐ ERROR TRACKING!

    for bank_name, pdf_path, password in zip(...):
        try:
            # Extract text
            text = extract_text_from_pdf(pdf_path, password)

            # Parse transactions (bank-specific logic)
            parser = get_bank_parser(bank_name)
            transactions = parser.parse(text, start_date, end_date)

            # Apply NLP entity recognition
            entities = ner_model.extract_entities(text)

            # Categorize transactions
            categorized = categorizer.categorize(transactions)

            results.append({
                "bank": bank_name,
                "file": pdf_path,
                "transactions": categorized,
                "entities": entities
            })

        except Exception as e:
            # ⭐ ERROR CAPTURED BUT NOT LOGGED TO DATABASE!
            failed_pdfs.append({
                "file": pdf_path,
                "bank": bank_name,
                "error": str(e)
            })
            logging.error(f"PDF extraction failed: {str(e)}")

    # 3. Return results
    return {
        "sheets_in_json": results,
        "pdf_paths_not_extracted": failed_pdfs,  # ⭐ ERROR LIST!
        "ner_results": entities
    }
```

**Current Error Handling**:
- ✅ Errors captured in `failed_pdfs` array
- ✅ Logged to stdout via `logging.error()`
- ❌ **NOT stored in database** (only stored later in `failed_statements` table by Electron)
- ❌ **NO structured error tracking** (no error codes, severity, context)

### Integration Points for Metrics (25+ Locations)

#### High Priority (Must Instrument)
1. **authHandlers.js:login** - Track successful/failed logins
2. **authHandlers.js:logout** - Track session duration
3. **mainDashboard.js** - Track dashboard views
4. **caseDashboard.js** - Track case creation, editing
5. **reportHandlers.js** - Track report generation frequency
6. **tallyHandlers.js** - Track Tally export usage
7. **backend/main.py:analyze-statements-pdf** - Track PDF success/failure
8. **All IPC handlers catch blocks** - Track errors

#### Medium Priority
9. **fileHandler.js** - Track file operations
10. **excelDownloadHandler.js** - Track Excel export usage
11. **opportunityToEarn.js** - Track opportunity analysis usage
12. **individualDashboard.js** - Track individual user dashboard usage
13. **SessionManager.js:startLicenseCountdown** - Track license usage patterns
14. **LicenseManager.js:validateSession** - Track validation failures

#### Low Priority (Nice to Have)
15. **React component mounts** - Track UI navigation
16. **Button clicks** - Track feature discovery
17. **Form submissions** - Track data entry patterns
18. **Search queries** - Track user intent

---

## DATA FLOW & INTEGRATION POINTS

### Complete User Journey with Metrics Capture Points

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

1. APPLICATION STARTUP
   ├─ Electron main.js init
   ├─ Load encrypted license file
   ├─ Validate session with Gateway
   ├─ Start Python backend (port 7500)
   └─ 📊 METRICS: App start event, startup duration

2. USER LOGIN
   ├─ React: LoginForm.jsx → email + password
   ├─ IPC: auth:login
   ├─ Query users table
   ├─ Bcrypt validation
   ├─ Gateway: activate-session API call
   ├─ SessionManager.setUser()
   └─ 📊 METRICS:
       ├─ Login success/failure
       ├─ User email, role
       ├─ Device info (clientId, uuid, hostname)
       ├─ License key (from Gateway response) ⚠️ MUST STORE!
       ├─ Session start timestamp
       └─ License countdown value

3. DASHBOARD VIEW
   ├─ React: MainDashboard.jsx mount
   ├─ IPC: dashboard:get-stats
   ├─ Query: cases, statements, transactions counts
   ├─ Render: charts, recent reports
   └─ 📊 METRICS:
       ├─ Dashboard view event
       ├─ Features visible to user
       └─ Time spent on dashboard

4. PDF UPLOAD & PROCESSING
   ├─ React: FileUploader → select PDFs
   ├─ HTTP POST: localhost:7500/analyze-statements-pdf/
   ├─ Backend: Extract text → Parse → NLP → Categorize
   ├─ Success: Return transactions JSON
   ├─ Failure: Return failed_pdfs array
   ├─ Electron: Store results in statements/transactions tables
   └─ 📊 METRICS:
       ├─ PDF upload event (file count, total size)
       ├─ Bank types selected
       ├─ Processing duration per PDF
       ├─ Success rate (by bank, by file size)
       ├─ ⭐ FAILURE DETAILS:
       │   ├─ Error message
       │   ├─ Error stack trace
       │   ├─ File metadata (name, size, pages)
       │   ├─ User context (userId, email, device_id)
       │   ├─ License context (license_key_hash)
       │   ├─ System context (RAM, CPU, compatibility mode)
       │   └─ Timestamp
       └─ Store in failed_statements table (already exists) + NEW metrics table

5. REPORT GENERATION
   ├─ React: ReportGenerator.jsx → select case, format
   ├─ IPC: report:generate
   ├─ Query: transactions, summary, eod tables
   ├─ Generate: Excel/PDF report file
   ├─ Save: to user-selected directory
   └─ 📊 METRICS:
       ├─ Report generation event
       ├─ Report type (summary, detailed, custom)
       ├─ Export format (Excel, PDF)
       ├─ Generation duration
       └─ File size

6. TALLY EXPORT
   ├─ React: TallyIntegration.jsx → configure mapping
   ├─ IPC: tally:export
   ├─ Generate: Tally XML format
   ├─ Save: to Tally data directory
   └─ 📊 METRICS:
       ├─ Tally export event
       ├─ Voucher count
       ├─ Export duration
       └─ Success/failure

7. USER LOGOUT
   ├─ React: User clicks Logout
   ├─ IPC: auth:logout
   ├─ Gateway: deactivate-session API call
   ├─ SessionManager.stopLicenseCountdown()
   ├─ SessionManager.setUser(null)
   └─ 📊 METRICS:
       ├─ Logout event
       ├─ Session duration (login to logout)
       ├─ Features used during session
       ├─ Data processed (PDF count, transactions)
       └─ License usage (time remaining)

8. LICENSE EXPIRATION (Forced Logout)
   ├─ SessionManager countdown reaches 0
   ├─ Emit: 'licenseExpired' event
   ├─ React: onLicenseExpired() callback
   ├─ Force logout → Login screen
   └─ 📊 METRICS:
       ├─ License expiration event
       ├─ Session duration
       ├─ Work lost (unsaved changes?)
       └─ User frustration indicator

9. ERROR EVENTS (Critical for Support)
   ├─ PDF extraction failure
   ├─ Database query error
   ├─ Network connectivity issue
   ├─ License validation failure
   ├─ Gateway service unavailable
   └─ 📊 METRICS:
       ├─ Error type and severity
       ├─ Error message and stack trace
       ├─ User context (userId, email)
       ├─ System context (OS, RAM, CPU)
       ├─ Action context (what user was doing)
       └─ Recovery success (did retry work?)
```

### License Key Capture Flow (CRITICAL FOR METRICS)

**Current Problem**: License key is returned by Gateway but NOT stored in database

**Gateway Response** (HttpApiServer.cs:793-807):
```json
{
  "success": true,
  "clientId": "S-1-5-21-xxx",
  "message": "License successfully assigned.",
  "licenseKey": "046322900c3f4e2e8b9d1a7c5f6e3d2a",  ⬅️ THIS IS RETURNED!
  "licenseExpiry": 1755322921,
  "role": "CA",
  "assignedAt": "2025-10-27T04:32:15.123Z",
  "lastHeartbeat": "2025-10-27T04:32:15.123Z",
  "activeCount": 3,
  "maxUsers": 5
}
```

**Current Flow** (authHandlers.js:658-878):
```javascript
// Network license activation
const response = await axios.post(`http://${ip}:${port}/api/license/assign`, {
  clientId, uuid, macAddress, hostname, username
});

if (response.data.success) {
  const { licenseKey, licenseExpiry, role, remainingSeconds } = response.data;

  // ⚠️ PROBLEM: licenseKey is received but NOT STORED!

  // Only store in LicenseManager (encrypted file):
  licenseManager.setLicenseData({
    clientId, uuid, macAddress, hostname, username,
    licenseKey,  // ⬅️ Stored in encrypted file
    licenseExpiry,
    ip, port
  });

  // Start session countdown
  sessionManager.startLicenseCountdown(remainingSeconds);

  // ⚠️ MISSING: Should also store in database!
  // await db.update(users)
  //   .set({ license_key_hash: hash(licenseKey), last_login: new Date() })
  //   .where(eq(users.id, userId));
}
```

**Proposed Fix**:
```javascript
// After successful license assignment
if (response.data.success) {
  const { licenseKey, licenseExpiry, role } = response.data;

  // 1. Hash license key for privacy
  const licenseKeyHash = crypto.createHash('sha256')
    .update(licenseKey)
    .digest('hex');

  // 2. Store in encrypted file (existing)
  licenseManager.setLicenseData({ ...data, licenseKey });

  // 3. Update users table with license association
  await db.update(users)
    .set({
      license_key_hash: licenseKeyHash,
      device_id: SystemInformation.getCached().clientId,
      last_login: new Date()
    })
    .where(eq(users.id, userId));

  // 4. Log metrics event
  await metricsService.logEvent({
    event_type: 'license_activated',
    user_id: userId,
    license_key_hash: licenseKeyHash,
    device_id: deviceId,
    details: { licenseExpiry, role, activeCount, maxUsers }
  });
}
```

---

## METRICS IMPLEMENTATION DESIGN

### Database Schema (5 New Tables)

#### 1. license_keys Table
**Purpose**: Track license families and their metadata

```sql
CREATE TABLE license_keys (
  license_key_hash TEXT PRIMARY KEY,       -- SHA256(license_key) for privacy
  license_type TEXT NOT NULL,              -- 'direct' | 'network_floating'
  max_users INTEGER NOT NULL,               -- Concurrent user limit
  max_statements INTEGER NOT NULL,          -- PDF statement limit (-1 = unlimited)
  max_devices INTEGER,                      -- Total device limit (nullable)
  role TEXT NOT NULL,                       -- 'CA' | 'Admin' | 'User'
  expiry_date INTEGER NOT NULL,             -- Unix timestamp
  created_at INTEGER NOT NULL,              -- Unix timestamp
  last_used_at INTEGER,                     -- Unix timestamp (nullable)
  active_users_count INTEGER DEFAULT 0,     -- Current active sessions
  total_statements_used INTEGER DEFAULT 0,  -- Lifetime statement usage
  status TEXT DEFAULT 'active'              -- 'active' | 'expired' | 'revoked'
);

CREATE INDEX idx_license_keys_status ON license_keys(status);
CREATE INDEX idx_license_keys_expiry ON license_keys(expiry_date);
```

#### 2. devices Table
**Purpose**: Track all devices that have connected under each license

```sql
CREATE TABLE devices (
  device_id TEXT PRIMARY KEY,              -- Windows SID or UUID (unique per device)
  license_key_hash TEXT NOT NULL,          -- FK to license_keys
  hostname TEXT NOT NULL,
  mac_address TEXT,
  windows_sid TEXT,
  hardware_uuid TEXT,
  os_info TEXT,                            -- JSON: { platform, release, arch }
  compatibility_mode TEXT,                 -- 'SCAN' | 'UNSCAN' | 'HYBRID'
  system_specs TEXT,                       -- JSON: { ram, cpu, disk }
  first_seen INTEGER NOT NULL,             -- Unix timestamp
  last_seen INTEGER,                       -- Unix timestamp (nullable)
  total_sessions INTEGER DEFAULT 0,
  FOREIGN KEY (license_key_hash) REFERENCES license_keys(license_key_hash) ON DELETE CASCADE
);

CREATE INDEX idx_devices_license ON devices(license_key_hash);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
```

#### 3. user_sessions Table
**Purpose**: Track individual login sessions with license/device association

```sql
CREATE TABLE user_sessions (
  session_id TEXT PRIMARY KEY,             -- UUID v4
  user_id INTEGER NOT NULL,                -- FK to users
  license_key_hash TEXT NOT NULL,          -- FK to license_keys
  device_id TEXT NOT NULL,                 -- FK to devices
  login_time INTEGER NOT NULL,             -- Unix timestamp
  logout_time INTEGER,                     -- Unix timestamp (nullable, NULL if still active)
  session_duration_seconds INTEGER,        -- Calculated on logout
  license_remaining_seconds INTEGER,       -- Countdown value at login
  total_pdfs_processed INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_reports_generated INTEGER DEFAULT 0,
  logout_reason TEXT,                      -- 'manual' | 'license_expired' | 'error' | 'forced'
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (license_key_hash) REFERENCES license_keys(license_key_hash) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_license ON user_sessions(license_key_hash);
CREATE INDEX idx_user_sessions_device ON user_sessions(device_id);
CREATE INDEX idx_user_sessions_login_time ON user_sessions(login_time);
```

#### 4. usage_metrics Table
**Purpose**: Track individual user actions (feature usage, errors, events)

```sql
CREATE TABLE usage_metrics (
  metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,                -- FK to user_sessions
  user_id INTEGER NOT NULL,                -- FK to users (denormalized for perf)
  license_key_hash TEXT NOT NULL,          -- FK to license_keys (denormalized)
  device_id TEXT NOT NULL,                 -- FK to devices (denormalized)
  event_type TEXT NOT NULL,                -- 'pdf_upload' | 'pdf_failed' | 'report_generated' | etc.
  event_category TEXT NOT NULL,            -- 'feature_usage' | 'error' | 'performance' | 'navigation'
  event_data TEXT,                         -- JSON with event-specific details
  timestamp INTEGER NOT NULL,              -- Unix timestamp (milliseconds for precision)
  FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (license_key_hash) REFERENCES license_keys(license_key_hash) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX idx_usage_metrics_session ON usage_metrics(session_id);
CREATE INDEX idx_usage_metrics_user ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_license ON usage_metrics(license_key_hash);
CREATE INDEX idx_usage_metrics_event_type ON usage_metrics(event_type);
CREATE INDEX idx_usage_metrics_timestamp ON usage_metrics(timestamp);
CREATE INDEX idx_usage_metrics_category ON usage_metrics(event_category);
```

**Example event_data JSON structures**:

```json
// PDF Upload Success
{
  "file_name": "hdfc_statement_jan2025.pdf",
  "file_size_bytes": 2456789,
  "bank_type": "HDFC",
  "pages": 15,
  "processing_duration_ms": 4523,
  "transactions_extracted": 234
}

// PDF Extraction Failed ⭐ CRITICAL
{
  "file_name": "icici_statement.pdf",
  "file_size_bytes": 3456789,
  "bank_type": "ICICI",
  "error_code": "TEXT_EXTRACTION_FAILED",
  "error_message": "Unable to extract text from scanned PDF",
  "error_stack": "Traceback...",
  "password_protected": true,
  "system_context": {
    "ram_gb": 8,
    "cpu": "i5-8250U",
    "compatibility_mode": "UNSCAN"
  }
}

// Report Generated
{
  "report_type": "summary",
  "export_format": "excel",
  "case_id": 123,
  "transactions_count": 567,
  "generation_duration_ms": 2341,
  "file_size_bytes": 124567
}

// Dashboard View
{
  "dashboard_type": "main",
  "view_duration_ms": 45678,
  "interactions": ["case_clicked", "report_downloaded"]
}
```

#### 5. error_log Table
**Purpose**: Comprehensive error tracking with severity levels

```sql
CREATE TABLE error_log (
  error_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,                         -- FK to user_sessions (nullable if app-level error)
  user_id INTEGER,                         -- FK to users (nullable)
  license_key_hash TEXT,                   -- FK to license_keys (nullable)
  device_id TEXT,                          -- FK to devices (nullable)
  error_code TEXT NOT NULL,                -- 'PDF_EXTRACTION_FAILED' | 'DB_QUERY_ERROR' | etc.
  error_message TEXT NOT NULL,
  error_stack TEXT,                        -- Full stack trace
  error_severity TEXT NOT NULL,            -- 'debug' | 'info' | 'warning' | 'error' | 'fatal'
  error_category TEXT NOT NULL,            -- 'pdf_processing' | 'database' | 'network' | 'license' | 'ui'
  context TEXT,                            -- JSON with error context
  timestamp INTEGER NOT NULL,              -- Unix timestamp (milliseconds)
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (license_key_hash) REFERENCES license_keys(license_key_hash) ON DELETE SET NULL,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
);

CREATE INDEX idx_error_log_session ON error_log(session_id);
CREATE INDEX idx_error_log_user ON error_log(user_id);
CREATE INDEX idx_error_log_code ON error_log(error_code);
CREATE INDEX idx_error_log_severity ON error_log(error_severity);
CREATE INDEX idx_error_log_category ON error_log(error_category);
CREATE INDEX idx_error_log_timestamp ON error_log(timestamp);
CREATE INDEX idx_error_log_resolved ON error_log(resolved);
```

**Example context JSON**:
```json
{
  "action": "analyze_pdf",
  "component": "authHandlers.js",
  "function": "handlePDFUpload",
  "line": 456,
  "user_action": "Clicked 'Upload PDFs' button",
  "system_state": {
    "memory_usage_mb": 1024,
    "cpu_usage_percent": 67,
    "active_sessions": 3
  },
  "error_context": {
    "file_path": "C:\\Users\\...\\statement.pdf",
    "retry_count": 2,
    "last_successful_pdf": "hdfc_jan2025.pdf"
  }
}
```

### Updated Users Table Schema
```sql
-- Add columns to existing users table
ALTER TABLE users ADD COLUMN license_key_hash TEXT;
ALTER TABLE users ADD COLUMN device_id TEXT;
ALTER TABLE users ADD COLUMN current_session_id TEXT;

-- Create indexes
CREATE INDEX idx_users_license ON users(license_key_hash);
CREATE INDEX idx_users_device ON users(device_id);
```

### MetricsService Class Design

**File**: `frontend/services/MetricsService.js` (NEW)

```javascript
const crypto = require('crypto');
const { db } = require('../db');
const { usageMetrics, errorLog, userSessions, devices, licenseKeys } = require('../db/schema');
const log = require('electron-log');
const { eq, and, gte, lte, desc } = require('drizzle-orm');

class MetricsService {
  constructor() {
    this.currentSessionId = null;
    this.sessionStartTime = null;
    this.metricsBuffer = [];  // Buffer metrics for batch insertion
    this.flushInterval = 5000;  // Flush every 5 seconds
    this.startFlushTimer();
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  async startSession(userId, email, licenseKey, deviceInfo) {
    const sessionId = this.generateSessionId();
    const licenseKeyHash = this.hashLicenseKey(licenseKey);
    const deviceId = deviceInfo.clientId;  // Windows SID
    const loginTime = Date.now();

    // 1. Ensure license_keys entry exists
    await this.upsertLicenseKey(licenseKey, deviceInfo);

    // 2. Ensure devices entry exists
    await this.upsertDevice(licenseKeyHash, deviceInfo);

    // 3. Create session record
    await db.insert(userSessions).values({
      session_id: sessionId,
      user_id: userId,
      license_key_hash: licenseKeyHash,
      device_id: deviceId,
      login_time: loginTime,
      license_remaining_seconds: deviceInfo.remainingSeconds || 0
    });

    // 4. Update users table with current session
    await db.update(users)
      .set({
        license_key_hash: licenseKeyHash,
        device_id: deviceId,
        current_session_id: sessionId,
        last_login: loginTime
      })
      .where(eq(users.id, userId));

    // 5. Set instance state
    this.currentSessionId = sessionId;
    this.sessionStartTime = loginTime;

    // 6. Log event
    await this.logEvent('session_started', {
      user_id: userId,
      email,
      device_info: deviceInfo
    });

    log.info(`[MetricsService] Session started: ${sessionId} for user ${userId}`);
    return sessionId;
  }

  async endSession(logoutReason = 'manual') {
    if (!this.currentSessionId) {
      log.warn('[MetricsService] No active session to end');
      return;
    }

    const logoutTime = Date.now();
    const sessionDuration = Math.floor((logoutTime - this.sessionStartTime) / 1000);

    // 1. Get session stats from usage_metrics
    const sessionStats = await this.getSessionStats(this.currentSessionId);

    // 2. Update session record
    await db.update(userSessions)
      .set({
        logout_time: logoutTime,
        session_duration_seconds: sessionDuration,
        total_pdfs_processed: sessionStats.pdfsProcessed,
        total_transactions: sessionStats.transactionsCount,
        total_reports_generated: sessionStats.reportsGenerated,
        logout_reason: logoutReason
      })
      .where(eq(userSessions.session_id, this.currentSessionId));

    // 3. Log event
    await this.logEvent('session_ended', {
      session_duration_seconds: sessionDuration,
      logout_reason: logoutReason,
      stats: sessionStats
    });

    // 4. Flush any buffered metrics
    await this.flush();

    log.info(`[MetricsService] Session ended: ${this.currentSessionId}, duration: ${sessionDuration}s`);

    this.currentSessionId = null;
    this.sessionStartTime = null;
  }

  // ============================================================
  // EVENT LOGGING
  // ============================================================

  async logEvent(eventType, eventData, category = 'feature_usage') {
    if (!this.currentSessionId) {
      log.warn(`[MetricsService] No active session, event not logged: ${eventType}`);
      return;
    }

    const session = await this.getSessionContext();
    const metric = {
      session_id: this.currentSessionId,
      user_id: session.user_id,
      license_key_hash: session.license_key_hash,
      device_id: session.device_id,
      event_type: eventType,
      event_category: category,
      event_data: JSON.stringify(eventData),
      timestamp: Date.now()
    };

    // Add to buffer for batch insertion
    this.metricsBuffer.push(metric);

    // If buffer is large, flush immediately
    if (this.metricsBuffer.length >= 50) {
      await this.flush();
    }
  }

  async logError(errorCode, errorMessage, errorStack, context, severity = 'error', category = 'general') {
    const session = await this.getSessionContext();

    await db.insert(errorLog).values({
      session_id: this.currentSessionId,
      user_id: session?.user_id,
      license_key_hash: session?.license_key_hash,
      device_id: session?.device_id,
      error_code: errorCode,
      error_message: errorMessage,
      error_stack: errorStack,
      error_severity: severity,
      error_category: category,
      context: JSON.stringify(context),
      timestamp: Date.now()
    });

    log.error(`[MetricsService] Error logged: ${errorCode} - ${errorMessage}`);
  }

  // ============================================================
  // FEATURE-SPECIFIC LOGGING
  // ============================================================

  async logPDFUpload(fileCount, totalSize, bankTypes) {
    await this.logEvent('pdf_upload', {
      file_count: fileCount,
      total_size_bytes: totalSize,
      bank_types: bankTypes
    }, 'feature_usage');
  }

  async logPDFSuccess(fileName, fileSize, bankType, processingTime, transactionsCount) {
    await this.logEvent('pdf_success', {
      file_name: fileName,
      file_size_bytes: fileSize,
      bank_type: bankType,
      processing_duration_ms: processingTime,
      transactions_extracted: transactionsCount
    }, 'feature_usage');

    // Update session stats
    await this.incrementSessionStat('total_pdfs_processed');
  }

  async logPDFFailure(fileName, fileSize, bankType, errorMessage, errorStack, systemContext) {
    await this.logEvent('pdf_failed', {
      file_name: fileName,
      file_size_bytes: fileSize,
      bank_type: bankType,
      error_message: errorMessage,
      error_stack: errorStack,
      system_context: systemContext
    }, 'error');

    await this.logError(
      'PDF_EXTRACTION_FAILED',
      errorMessage,
      errorStack,
      { file_name: fileName, bank_type: bankType, system_context: systemContext },
      'error',
      'pdf_processing'
    );
  }

  async logReportGenerated(reportType, exportFormat, caseId, transactionsCount, duration, fileSize) {
    await this.logEvent('report_generated', {
      report_type: reportType,
      export_format: exportFormat,
      case_id: caseId,
      transactions_count: transactionsCount,
      generation_duration_ms: duration,
      file_size_bytes: fileSize
    }, 'feature_usage');

    await this.incrementSessionStat('total_reports_generated');
  }

  async logDashboardView(dashboardType, viewDuration) {
    await this.logEvent('dashboard_view', {
      dashboard_type: dashboardType,
      view_duration_ms: viewDuration
    }, 'navigation');
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  async flush() {
    if (this.metricsBuffer.length === 0) return;

    try {
      await db.insert(usageMetrics).values(this.metricsBuffer);
      log.info(`[MetricsService] Flushed ${this.metricsBuffer.length} metrics to database`);
      this.metricsBuffer = [];
    } catch (error) {
      log.error('[MetricsService] Error flushing metrics:', error);
    }
  }

  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  hashLicenseKey(licenseKey) {
    return crypto.createHash('sha256').update(licenseKey).digest('hex');
  }

  generateSessionId() {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  async getSessionContext() {
    if (!this.currentSessionId) return null;

    const session = await db.select()
      .from(userSessions)
      .where(eq(userSessions.session_id, this.currentSessionId))
      .limit(1);

    return session[0] || null;
  }

  async getSessionStats(sessionId) {
    // Query usage_metrics for this session
    const stats = await db.select()
      .from(usageMetrics)
      .where(eq(usageMetrics.session_id, sessionId));

    return {
      pdfsProcessed: stats.filter(m => m.event_type === 'pdf_success').length,
      transactionsCount: stats
        .filter(m => m.event_type === 'pdf_success')
        .reduce((sum, m) => sum + (JSON.parse(m.event_data).transactions_extracted || 0), 0),
      reportsGenerated: stats.filter(m => m.event_type === 'report_generated').length
    };
  }

  async incrementSessionStat(statName) {
    if (!this.currentSessionId) return;

    const updateData = {};
    updateData[statName] = db.raw(`${statName} + 1`);

    await db.update(userSessions)
      .set(updateData)
      .where(eq(userSessions.session_id, this.currentSessionId));
  }

  async upsertLicenseKey(licenseKey, deviceInfo) {
    const licenseKeyHash = this.hashLicenseKey(licenseKey);

    // Check if exists
    const existing = await db.select()
      .from(licenseKeys)
      .where(eq(licenseKeys.license_key_hash, licenseKeyHash))
      .limit(1);

    if (existing.length === 0) {
      // Insert new
      await db.insert(licenseKeys).values({
        license_key_hash: licenseKeyHash,
        license_type: deviceInfo.licenseType || 'network_floating',
        max_users: deviceInfo.maxUsers || 5,
        max_statements: deviceInfo.maxStatements || -1,
        role: deviceInfo.role || 'CA',
        expiry_date: deviceInfo.licenseExpiry || 0,
        created_at: Date.now(),
        status: 'active'
      });
    } else {
      // Update last_used_at, increment active_users_count
      await db.update(licenseKeys)
        .set({
          last_used_at: Date.now(),
          active_users_count: db.raw('active_users_count + 1')
        })
        .where(eq(licenseKeys.license_key_hash, licenseKeyHash));
    }
  }

  async upsertDevice(licenseKeyHash, deviceInfo) {
    const deviceId = deviceInfo.clientId;

    // Check if exists
    const existing = await db.select()
      .from(devices)
      .where(eq(devices.device_id, deviceId))
      .limit(1);

    if (existing.length === 0) {
      // Insert new
      await db.insert(devices).values({
        device_id: deviceId,
        license_key_hash: licenseKeyHash,
        hostname: deviceInfo.hostname,
        mac_address: deviceInfo.macAddress,
        windows_sid: deviceInfo.clientId,
        hardware_uuid: deviceInfo.uuid,
        os_info: JSON.stringify(deviceInfo.osInfo || {}),
        compatibility_mode: deviceInfo.compatibilityMode || 'SCAN',
        system_specs: JSON.stringify(deviceInfo.systemSpecs || {}),
        first_seen: Date.now()
      });
    } else {
      // Update last_seen, increment total_sessions
      await db.update(devices)
        .set({
          last_seen: Date.now(),
          total_sessions: db.raw('total_sessions + 1')
        })
        .where(eq(devices.device_id, deviceId));
    }
  }

  // ============================================================
  // ANALYTICS & REPORTING
  // ============================================================

  async getDashboardMetrics(licenseKeyHash, startDate, endDate) {
    // This would be used by stakeholder dashboard
    // Returns aggregated metrics for a license family

    const sessions = await db.select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.license_key_hash, licenseKeyHash),
          gte(userSessions.login_time, startDate),
          lte(userSessions.login_time, endDate)
        )
      );

    const errors = await db.select()
      .from(errorLog)
      .where(
        and(
          eq(errorLog.license_key_hash, licenseKeyHash),
          gte(errorLog.timestamp, startDate),
          lte(errorLog.timestamp, endDate),
          eq(errorLog.error_category, 'pdf_processing')
        )
      );

    return {
      totalSessions: sessions.length,
      totalUsers: new Set(sessions.map(s => s.user_id)).size,
      totalDevices: new Set(sessions.map(s => s.device_id)).size,
      avgSessionDuration: sessions.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0) / sessions.length,
      totalPDFsProcessed: sessions.reduce((sum, s) => sum + s.total_pdfs_processed, 0),
      totalErrors: errors.length,
      errorRate: errors.length / sessions.reduce((sum, s) => sum + s.total_pdfs_processed, 0),
      topErrors: this.getTopErrors(errors, 10)
    };
  }

  getTopErrors(errors, limit = 10) {
    const errorCounts = {};
    errors.forEach(error => {
      if (!errorCounts[error.error_code]) {
        errorCounts[error.error_code] = {
          code: error.error_code,
          count: 0,
          example_message: error.error_message
        };
      }
      errorCounts[error.error_code].count++;
    });

    return Object.values(errorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

// Export singleton instance
const metricsService = new MetricsService();
module.exports = metricsService;
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (2-3 weeks, 40-60 hours)

#### Week 1: Database & Core Service
**Tasks**:
1. Create 5 new database tables (license_keys, devices, user_sessions, usage_metrics, error_log)
2. Update users table with license_key_hash, device_id columns
3. Implement MetricsService class with all methods
4. Create IPC handler: `frontend/ipc/metricsHandlers.js`
5. Write unit tests for MetricsService

**Files to Create**:
- `frontend/db/schema/MetricsTables.js`
- `frontend/services/MetricsService.js`
- `frontend/ipc/metricsHandlers.js`
- `frontend/drizzle/migrations/0001_add_metrics_tables.sql`

**Files to Modify**:
- `frontend/db/schema/User.js` (add columns)
- `frontend/main.js` (register metricsHandlers, initialize MetricsService)

**Success Criteria**:
- ✅ Database schema migration runs successfully
- ✅ MetricsService can create sessions, log events, flush to database
- ✅ IPC handlers respond to metric events from renderer process

#### Week 2: Auth Integration & Session Tracking
**Tasks**:
1. Modify `authHandlers.js:login` to capture license key and start metrics session
2. Modify `authHandlers.js:logout` to end metrics session
3. Update `SessionManager.js` to notify MetricsService on countdown events
4. Implement device fingerprint association in login flow
5. Test session lifecycle (login → activity → logout)

**Files to Modify**:
- `frontend/ipc/authHandlers.js` (lines 226-322)
- `frontend/SessionManager.js` (lines 34-53)
- `frontend/LicenseManager.js` (add methods to expose license data)

**Success Criteria**:
- ✅ Login creates license_keys, devices, user_sessions entries
- ✅ Logout updates session record with duration and stats
- ✅ License expiration triggers session end with reason='license_expired'

#### Week 3: PDF Processing & Error Tracking
**Tasks**:
1. Add metrics to Python backend: `/analyze-statements-pdf/` endpoint
2. Capture PDF upload events (file count, size, banks)
3. Capture PDF success events (processing time, transactions)
4. Capture PDF failure events (errors, stack traces, system context)
5. Update `failed_statements` table to link with usage_metrics
6. Test with various PDF scenarios (success, scanned PDF, corrupted, etc.)

**Files to Modify**:
- `backend/main.py` (lines 131-203)
- `frontend/ipc/[handlers that call PDF endpoint]`

**Success Criteria**:
- ✅ Every PDF upload logged to usage_metrics
- ✅ PDF failures logged to both error_log and failed_statements
- ✅ Error details include system context (RAM, CPU, compatibility mode)

### Phase 2: Feature Tracking & Dashboards (3-4 weeks, 60-80 hours)

#### Week 4-5: Instrument All IPC Handlers
**Tasks**:
1. Add metrics wrapper to all 15 IPC handler modules
2. Implement `trackFeatureUsage(featureName, handler)` wrapper
3. Capture feature-specific metadata (report types, export formats, etc.)
4. Add error tracking to all catch blocks
5. Test each feature with metrics enabled

**Pattern for All Handlers**:
```javascript
// Example: reportHandlers.js
const metricsService = require('../services/MetricsService');

ipcMain.handle('report:generate', async (event, { reportType, caseId }) => {
  const startTime = Date.now();
  try {
    // Existing report generation logic
    const result = await generateReport(reportType, caseId);

    // Log success metric
    await metricsService.logReportGenerated(
      reportType,
      result.format,
      caseId,
      result.transactionsCount,
      Date.now() - startTime,
      result.fileSize
    );

    return { success: true, result };
  } catch (error) {
    // Log error metric
    await metricsService.logError(
      'REPORT_GENERATION_FAILED',
      error.message,
      error.stack,
      { reportType, caseId },
      'error',
      'report_generation'
    );
    throw error;
  }
});
```

#### Week 6: Local Metrics Dashboard
**Tasks**:
1. Create React component: `MetricsDashboard.jsx`
2. Implement IPC endpoints for metrics queries
3. Build visualizations (charts for session trends, error rates, feature usage)
4. Add filters (date range, license family, user, device)
5. Export metrics to CSV/Excel

**Files to Create**:
- `frontend/react-app/src/components/MetricsDashboard.jsx`
- `frontend/ipc/metricsHandlers.js` (add query endpoints)

**Features**:
- ✅ Overview cards: Total sessions, active users, error rate, avg session time
- ✅ Time series: Sessions per day, errors per day
- ✅ Top 10 errors table with counts and example messages
- ✅ Feature usage breakdown (pie chart)
- ✅ PDF success/failure ratio by bank type
- ✅ License utilization graph (active users vs max users)

#### Week 7: Data Aggregation & Retention
**Tasks**:
1. Implement daily aggregation job (run at midnight)
2. Create `metrics_aggregates` table for pre-computed stats
3. Implement data retention policy (delete metrics older than 90 days, keep aggregates longer)
4. Add metrics export API endpoint
5. Test aggregation performance

**Aggregation Logic**:
```javascript
// Run daily at 00:00
async function aggregateDailyMetrics() {
  const yesterday = Date.now() - (24 * 60 * 60 * 1000);
  const startOfDay = new Date(yesterday).setHours(0, 0, 0, 0);
  const endOfDay = new Date(yesterday).setHours(23, 59, 59, 999);

  // Aggregate by license family
  const sessions = await db.select()
    .from(userSessions)
    .where(
      and(
        gte(userSessions.login_time, startOfDay),
        lte(userSessions.login_time, endOfDay)
      )
    );

  // Group by license_key_hash
  const aggregates = {};
  sessions.forEach(session => {
    if (!aggregates[session.license_key_hash]) {
      aggregates[session.license_key_hash] = {
        date: new Date(startOfDay).toISOString().split('T')[0],
        license_key_hash: session.license_key_hash,
        total_sessions: 0,
        unique_users: new Set(),
        unique_devices: new Set(),
        total_duration: 0,
        total_pdfs: 0,
        total_errors: 0
      };
    }
    const agg = aggregates[session.license_key_hash];
    agg.total_sessions++;
    agg.unique_users.add(session.user_id);
    agg.unique_devices.add(session.device_id);
    agg.total_duration += session.session_duration_seconds || 0;
    agg.total_pdfs += session.total_pdfs_processed || 0;
  });

  // Insert aggregates
  for (const agg of Object.values(aggregates)) {
    await db.insert(metricsAggregates).values({
      ...agg,
      unique_users_count: agg.unique_users.size,
      unique_devices_count: agg.unique_devices.size
    });
  }

  // Delete old usage_metrics (keep only 90 days)
  const retentionDate = Date.now() - (90 * 24 * 60 * 60 * 1000);
  await db.delete(usageMetrics)
    .where(lte(usageMetrics.timestamp, retentionDate));
}
```

### Phase 3: Remote Sync (Optional, 2-3 weeks, 40-60 hours)

**Note**: Only implement if stakeholders need centralized dashboard hosted remotely

#### Week 8: Remote API Design
**Tasks**:
1. Design Django API endpoints for metrics ingestion
2. Implement authentication (API keys per license)
3. Add endpoints: `/api/ingest-metrics/`, `/api/query-metrics/`
4. Create metrics database tables in Django (PostgreSQL)
5. Implement rate limiting and validation

#### Week 9: Electron App Integration
**Tasks**:
1. Add opt-in consent UI for remote metrics
2. Implement batch upload (every 24 hours or on logout)
3. Hash/anonymize sensitive data before transmission
4. Implement exponential backoff retry on network errors
5. Add "sync status" indicator in settings

**Privacy Controls**:
- ✅ Metrics sync disabled by default
- ✅ User must opt-in via Settings
- ✅ Clear disclosure of what data is sent
- ✅ Ability to revoke consent and delete remote data
- ✅ Local metrics always available even if sync disabled

#### Week 10: Remote Dashboard
**Tasks**:
1. Build web dashboard for stakeholders (React + Django REST)
2. Implement authentication (stakeholder accounts)
3. Add license family selector (multi-license support)
4. Build visualizations (same as local dashboard, but aggregated across all users)
5. Add alerting (email notifications for high error rates, license expiration)

### Phase 4: Optimization & Advanced Features (Ongoing)

#### Advanced Metrics
1. **Cohort Analysis**: Track user behavior over time (retention, churn prediction)
2. **A/B Testing**: Feature flag system to test UI/UX changes
3. **Performance Monitoring**: Track database query latency, memory usage, CPU spikes
4. **User Segmentation**: Group users by behavior (power users, casual users, at-risk)
5. **Predictive Analytics**: ML models for support ticket prediction, upsell opportunities

#### Real-time Monitoring
1. **Live Dashboard**: WebSocket connection for real-time metrics updates
2. **Alerts**: Push notifications for critical errors, license limit reached
3. **Health Checks**: Automated monitoring of Gateway service, Python backend

---

## SECURITY & PRIVACY CONSIDERATIONS

### Data Sensitivity Classification

#### CRITICAL - Never Transmit Remotely
- ✅ **License Keys (raw)**: Always hash with SHA256 before storage
- ✅ **Passwords**: Already bcrypt hashed, never log
- ✅ **File Contents**: Never log PDF text content

#### HIGH - Hash/Anonymize Before Remote Transmission
- ✅ **User Emails**: Hash or use pseudonyms (e.g., `user_abc123`)
- ✅ **Device IDs (Windows SID)**: Hash with salt
- ✅ **MAC Addresses**: Hash with salt
- ✅ **Hostnames**: Mask or hash (e.g., `device_001`)

#### MEDIUM - Sanitize Before Logging
- ✅ **PDF File Names**: Remove user-specific paths, keep only basename
- ✅ **IP Addresses**: Mask last octet (e.g., `192.168.1.xxx`)
- ✅ **Error Messages**: Sanitize file paths, credentials

#### LOW - Safe to Log As-Is
- ✅ **Feature Names**: (e.g., `report_generated`)
- ✅ **Event Types**: (e.g., `pdf_upload`)
- ✅ **Timestamps**: Unix timestamps (no timezone issues)
- ✅ **System Specs**: (e.g., RAM: 8GB, CPU: i5)
- ✅ **Error Codes**: (e.g., `PDF_EXTRACTION_FAILED`)

### Encryption & Storage

#### Local SQLite Database
**Current**: Not encrypted at rest
**Recommendation**: Implement SQLCipher encryption

```javascript
// Add to frontend/db/index.js
const Database = require('better-sqlite3');
const SQLCipher = require('better-sqlite3-sqlcipher');

const encryptionKey = licenseManager.getDatabaseEncryptionKey();  // Derive from license key
const db = new SQLCipher('cyphersol.db', { key: encryptionKey });
```

**Benefits**:
- ✅ Protects metrics data if laptop is stolen
- ✅ Complies with data protection regulations
- ✅ Minimal performance impact

#### Metrics Transmission (If Remote Sync Enabled)
**Protocol**: HTTPS only (TLS 1.3)
**Payload Encryption**: AES-256-GCM
**Authentication**: API key + HMAC signature

```javascript
// Example encrypted payload
const payload = {
  license_key_hash: 'abc123...',  // Already hashed
  metrics: [/* encrypted metrics data */],
  timestamp: Date.now(),
  signature: crypto.createHmac('sha256', apiKey).update(JSON.stringify(metrics)).digest('hex')
};
```

### GDPR & Privacy Compliance

#### User Rights
1. **Right to Access**: Export all metrics data for a user
2. **Right to Deletion**: Delete all metrics data for a user
3. **Right to Portability**: Export metrics in machine-readable format (JSON)
4. **Right to Opt-Out**: Disable metrics collection (app functionality still works)

#### Implementation
```javascript
// Add to metricsHandlers.js
ipcMain.handle('metrics:export-user-data', async (event, userId) => {
  const sessions = await db.select().from(userSessions).where(eq(userSessions.user_id, userId));
  const metrics = await db.select().from(usageMetrics).where(eq(usageMetrics.user_id, userId));
  const errors = await db.select().from(errorLog).where(eq(errorLog.user_id, userId));

  const exportData = { sessions, metrics, errors };
  const filePath = path.join(app.getPath('downloads'), `cyphersol_metrics_${userId}_${Date.now()}.json`);

  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
  return { success: true, filePath };
});

ipcMain.handle('metrics:delete-user-data', async (event, userId) => {
  await db.delete(userSessions).where(eq(userSessions.user_id, userId));
  await db.delete(usageMetrics).where(eq(usageMetrics.user_id, userId));
  await db.delete(errorLog).where(eq(errorLog.user_id, userId));

  return { success: true, message: 'All metrics data deleted' };
});
```

#### Consent Management
**UI**: Settings → Privacy → Metrics Collection

```
[ ] Enable metrics collection (helps improve CypherEdge)
    ↓
    [ ] Sync metrics to cloud (requires internet connection)

    What data is collected?
    - Feature usage (which buttons you click)
    - Error reports (when PDFs fail)
    - Session duration (how long you use the app)

    What data is NOT collected?
    - Your PDF file contents
    - Your bank account numbers
    - Your personal financial data

    [View Privacy Policy] [Export My Data] [Delete My Data]
```

### Data Retention Policy

#### Tier 1: Short-term (90 days)
- Raw `usage_metrics` events
- Individual `error_log` entries
- Keep for debugging recent issues

#### Tier 2: Medium-term (1 year)
- Aggregated daily metrics
- Session summaries
- Keep for trend analysis

#### Tier 3: Long-term (Indefinite)
- License-level aggregates (no user PII)
- System-level error statistics (anonymized)
- Keep for product roadmap decisions

**Automatic Cleanup Job** (runs daily):
```javascript
async function cleanupOldMetrics() {
  const now = Date.now();

  // Delete raw metrics older than 90 days
  await db.delete(usageMetrics).where(lte(usageMetrics.timestamp, now - (90 * 24 * 60 * 60 * 1000)));

  // Delete error logs older than 90 days (except fatal errors)
  await db.delete(errorLog).where(
    and(
      lte(errorLog.timestamp, now - (90 * 24 * 60 * 60 * 1000)),
      ne(errorLog.error_severity, 'fatal')
    )
  );

  // Keep aggregated metrics longer (1 year)
  await db.delete(metricsAggregates).where(lte(metricsAggregates.date, now - (365 * 24 * 60 * 60 * 1000)));
}
```

---

## TESTING & VALIDATION STRATEGY

### Unit Tests

#### MetricsService Tests
**File**: `frontend/tests/services/MetricsService.test.js`

```javascript
describe('MetricsService', () => {
  beforeEach(() => {
    // Reset database to clean state
    // Create test user, license, device
  });

  describe('Session Management', () => {
    it('should create session on startSession', async () => {
      const sessionId = await metricsService.startSession(
        userId,
        'test@example.com',
        'testLicenseKey123',
        deviceInfo
      );

      expect(sessionId).toBeDefined();

      // Check database
      const session = await db.select().from(userSessions)
        .where(eq(userSessions.session_id, sessionId));
      expect(session).toHaveLength(1);
      expect(session[0].user_id).toBe(userId);
    });

    it('should calculate session duration on endSession', async () => {
      await metricsService.startSession(userId, email, licenseKey, deviceInfo);

      // Wait 2 seconds
      await sleep(2000);

      await metricsService.endSession('manual');

      const session = await db.select().from(userSessions)
        .where(eq(userSessions.user_id, userId))
        .orderBy(desc(userSessions.login_time))
        .limit(1);

      expect(session[0].session_duration_seconds).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Event Logging', () => {
    it('should log PDF upload event', async () => {
      await metricsService.startSession(userId, email, licenseKey, deviceInfo);
      await metricsService.logPDFUpload(3, 5000000, ['HDFC', 'ICICI', 'SBI']);
      await metricsService.flush();

      const metrics = await db.select().from(usageMetrics)
        .where(eq(usageMetrics.event_type, 'pdf_upload'));

      expect(metrics).toHaveLength(1);
      const data = JSON.parse(metrics[0].event_data);
      expect(data.file_count).toBe(3);
      expect(data.bank_types).toEqual(['HDFC', 'ICICI', 'SBI']);
    });

    it('should log PDF failure with error details', async () => {
      await metricsService.startSession(userId, email, licenseKey, deviceInfo);
      await metricsService.logPDFFailure(
        'corrupted.pdf',
        1234567,
        'HDFC',
        'Text extraction failed',
        'Error: Traceback...',
        { ram_gb: 8, cpu: 'i5' }
      );
      await metricsService.flush();

      const errors = await db.select().from(errorLog)
        .where(eq(errorLog.error_code, 'PDF_EXTRACTION_FAILED'));

      expect(errors).toHaveLength(1);
      expect(errors[0].error_severity).toBe('error');
    });
  });
});
```

### Integration Tests

#### Auth Flow with Metrics
**File**: `frontend/tests/integration/authWithMetrics.test.js`

```javascript
describe('Auth Flow with Metrics Integration', () => {
  it('should create metrics session on successful login', async () => {
    // Simulate login
    const result = await ipcRenderer.invoke('auth:login', {
      email: 'test@example.com',
      password: 'password123'
    });

    expect(result.success).toBe(true);

    // Check that metrics session was created
    const sessions = await db.select().from(userSessions)
      .where(eq(userSessions.user_id, result.userId));

    expect(sessions).toHaveLength(1);
    expect(sessions[0].logout_time).toBeNull();  // Still active
  });

  it('should end metrics session on logout', async () => {
    // Login first
    await ipcRenderer.invoke('auth:login', { email, password });

    // Logout
    await ipcRenderer.invoke('auth:logout');

    // Check that session was ended
    const sessions = await db.select().from(userSessions)
      .where(eq(userSessions.user_id, userId))
      .orderBy(desc(userSessions.login_time))
      .limit(1);

    expect(sessions[0].logout_time).not.toBeNull();
    expect(sessions[0].logout_reason).toBe('manual');
  });
});
```

### End-to-End Tests

#### Complete User Journey
**File**: `frontend/tests/e2e/userJourney.test.js`

```javascript
describe('Complete User Journey with Metrics', () => {
  it('should track full workflow: login → PDF upload → report generation → logout', async () => {
    // 1. Login
    await loginFlow('test@example.com', 'password123');

    // 2. Upload PDFs
    await uploadPDFs(['hdfc_jan.pdf', 'icici_feb.pdf']);

    // 3. Generate report
    await generateReport('summary', 'excel');

    // 4. Logout
    await logoutFlow();

    // Verify metrics
    const session = await getMostRecentSession(userId);
    expect(session.total_pdfs_processed).toBe(2);
    expect(session.total_reports_generated).toBe(1);

    const metrics = await getMetricsForSession(session.session_id);
    expect(metrics.filter(m => m.event_type === 'pdf_upload')).toHaveLength(1);
    expect(metrics.filter(m => m.event_type === 'pdf_success')).toHaveLength(2);
    expect(metrics.filter(m => m.event_type === 'report_generated')).toHaveLength(1);
  });
});
```

### Performance Tests

#### Metrics Overhead
**Goal**: Ensure metrics collection adds <5% overhead

```javascript
describe('Metrics Performance', () => {
  it('should not slow down PDF processing by more than 5%', async () => {
    // Baseline: PDF processing without metrics
    const startBaseline = Date.now();
    await processPDF('test.pdf', { metricsEnabled: false });
    const baselineDuration = Date.now() - startBaseline;

    // With metrics
    const startWithMetrics = Date.now();
    await processPDF('test.pdf', { metricsEnabled: true });
    const withMetricsDuration = Date.now() - startWithMetrics;

    const overhead = ((withMetricsDuration - baselineDuration) / baselineDuration) * 100;
    expect(overhead).toBeLessThan(5);  // Less than 5% overhead
  });

  it('should flush 1000 metrics in less than 100ms', async () => {
    // Generate 1000 metrics
    for (let i = 0; i < 1000; i++) {
      metricsService.metricsBuffer.push({
        session_id: 'test_session',
        user_id: 1,
        license_key_hash: 'test_hash',
        device_id: 'test_device',
        event_type: 'test_event',
        event_category: 'test',
        event_data: JSON.stringify({ index: i }),
        timestamp: Date.now()
      });
    }

    const start = Date.now();
    await metricsService.flush();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);  // Less than 100ms
  });
});
```

### Manual Testing Checklist

#### Phase 1 Validation
- [ ] Database migration runs without errors
- [ ] Login creates license_keys, devices, user_sessions entries
- [ ] Logout updates session with duration
- [ ] License expiration triggers forced logout with reason='license_expired'
- [ ] PDF upload creates usage_metrics event
- [ ] PDF success creates usage_metrics + updates session stats
- [ ] PDF failure creates error_log + usage_metrics
- [ ] Metrics buffer flushes every 5 seconds
- [ ] App startup/shutdown doesn't lose buffered metrics
- [ ] Multiple users on same license create separate sessions but share license_key_hash

#### Phase 2 Validation
- [ ] All IPC handlers log metrics on success
- [ ] All IPC handlers log errors on failure
- [ ] Metrics dashboard loads without errors
- [ ] Dashboard shows correct counts (sessions, users, devices)
- [ ] Dashboard charts render correctly
- [ ] Top errors list shows actual errors
- [ ] Date range filter works
- [ ] Export to CSV works
- [ ] Daily aggregation job runs successfully
- [ ] Old metrics are deleted after 90 days

#### Phase 3 Validation (If Remote Sync Enabled)
- [ ] Opt-in consent UI works
- [ ] Metrics sync to Django backend
- [ ] Remote dashboard shows correct data
- [ ] Data export works
- [ ] Data deletion works
- [ ] Sync status indicator updates correctly

---

## CONCLUSION

### Summary
This document provides a **complete blueprint** for implementing comprehensive metrics tracking in the CypherEdge CA application. The design leverages existing infrastructure (Gateway service, device fingerprinting, logging tools) and adds a minimal metrics layer on top.

### Key Achievements
1. ✅ **No Major Architectural Changes**: Works with current authentication, license, and session management
2. ✅ **Privacy-First Design**: Hashes sensitive data, local-first storage, opt-in remote sync
3. ✅ **Scalable**: Buffered writes, batch aggregation, efficient indexes
4. ✅ **Comprehensive**: Tracks users, devices, sessions, features, errors, and performance
5. ✅ **Stakeholder-Ready**: Provides dashboard, exports, and real-time insights

### Next Steps
1. **Get Stakeholder Approval**: Review this document with stakeholders, prioritize features
2. **Plan Sprints**: Break Phase 1 into 2-week sprints
3. **Implement Phase 1**: Focus on database, MetricsService, auth integration, PDF tracking
4. **Validate & Iterate**: Test with beta testers, gather feedback, optimize
5. **Scale (Optional)**: Implement Phase 2-4 based on business needs

### Estimated Effort
- **Phase 1 (Essential)**: 40-60 hours (2-3 weeks)
- **Phase 2 (Enhanced)**: 60-80 hours (3-4 weeks)
- **Phase 3 (Remote Sync)**: 40-60 hours (2-3 weeks)
- **Phase 4 (Advanced)**: Ongoing

**Total for Production-Ready Metrics**: ~140-200 hours (~5-8 weeks full-time)

### Contact
For questions or clarifications, refer to:
- **Gateway Source Code**: `gateway-source/.NET-License-Server/`
- **Electron App**: `frontend/` (UAT branch)
- **This Document**: `docs/METRICS_ARCHITECTURE_MASTER_DOCUMENT.md`

---

**END OF DOCUMENT**
