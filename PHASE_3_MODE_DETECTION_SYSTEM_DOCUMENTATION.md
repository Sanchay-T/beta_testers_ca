# Phase 3: Mode Detection System - Complete Documentation

## 🎯 Overview

Phase 3 is the **Mode Detection and Testing System** that determines whether your hardware should run in SCAN, UNSCAN, or HYBRID mode. This system provides a testing interface for developers to simulate different hardware scenarios and observe the complete user flow.

## 📁 File Structure & Components

### **Primary HTML Page**
```
📄 compatibility.html
└── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\react-app\compatibility.html
└── Window: BrowserWindow (1024x768, frameless)
└── Component: CompatibilityApp (JavaScript class)
└── Purpose: Mode detection interface and testing panel
```

### **Backend Engine Files**
```
📁 Mode Detection Engine
├── 📄 AppModeManager.js
│   └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\AppModeManager.js
│   └── Class: AppModeManager
│   └── Key Functions: runModeDetection(), handleModeSpecificFlow()
│
├── 📄 ModeDecisionEngine.js  
│   └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\modules\ModeDecisionEngine.js
│   └── Class: ModeDecisionEngine
│   └── Key Functions: determineAppMode(), checkHardwareRequirements()
│
├── 📄 HardwareDetector.js
│   └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\modules\HardwareDetector.js
│   └── Class: HardwareDetector  
│   └── Key Functions: getSystemSpecs(), detectRAM(), detectCPU()
│
└── 📄 HybridModeFlow.js
    └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\ui\HybridModeFlow.js
    └── Class: HybridModeFlow
    └── Key Functions: startHybridFlow(), createPaymentScreen()
```

### **Configuration Files**
```
📁 Configuration
├── 📄 appModeConfig.json
│   └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\config\appModeConfig.json
│   └── Purpose: Hardware thresholds, testing scenarios, development settings
│
├── 📄 temp_appModeConfig.json (Generated during testing)
│   └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\config\temp_appModeConfig.json
│   └── Purpose: Temporary config with testing overrides
│
└── 📄 AppModeConfigManager.js
    └── Location: C:\Users\admin\Desktop\beta_testers_ca\frontend\compatibility\config\AppModeConfigManager.js
    └── Purpose: Configuration loading and validation
```

## 🖥️ **Phase 3 Window & UI Components**

### **Window Properties**
```javascript
// main.js window creation
compatibilityWindow = new BrowserWindow({
  width: 1024,
  height: 768,
  frame: false,           // Frameless window
  resizable: false,       // Fixed size
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
    enableRemoteModule: true
  }
});

// Loads: compatibility.html
compatibilityWindow.loadFile('react-app/compatibility.html');
```

### **HTML Structure & Components**

#### **1. Email Entry Section** (Step 0)
```html
<!-- File: compatibility.html lines 800-850 -->
<div id="email-step" class="step-container">
  <form id="emailForm">
    <input type="email" id="emailInput" placeholder="Enter your email">
    <button type="submit" id="continueBtn">Continue to Compatibility Check</button>
  </form>
</div>
```

#### **2. System Testing Section** (Step 1-2)
```html
<!-- File: compatibility.html lines 900-1000 -->
<div id="testing-step" class="step-container">
  <div class="testing-progress">
    <div id="test-progress-bar"></div>
    <div id="test-status">Running system tests...</div>
  </div>
  <div id="test-results-container"></div>
</div>
```

