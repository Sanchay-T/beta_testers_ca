# Best Practices for CypherSol Development

## Table of Contents
1. [Code Organization](#code-organization)
2. [Error Handling](#error-handling)
3. [Security Best Practices](#security-best-practices)
4. [Performance Optimization](#performance-optimization)
5. [Testing Strategy](#testing-strategy)
6. [Documentation Standards](#documentation-standards)
7. [Team Collaboration](#team-collaboration)

## Code Organization

### Project Structure

```
ca-offline-suite/
├── backend/                    # Python FastAPI backend
│   ├── api/                   # API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py           # Authentication endpoints
│   │   ├── processing.py     # PDF processing endpoints
│   │   └── health.py         # Health check endpoints
│   ├── services/             # Business logic
│   │   ├── __init__.py
│   │   ├── pdf_service.py    # PDF processing logic
│   │   ├── ml_service.py     # ML/NER logic
│   │   └── bank_service.py   # Bank-specific logic
│   ├── models/               # Data models
│   │   ├── __init__.py
│   │   └── schemas.py        # Pydantic schemas
│   ├── utils/                # Utility functions
│   ├── tests/                # Python tests
│   └── main.py              # FastAPI app entry
├── frontend/                  # Electron + React frontend
│   ├── src/                  # React source code
│   │   ├── components/       # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API services
│   │   └── utils/           # Utility functions
│   ├── main/                # Electron main process
│   │   ├── ipc/            # IPC handlers (organized)
│   │   ├── services/       # Main process services
│   │   └── utils/          # Main process utilities
│   ├── preload/            # Preload scripts
│   ├── assets/             # Static assets
│   └── main.js            # Electron entry (to be refactored)
├── shared/                  # Shared code between frontend/backend
│   ├── types/              # TypeScript types
│   └── constants/          # Shared constants
├── docs/                    # Documentation
├── tests/                   # Integration tests
└── scripts/                 # Build and utility scripts
```

### Refactoring main.js

Your current `main.js` is 1350+ lines. Here's how to break it down:

```javascript
// main/index.js - New entry point (50 lines max)
const { app } = require('electron');
const { AppManager } = require('./services/AppManager');
const { ConfigService } = require('./services/ConfigService');

// Initialize configuration first
ConfigService.initialize();

// Create app manager
const appManager = new AppManager();

// App event handlers
app.whenReady().then(() => appManager.start());
app.on('window-all-closed', () => appManager.shutdown());
app.on('activate', () => appManager.activate());
```

```javascript
// main/services/AppManager.js
class AppManager {
  constructor() {
    this.windowManager = new WindowManager();
    this.backendManager = new BackendManager();
    this.updateManager = new UpdateManager();
    this.sessionManager = new SessionManager();
    this.ipcManager = new IPCManager();
  }

  async start() {
    try {
      await this.initializeServices();
      await this.createMainWindow();
      await this.startBackend();
      this.setupAutoUpdater();
    } catch (error) {
      this.handleStartupError(error);
    }
  }

  async initializeServices() {
    await this.sessionManager.initialize();
    await this.ipcManager.registerHandlers();
    // ... other initializations
  }
}
```

### IPC Handler Organization

Instead of scattered IPC handlers, organize them:

```javascript
// main/ipc/index.js
const { ipcMain } = require('electron');
const handlers = require('./handlers');

class IPCManager {
  registerHandlers() {
    // Auto-register all handlers
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcMain.handle(channel, async (event, ...args) => {
        try {
          console.log(`IPC: ${channel}`, args);
          return await handler(event, ...args);
        } catch (error) {
          console.error(`IPC Error in ${channel}:`, error);
          throw error;
        }
      });
    });
  }
}

// main/ipc/handlers/index.js
module.exports = {
  'auth:login': require('./auth').login,
  'auth:logout': require('./auth').logout,
  'files:open': require('./files').open,
  'files:process': require('./files').process,
  // ... etc
};
```

## Error Handling

### Centralized Error Handler

```javascript
// main/services/ErrorHandler.js
class ErrorHandler {
  static handle(error, context) {
    console.error(`Error in ${context}:`, error);
    
    // Log to file
    log.error({
      context,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Notify user if needed
    if (this.shouldNotifyUser(error)) {
      this.notifyUser(error, context);
    }
    
    // Report to monitoring service
    if (this.shouldReport(error)) {
      this.reportError(error, context);
    }
  }
  
  static shouldNotifyUser(error) {
    // Don't notify for network errors, internal errors, etc.
    return error.userFacing === true;
  }
  
  static notifyUser(error, context) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'An error occurred',
      error.userMessage || 'Something went wrong. Please try again.'
    );
  }
}
```

### Error Types

```javascript
// shared/errors.js
class AppError extends Error {
  constructor(message, code, userFacing = false) {
    super(message);
    this.code = code;
    this.userFacing = userFacing;
    this.timestamp = new Date().toISOString();
  }
}

class NetworkError extends AppError {
  constructor(message) {
    super(message, 'NETWORK_ERROR', true);
    this.userMessage = 'Network connection failed. Please check your internet.';
  }
}

class LicenseError extends AppError {
  constructor(message) {
    super(message, 'LICENSE_ERROR', true);
    this.userMessage = 'License validation failed. Please contact support.';
  }
}

class BackendError extends AppError {
  constructor(message) {
    super(message, 'BACKEND_ERROR', true);
    this.userMessage = 'Processing service is not responding. Please restart the application.';
  }
}
```

### Try-Catch Patterns

```javascript
// Good: Specific error handling
async function processFiles(files) {
  try {
    validateFiles(files);
    const results = await backendService.process(files);
    return { success: true, results };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof BackendError) {
      await backendService.restart();
      throw error;
    }
    // Unknown error
    ErrorHandler.handle(error, 'processFiles');
    throw new AppError('Failed to process files', 'PROCESS_ERROR');
  }
}

// Bad: Generic catch-all
async function processFiles(files) {
  try {
    return await backendService.process(files);
  } catch (error) {
    console.log(error);  // Don't just log
    return null;         // Don't return null on error
  }
}
```

## Security Best Practices

### 1. Context Isolation

```javascript
// main/windows/MainWindow.js
class MainWindow {
  create() {
    this.window = new BrowserWindow({
      webPreferences: {
        contextIsolation: true,  // Always true
        nodeIntegration: false,  // Always false
        preload: path.join(__dirname, '../preload/index.js')
      }
    });
  }
}
```

### 2. Input Validation

```javascript
// main/ipc/validators.js
const { z } = require('zod');

const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  rememberMe: z.boolean().optional()
});

function validateLogin(data) {
  try {
    return LoginSchema.parse(data);
  } catch (error) {
    throw new ValidationError('Invalid login data');
  }
}

// Use in IPC handler
ipcMain.handle('auth:login', async (event, data) => {
  const validData = validateLogin(data);  // Validates or throws
  return await authService.login(validData);
});
```

### 3. Secure Storage

```javascript
// main/services/SecureStorage.js
const keytar = require('keytar');
const crypto = require('crypto');

class SecureStorage {
  static async setSecure(key, value) {
    const encrypted = this.encrypt(value);
    await keytar.setPassword('CypherSol', key, encrypted);
  }
  
  static async getSecure(key) {
    const encrypted = await keytar.getPassword('CypherSol', key);
    return encrypted ? this.decrypt(encrypted) : null;
  }
  
  static encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const key = this.getOrCreateKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  static decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const algorithm = 'aes-256-gcm';
    const key = this.getOrCreateKey();
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 4. CSP Headers

```javascript
// For web content
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Only allow navigation to your domains
    if (parsedUrl.origin !== 'https://yourdomain.com') {
      event.preventDefault();
    }
  });
  
  // Set CSP
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self' http://localhost:7500"
        ].join('; ')
      }
    });
  });
});
```

## Performance Optimization

### 1. Lazy Loading

```javascript
// main/services/ServiceLoader.js
class ServiceLoader {
  constructor() {
    this._services = new Map();
  }
  
