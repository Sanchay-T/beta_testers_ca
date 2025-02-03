const { contextBridge, ipcRenderer, shell } = require("electron");
const { generateReportIpc } = require("./ipc/generateReport");
const log = require("electron-log");

// Expose a secure API for opening files to the renderer process
contextBridge.exposeInMainWorld("electron", {
  openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),
  fetchPdfContent: (filePath, caseName) =>
    ipcRenderer.invoke("fetch-pdf-content", filePath, caseName),

  getReportsProcessed: () => ipcRenderer.invoke("get-reports-processed"),
  getStatementsProcessed: () => ipcRenderer.invoke("get-statements-processed"),

  getTransactions: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions", caseId, individualId),

  getTransactionsCount: (caseId) =>
    ipcRenderer.invoke("get-transactions-count", caseId),
  getEodBalance: (caseId) => ipcRenderer.invoke("get-eod-balance", caseId),
  getSummary: (caseId) => ipcRenderer.invoke("get-summary", caseId),
  getTransactionsByDebtor: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-debtor", caseId, individualId),

  getTransactionsByCreditor: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-creditor", caseId, individualId),

  getTransactionsByCashWithdrawal: (caseId, individualId) =>
    ipcRenderer.invoke(
      "get-transactions-by-cashwithdrawal",
      caseId,
      individualId
    ),

  getTransactionsByCashDeposit: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-cashdeposit", caseId, individualId),

  getTransactionsByUpiCr: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-upi-cr", caseId, individualId),

  getTransactionsByUpiDr: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-upi-dr", caseId, individualId),

  getTransactionsBySuspenseCredit: (caseId, individualId) =>
    ipcRenderer.invoke(
      "get-transactions-by-suspensecredit",
      caseId,
      individualId
    ),

  getTransactionsBySuspenseDebit: (caseId, individualId) =>
    ipcRenderer.invoke(
      "get-transactions-by-suspensedebit",
      caseId,
      individualId
    ),

  getTransactionsByEmi: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-emi", caseId, individualId),
  getTransactionsByInvestment: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-investment", caseId, individualId),
  getTransactionsByReversal: (caseId, individualId) =>
    ipcRenderer.invoke("get-transactions-by-reversal", caseId, individualId),

  getStatements: (case_id) => ipcRenderer.invoke("get-statements", case_id),

  updateStatement: ({ id, customerName, accountNumber }) =>
    ipcRenderer.invoke("update-statement", { id, customerName, accountNumber }),

  getCombinedStatements: (case_id) =>
    ipcRenderer.invoke("get-combine-statements", case_id),

  saveFileToTemp: (fileBuffer) =>
    ipcRenderer.invoke("save-file-to-temp", fileBuffer),
  cleanupTempFiles: () => ipcRenderer.invoke("cleanup-temp-files"),
  generateReportIpc: (result, reportName, source) =>
    ipcRenderer.invoke("generate-report", result, reportName, source),

  getOpportunityToEarn: () => ipcRenderer.invoke("getOpportunityToEarn"),

  addPdfIpc: (data, caseId) => ipcRenderer.invoke("add-pdf", data, caseId),

  deleteReport: (caseId) => ipcRenderer.invoke("delete-report", caseId),

  getReportName: (caseId) => ipcRenderer.invoke("get-Report-Name", caseId),

  getCustomerName: (individualId) =>
    ipcRenderer.invoke("get-Customer-Name", individualId),

  getReportNameExists: (reportName) =>
    ipcRenderer.invoke("check-Report-Name-Exists", reportName),

  downloadExcelReport: (data) =>
    ipcRenderer.invoke("download-excel-report", data),

  user: {
    getData: (userId) => ipcRenderer.invoke("user:get-data", userId),
    updateData: (userData) => ipcRenderer.send("user:update-data", userData),
  },

  file: {
    open: (filePath) => ipcRenderer.send("file:open", filePath),
    save: (fileContent) => ipcRenderer.invoke("file:save", fileContent),
    getData: (filePath) => ipcRenderer.invoke("file:get-data", filePath),
  },

  auth: {
    signUp: (credentials) => ipcRenderer.invoke("auth:signUp", credentials),
    login: (userData) => ipcRenderer.invoke("auth:login", userData),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getUser: () => ipcRenderer.invoke("auth:getUser"),
    // updateUser: (userData) => ipcRenderer.invoke('auth:updateUser', userData)
    checkLicense: () => ipcRenderer.invoke("license:check"),
    activateLicense: (credentials) =>
      ipcRenderer.invoke("license:activate", credentials),
  },

  getRecentReports: () => ipcRenderer.invoke("get-recent-reports"),
  getFailedStatements: (referenceId) =>
    ipcRenderer.invoke("get-failed-statements", referenceId),

  onLicenseExpired: (callback) => ipcRenderer.on("navigateToLogin", callback),
  removeLicenseExpiredListener: () =>
    ipcRenderer.removeAllListeners("navigateToLogin"),
  editCategory: (data, caseId) => ipcRenderer.invoke("edit-category", data, caseId),
  excelFileDownload: (caseId) => ipcRenderer.invoke("excel-report-download", caseId),
  editPdf: (result, reportName) => ipcRenderer.invoke("edit-pdf", result, reportName),
  editEntity: (payload) => ipcRenderer.invoke("edit-entity", payload),

  // Add auto-update related methods
  updates: {
    checkForUpdates: () => ipcRenderer.invoke("check-for-updates", () => { }),
    // downloadUpdate: () => ipcRenderer.invoke('download-update'),
    // installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateStatus: (callback) =>
      ipcRenderer.on("update-status", (_, status) => callback(status)),
    onUpdateProgress: (callback) =>
      ipcRenderer.on("update-progress", (_, progress) => callback(progress)),
    onUpdateDownloaded: (callback) =>
      ipcRenderer.on("update-downloaded", () => callback()),
    onUpdateError: (callback) =>
      ipcRenderer.on("update-error", (_, error) => callback(error)),
    // Remove event listeners when component unmounts

    removeUpdateListeners: () => {
      ipcRenderer.removeAllListeners("update-status");
      ipcRenderer.removeAllListeners("update-progress");
      ipcRenderer.removeAllListeners("update-downloaded");
      ipcRenderer.removeAllListeners("update-error");
    },
  },

  download: {
    excelReportDownload: (caseId) => ipcRenderer.invoke('excel-report-download', caseId),
    onExcelDownloadChunk: (callback) => ipcRenderer.on('excel-report-chunk', (event, chunk) => callback(chunk)),
    onExcelDownloadComplete: (callback) => ipcRenderer.on('excel-report-complete', (event, message) => callback(message)),
    onExcelDownloadError: (callback) => ipcRenderer.on('excel-report-error', (event, error) => callback(error)),
  },

  shell: {
    openExternal: (url) => shell.openExternal(url),
  },
});