#### **3. Mode Detection Testing Panel** (Step 3 - Development Mode)
```html
<!-- File: compatibility.html lines 1100-1300 -->
<div id="mode-testing-panel" class="development-panel">
  <h3>🧪 Mode Detection Testing Panel</h3>
  <div class="scenario-grid">
    
    <!-- Low-End PC Scenario -->
    <div class="test-scenario" data-scenario="lowEnd">
      <div class="scenario-header">
        <h4>💻 Low-End PC</h4>
        <span class="expected-mode hybrid">HYBRID Mode</span>
      </div>
      <div class="hardware-specs">
        <div>📊 RAM: 4GB</div>
        <div>🔧 CPU: i3</div>
        <div>☁️ Cloud Processing Required</div>
      </div>
      <button class="test-btn" onclick="runTestScenario('lowEnd')">
        Test Low-End PC
      </button>
    </div>

    <!-- Mid-Range PC Scenario -->
    <div class="test-scenario" data-scenario="midRange">
      <div class="scenario-header">
        <h4>🖥️ Mid-Range PC</h4>
        <span class="expected-mode unscan">UNSCAN Mode</span>
      </div>
      <div class="hardware-specs">
        <div>📊 RAM: 8GB</div>
        <div>🔧 CPU: i5</div>
        <div>⚡ Limited Scanning</div>
      </div>
      <button class="test-btn" onclick="runTestScenario('midRange')">
        Test Mid-Range PC
      </button>
    </div>

    <!-- High-End PC Scenario -->
    <div class="test-scenario" data-scenario="highEnd">
      <div class="scenario-header">
        <h4>💪 High-End PC</h4>
        <span class="expected-mode scan">SCAN Mode</span>
      </div>
      <div class="hardware-specs">
        <div>📊 RAM: 16GB</div>
        <div>🔧 CPU: i7+</div>
        <div>🚀 Full Features</div>
      </div>
      <button class="test-btn" onclick="runTestScenario('highEnd')">
        Test High-End PC
      </button>
    </div>
  </div>
  
  <!-- Real Hardware Detection -->
  <div class="real-hardware-section">
    <h4>🔍 Real Hardware Detection</h4>
    <button id="run-real-detection" class="primary-btn">
      Run Actual Hardware Detection
    </button>
  </div>
</div>
```

#### **4. Mode-Specific Flow Modals**

##### **HYBRID Mode Payment Flow Modals**
```html
<!-- Generated dynamically by JavaScript -->
<!-- File: compatibility.html showHybridModeFlow() function -->

<!-- Step 1: Decision Modal -->
<div class="hybrid-modal-overlay">
  <div class="hybrid-modal-content">
    <h2>⚠️ System Requirements Not Met</h2>
    <div class="hybrid-choice-grid">
      <div class="choice-option">
        <h3>💻 Use Another Computer</h3>
        <p>Recommended for optimal performance</p>
        <button id="use-another-pc">Use Another PC</button>
      </div>
      <div class="choice-option">
        <h3>☁️ Enable HYBRID Mode</h3>
        <p>Cloud-assisted processing</p>
        <div class="price">₹2,499</div>
        <button id="enable-hybrid">Enable HYBRID Mode</button>
      </div>
    </div>
  </div>
</div>

<!-- Step 2: Payment Information -->
<div class="hybrid-modal-overlay">
  <div class="hybrid-modal-content">
    <h2>💳 Payment Process</h2>
    <div class="payment-steps">
      <div class="step active">1. Scan & Pay</div>
      <div class="step">2. Mark Complete</div>
      <div class="step">3. Team Verification</div>
    </div>
    <button id="proceed-payment">Proceed to Payment ➤</button>
  </div>
</div>

<!-- Step 3: QR Payment Screen -->
<div class="hybrid-modal-overlay">
  <div class="hybrid-modal-content payment-screen">
    <div class="qr-container">
      <img src="../assets/CypherSOL_Karnataka_Scanner.jpg" 
           alt="Payment QR Code" 
           style="width: 280px; height: 280px;">
      <div class="payment-info">
        <div>VPA: cyphersolfint@kbl</div>
        <div>Reference: CYP-[timestamp]</div>
      </div>
    </div>
    <button id="payment-completed">Mark Payment as Completed</button>
  </div>
</div>

<!-- Step 4: Team Verification -->
<div class="hybrid-modal-overlay">
  <div class="hybrid-modal-content">
    <h2>✅ Payment Submitted</h2>
    <div class="verification-timeline">
      <div class="timeline-item completed">✅ Payment Received</div>
      <div class="timeline-item active">🔄 Team Verification (2-4 hours)</div>
      <div class="timeline-item">⏳ Contact & Activation</div>
    </div>
    <button id="close-application">Close Application</button>
  </div>
</div>
```