  get(serviceName) {
    if (!this._services.has(serviceName)) {
      // Lazy load service
      const Service = require(`./services/${serviceName}`);
      this._services.set(serviceName, new Service());
    }
    return this._services.get(serviceName);
  }
}

// Usage
const serviceLoader = new ServiceLoader();
const dbService = serviceLoader.get('DatabaseService'); // Loads only when needed
```

### 2. Backend Connection Pooling

```python
# backend/services/connection_pool.py
from contextlib import asynccontextmanager
import asyncio

class ConnectionPool:
    def __init__(self, max_connections=10):
        self._pool = asyncio.Queue(maxsize=max_connections)
        self._all_connections = []
    
    async def initialize(self):
        for _ in range(self._pool.maxsize):
            conn = await self._create_connection()
            self._all_connections.append(conn)
            await self._pool.put(conn)
    
    @asynccontextmanager
    async def acquire(self):
        conn = await self._pool.get()
        try:
            yield conn
        finally:
            await self._pool.put(conn)
```

### 3. Debouncing IPC Calls

```javascript
// frontend/src/hooks/useDebounce.js
import { useMemo } from 'react';
import { debounce } from 'lodash';

export function useDebouncedIPC(channel, delay = 300) {
  const debouncedCall = useMemo(
    () => debounce(
      (...args) => window.api.invoke(channel, ...args),
      delay
    ),
    [channel, delay]
  );
  
  return debouncedCall;
}