##### **UNSCAN Mode Notification Modal**
```html
<!-- Generated by showUnscanModeNotification() function -->
<div class="unscan-modal-overlay">
  <div class="unscan-modal-content">
    <h2>⚡ UNSCAN Mode Detected</h2>
    <div class="system-info">
      <div>📊 RAM: 8GB ✅</div>
      <div>🔧 CPU: i5+ ✅</div>
      <div>📄 Scan Performance: Limited</div>
    </div>
    <div class="countdown-timer">
      <div>Auto-launching in <span id="countdown">5</span> seconds</div>
      <button id="launch-now">Launch Now</button>
    </div>
  </div>
</div>
```

## 🎛️ **JavaScript Component Classes**

### **Main CompatibilityApp Class**
```javascript
// File: compatibility.html (embedded JavaScript)
class CompatibilityApp {
  constructor() {
    this.currentStep = 0;                    // Current UI step
    this.userEmail = null;                   // User email
    this.testResults = null;                 // System test results
    this.testProgress = {};                  // Test progress tracking
    this.isTestingComplete = false;          // Testing completion flag
    this.modeNotificationActive = false;     // Modal state flag
  }

  // Key Methods:
  setupEventListeners()        // IPC event setup
  setupAutoButtonLogging()     // UI logging setup
  handleUserDecision()         // User choice processing
  triggerModeSpecificFlow()    // Mode-based flow routing
  showHybridModeFlow()         // HYBRID payment flow
  showUnscanModeNotification() // UNSCAN notification
  runTestScenario()            // Test scenario execution
}
```

### **Event Handlers & Functions**
```javascript
// Test Scenario Execution
function runTestScenario(scenario) {
  // File: compatibility.html line ~1500
  window.CypherEdgeLogger.logButtonClick(`test-scenario-${scenario}`, 
    `Test ${scenario} Mode`, 'runTestScenario', { scenario });
  
  // Calls backend: app-mode:run-detection
  window.electronAPI.invoke('app-mode:run-detection', { scenario });
}

// Mode-Specific Flow Routing
function triggerModeSpecificFlow(mode, result) {
  // File: compatibility.html line ~1660
  switch(mode) {
    case 'SCAN':   // High-end: direct launch
    case 'UNSCAN': // Mid-range: notification + launch  
    case 'HYBRID': // Low-end: payment flow
  }
}

// HYBRID Payment Flow Steps
function showHybridModeFlow(result)           // Step 1: Decision
function showHybridPaymentInfo(modalOverlay)  // Step 2: Payment info
function showHybridQRPayment(modalOverlay)    // Step 3: QR code
function showTeamVerification(modalOverlay)   // Step 4: Verification
```

## 🔗 **IPC Communication Architecture**

### **Frontend to Backend Communication**
```javascript
// IPC Channels Used in Phase 3:

1. 'app-mode:run-detection'
   └── Triggers mode detection with scenario
   └── Handler: main.js → AppModeManager.runModeDetection()

2. 'compatibility:start-tests'  
   └── Starts system compatibility tests
   └── Handler: SystemCompatibilityChecker.js

3. 'compatibility:user-decision'
   └── Processes final user decision
   └── Handler: main.js → handleUserDecision()

4. 'ui-logger:log-event'
   └── Sends UI events to logging system
   └── Handler: UILoggerIntegrations.js
```

### **Backend Event Emissions**
```javascript
// Events Sent from Backend to Frontend:

1. 'test-progress'
   └── System test progress updates
   └── Listener: compatibility.html → updateTestingUI()

2. 'mode-notification:show-unscan'
   └── Triggers UNSCAN mode notification
   └── Listener: compatibility.html → showUnscanModeNotification()

3. 'hybrid-flow:show-screen'
   └── Triggers HYBRID payment flow
   └── Listener: compatibility.html → showHybridModeFlow()
```

## 📊 **Complete UI Flow Mapping**

### **Phase 3 Step-by-Step UI Flow**
```
📄 compatibility.html Window Opens
│
├── Step 0: Email Entry
│   ├── Input: emailInput (email field)
│   ├── Button: continueBtn ("Continue to Compatibility Check")
│   └── Action: Form submission → Step 1
│
├── Step 1-2: System Testing (Automatic)
│   ├── Progress: test-progress-bar (visual progress)
│   ├── Status: test-status (text updates)
│   ├── Results: test-results-container (test outcomes)
│   └── Duration: ~1.5 minutes (15 tests)
│
├── Step 3A: Development Mode - Testing Panel
│   ├── Panel: mode-testing-panel
│   │   ├── Scenario: lowEnd → "Test Low-End PC" button
│   │   ├── Scenario: midRange → "Test Mid-Range PC" button
│   │   ├── Scenario: highEnd → "Test High-End PC" button
│   │   └── Real: run-real-detection → "Run Actual Hardware Detection"
│   │
│   └── Step 3B: Mode Detection Results
│       ├── SCAN Mode: Auto-launch (no modal)
│       ├── UNSCAN Mode: Notification modal → Auto-launch
│       └── HYBRID Mode: Payment flow → App close
│
└── HYBRID Payment Flow (4 Modals):
    ├── Modal 1: Decision (Use Another PC / Enable HYBRID)
    ├── Modal 2: Payment Info (Proceed to Payment)
    ├── Modal 3: QR Payment (Mark Payment Complete)
    └── Modal 4: Team Verification (Close Application)
```

## 🧪 **Testing Scenarios Configuration**

### **Test Scenario Definitions**
```json
// File: appModeConfig.json
{
  "testing": {
    "scenarios": {
      "lowEnd": {
        "name": "Low-End PC (HYBRID Mode)",
        "hardwareProfile": {
          "ram": 4,
          "processor": "i3"
        },
        "expectedMode": "HYBRID",
        "description": "Triggers cloud-assisted processing flow"
      },
      "midRange": {
        "name": "Mid-Range PC (UNSCAN Mode)", 
        "hardwareProfile": {
          "ram": 8,
          "processor": "i5"
        },
        "expectedMode": "UNSCAN",
        "description": "Limited scanning capabilities"
      },
      "highEnd": {
        "name": "High-End PC (SCAN Mode)",
        "hardwareProfile": {
          "ram": 16,
          "processor": "i7"
        },
        "expectedMode": "SCAN",
        "description": "Full feature set available"
      }
    }
  }
}
```

### **Hardware Override System**
```javascript
// File: HardwareDetector.js
function applyTestingOverrides(specs, config) {
  if (config.forceRAM) {
    specs.ram = config.forceRAM;      // Override RAM
  }
  if (config.forceCPU) {
    specs.cpu = config.forceCPU;      // Override CPU
  }
  if (config.forceMode) {
    specs.forcedMode = config.forceMode;  // Force specific mode
  }
  return specs;
}
```

## 📈 **UI Logger Integration Points**

### **Automatic Logging Events**
```javascript
// File: compatibility.html setupAutoButtonLogging()

1. Page Load:
   window.CypherEdgeLogger.logPageNavigation('CompatibilityChecker', 'page-load');

2. Button Clicks (Auto-captured):
   document.addEventListener('click', (e) => {
     if (e.target.tagName === 'BUTTON') {
       window.CypherEdgeLogger.logButtonClick(buttonId, buttonText, action, context);
     }
   });

3. Form Submissions:
   document.addEventListener('submit', (e) => {
     window.CypherEdgeLogger.logPageEvent('FORM_SUBMIT', formData);
   });

4. Input Focus:
   document.addEventListener('focus', (e) => {
     window.CypherEdgeLogger.logPageEvent('INPUT_FOCUS', inputData);
   });
```

### **Manual Logging Events**
```javascript
// Flow Step Logging
window.CypherEdgeLogger.logFlowStep('triggerModeSpecificFlow', mode, data);
window.CypherEdgeLogger.logFlowStep('HYBRID_MODE', 'LOW_END', flowData);

// Modal Action Logging  
window.CypherEdgeLogger.logModalAction('HybridModeDecision', 'open', modalData);

// Backend Call Logging (automatic in React components)
const backendLogger = logger.logBackendCall('app-mode:run-detection', 'AppModeManager.js');
```