// Usage
const searchFiles = useDebouncedIPC('files:search', 500);
```

### 4. Memory Management

```javascript
// main/services/MemoryManager.js
class MemoryManager {
  static monitor() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const mb = (bytes) => Math.round(bytes / 1024 / 1024);
      
      console.log('Memory Usage:', {
        rss: `${mb(usage.rss)} MB`,        // Total memory
        heap: `${mb(usage.heapUsed)} MB`,  // V8 heap
        external: `${mb(usage.external)} MB` // C++ objects
      });
      
      // Warn if memory usage is high
      if (mb(usage.rss) > 500) {
        console.warn('High memory usage detected');
        global.gc && global.gc(); // Force garbage collection if available
      }
    }, 60000); // Check every minute
  }
}
```

## Testing Strategy

### 1. Unit Tests

```javascript
// tests/unit/services/ValidationService.test.js
const { ValidationService } = require('../../../main/services/ValidationService');

describe('ValidationService', () => {
  describe('validateBankStatement', () => {
    it('should accept valid PDF files', () => {
      const file = { name: 'statement.pdf', size: 1024 * 1024 };
      expect(() => ValidationService.validateBankStatement(file)).not.toThrow();
    });
    
    it('should reject non-PDF files', () => {
      const file = { name: 'statement.doc', size: 1024 * 1024 };
      expect(() => ValidationService.validateBankStatement(file))
        .toThrow('Only PDF files are supported');
    });
    
    it('should reject files over 10MB', () => {
      const file = { name: 'statement.pdf', size: 11 * 1024 * 1024 };
      expect(() => ValidationService.validateBankStatement(file))
        .toThrow('File size must be less than 10MB');
    });
  });
});
```

### 2. Integration Tests

```javascript
// tests/integration/auth.test.js
const { app } = require('electron');
const { AuthService } = require('../../main/services/AuthService');

describe('Authentication Flow', () => {
  let authService;
  
  beforeAll(async () => {
    await app.whenReady();
    authService = new AuthService();
  });
  
  test('complete login flow', async () => {
    // Test login
    const result = await authService.login({
      username: 'testuser',
      password: 'testpass123'
    });
    
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    
    // Test session validation
    const session = await authService.validateSession(result.token);
    expect(session.valid).toBe(true);
    
    // Test logout
    await authService.logout(result.token);
    const invalidSession = await authService.validateSession(result.token);
    expect(invalidSession.valid).toBe(false);
  });
});
```

### 3. E2E Tests

```javascript
// tests/e2e/app.test.js
const { _electron: electron } = require('playwright');

test('app launches and processes files', async () => {
  const app = await electron.launch({ args: ['main.js'] });
  const window = await app.firstWindow();
  
  // Wait for app to load
  await window.waitForSelector('#login-form');
  
  // Login
  await window.fill('#username', 'testuser');
  await window.fill('#password', 'testpass123');
  await window.click('#login-button');
  
  // Wait for dashboard
  await window.waitForSelector('#dashboard');
  
  // Upload file
  const [fileChooser] = await Promise.all([
    window.waitForEvent('filechooser'),
    window.click('#upload-button')
  ]);
  
  await fileChooser.setFiles('test-data/sample-statement.pdf');
  
  // Wait for processing
  await window.waitForSelector('#processing-complete');
  
  // Verify results
  const results = await window.textContent('#results');
  expect(results).toContain('Processing complete');
  
  await app.close();
});
```

## Documentation Standards

### 1. Code Comments

```javascript
/**
 * Processes bank statement PDFs and extracts transaction data.
 * 
 * @param {string[]} filePaths - Array of PDF file paths to process
 * @param {Object} options - Processing options
 * @param {string} options.bankName - Name of the bank (for bank-specific parsing)
 * @param {boolean} options.ocr - Whether to use OCR for scanned PDFs
 * @returns {Promise<ProcessingResult>} Processing results with extracted data
 * @throws {ValidationError} If files are invalid
 * @throws {ProcessingError} If processing fails
 * 
 * @example
 * const results = await processStatements(
 *   ['./statements/jan.pdf', './statements/feb.pdf'],
 *   { bankName: 'HDFC', ocr: true }
 * );
 */