## 📋 **CSS Classes & Styling**

### **Key CSS Classes**
```css
/* File: compatibility.html <style> section */

.step-container          /* Main step containers */
.development-panel       /* Testing panel in dev mode */
.scenario-grid          /* Grid layout for test scenarios */
.test-scenario          /* Individual scenario cards */
.expected-mode          /* Mode indicator badges */
.hybrid-modal-overlay   /* HYBRID flow modal backdrop */
.hybrid-modal-content   /* HYBRID flow modal content */
.payment-screen         /* QR payment specific styling */
.qr-container          /* QR code display container */
.unscan-modal-overlay   /* UNSCAN notification modal */
.countdown-timer        /* Auto-launch countdown */
```

### **Responsive Design**
```css
/* Mobile/Tablet Breakpoints */
@media (max-width: 768px) {
  .hybrid-modal-content {
    margin: 10px !important;
    max-width: calc(100vw - 20px) !important;
  }
  
  .hybrid-choice-grid {
    grid-template-columns: 1fr !important;
  }
}
```

## 🔍 **Log File Locations**

### **Generated Log Files**
```
📁 Log Directories:
├── frontend/logs/
│   ├── ui_flow_[timestamp].log              # UI interaction logs
│   └── ui_logger_test_report_[timestamp].json   # Test reports
│
├── frontend/compatibility/log/
│   ├── FLOW_2025-08-28T12-39-27.log         # Mode detection flow
│   ├── DETAILED_2025-08-28T12-39-27.log     # Detailed system logs  
│   ├── compatibility-2025-08-28.log         # Daily compatibility log
│   └── compatibility-report-[session].json  # Session reports
│
└── C:\Users\admin\AppData\Roaming\Electron\
    ├── logs/compatibility/                   # User-specific logs
    └── sessions/                            # Session data
```

### **Log Entry Examples**
```
📄 [PAGE_NAVIGATION] null → CompatibilityChecker
   📁 File: compatibility.html
   🧩 Component: CompatibilityApp
   🎯 Trigger: page-load

🔘 [BUTTON_CLICK] "Test Low-End PC" (test-scenario-lowEnd)
   📍 Location: compatibility.html → WebPage
   ⚡ Action: runTestScenario
   📋 Context: {"scenario":"lowEnd","testingMode":true}

🪟 [MODAL_ACTION] HybridModeDecision - OPEN
   📍 Location: compatibility.html → CompatibilityApp

🔍 [FLOW_STEP] HYBRID_MODE → LOW_END
   📊 Data: {"step":"SHOWING_HYBRID_SETUP","paymentRequired":true}
```

## 🚀 **Development vs Production Behavior**

### **Development Mode (NODE_ENV=development)**
```javascript
// Features Available:
✅ Testing Panel visible
✅ All test scenarios available  
✅ Hardware override capability
✅ Comprehensive logging
✅ Debug information displayed
✅ Manual testing controls
```

### **Production Mode (NODE_ENV=production)**
```javascript
// Features Disabled:
🚫 Testing panel hidden
🚫 Test scenarios disabled
🚫 Hardware overrides cleared
✅ Real hardware detection only
✅ Streamlined user experience
✅ Production logging level
```

## 🎯 **Summary**

**Phase 3** is a comprehensive mode detection system built around:

- **Single HTML Page**: `compatibility.html` (40,000+ lines)
- **Main Component**: `CompatibilityApp` JavaScript class
- **Backend Engine**: 4 core files (AppModeManager, ModeDecisionEngine, HardwareDetector, HybridModeFlow)
- **Testing Interface**: 3 test scenarios + real hardware detection
- **Flow Outcomes**: 3 different user experiences (SCAN/UNSCAN/HYBRID)
- **Complete Logging**: Every interaction tracked with file paths and context
- **Modal System**: Dynamic modal generation for HYBRID payment flow
- **IPC Architecture**: 4 main channels with comprehensive event handling

The entire system is designed to provide developers with complete visibility into the mode detection logic while delivering a seamless user experience in production.