async function processStatements(filePaths, options = {}) {
  // Implementation
}
```

### 2. API Documentation

```python
# backend/api/processing.py
from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/processing", tags=["processing"])

class ProcessingResponse(BaseModel):
    """Response model for processing operations"""
    success: bool
    transaction_count: int
    transactions: List[dict]
    metadata: dict

@router.post("/extract", response_model=ProcessingResponse)
async def extract_transactions(
    file: UploadFile = File(..., description="PDF bank statement"),
    bank_name: str = "auto",
    use_ocr: bool = False
):
    """
    Extract transactions from a bank statement PDF.
    
    - **file**: PDF file containing bank statement
    - **bank_name**: Bank name for specific parsing rules (default: auto-detect)
    - **use_ocr**: Enable OCR for scanned PDFs (slower but more accurate)
    
    Returns extracted transactions with metadata.
    """
    # Implementation
```

### 3. README Template

```markdown
# Module Name

## Overview
Brief description of what this module does.

## Installation
```bash
npm install
```

## Usage
```javascript
const { ModuleName } = require('./module');
const module = new ModuleName(options);
```

## API Reference

### `methodName(param1, param2)`
Description of the method.

**Parameters:**
- `param1` (Type): Description
- `param2` (Type): Description

**Returns:** Description of return value

**Example:**
```javascript
const result = module.methodName('value1', 'value2');
```

## Testing
```bash
npm test
```

## Contributing
See CONTRIBUTING.md
```

## Team Collaboration

### 1. Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/add-bank-parser
# Make changes
git add .
git commit -m "feat: add parser for ICICI bank statements"
git push origin feature/add-bank-parser
# Create PR

# Commit message format
# type: subject
# 
# body (optional)
# 
# footer (optional)

# Types:
# feat: new feature
# fix: bug fix
# docs: documentation
# style: formatting
# refactor: code restructuring
# test: tests
# chore: maintenance
```

### 2. Code Review Checklist

```markdown
## Code Review Checklist

- [ ] Code follows project style guide
- [ ] All tests pass
- [ ] New code has tests
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Error handling is proper
- [ ] No console.logs left
- [ ] Dependencies are necessary
- [ ] Breaking changes documented
```

### 3. Development Setup

Create a `CONTRIBUTING.md`:

```markdown
# Contributing to CypherSol

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/ca-offline-suite.git
   cd ca-offline-suite
   ```

3. Install dependencies:
   ```bash
   # Backend
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   
   # Frontend
   cd ../frontend
   npm install
   ```

4. Set up pre-commit hooks:
   ```bash
   npm run setup-hooks
   ```

## Development Workflow

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Update documentation
5. Run tests locally
6. Submit PR

## Code Standards

- Use ESLint for JavaScript
- Use Black for Python
- Write meaningful commit messages
- Add tests for new features
- Document public APIs
```

### 4. Team Communication

```javascript
// main/services/TeamNotifier.js
class TeamNotifier {
  static async notifyBuildStatus(status, details) {
    // Slack notification
    if (process.env.SLACK_WEBHOOK) {
      await axios.post(process.env.SLACK_WEBHOOK, {
        text: `Build ${status}: ${details.version}`,
        attachments: [{
          color: status === 'success' ? 'good' : 'danger',
          fields: [
            { title: 'Version', value: details.version },
            { title: 'Branch', value: details.branch },
            { title: 'Author', value: details.author },
            { title: 'Time', value: new Date().toISOString() }
          ]
        }]
      });
    }
  }
}
```

## Summary

By following these best practices:

1. **Code becomes maintainable** - Easy to understand and modify
2. **Bugs are caught early** - Through testing and validation
3. **Team works efficiently** - Clear standards and communication
4. **App performs better** - Optimized resource usage
5. **Security is built-in** - Not an afterthought

Remember:
- Start small - implement one practice at a time
- Be consistent - follow patterns throughout
- Document everything - your future self will thank you
- Test early and often - catches issues before users do
- Communicate clearly - with code and with team

Your 50 clients deserve a robust, secure, and performant application. These practices will help you deliver that!