// EmailVerification.js
// Email verification screen before compatibility check
const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const log = require("electron-log");

class EmailVerification {
  constructor() {
    this.window = null;
    this.userEmail = null;
    this.verificationResult = null;
  }

  async runEmailVerification() {
    log.info("📧 [EMAIL] Starting email verification flow...");
    
    try {
      // Create email verification window
      await this.createEmailWindow();
      
      // Wait for user to enter email and submit
      const result = await this.waitForEmailSubmission();
      
      // Close window
      if (this.window) {
        this.window.close();
        this.window = null;
      }
      
      log.info("📧 [EMAIL] Email verification completed:", { email: result.email, canProceed: result.canProceed });
      
      return result;
    } catch (error) {
      log.error("📧 [EMAIL] Email verification failed:", error);
      if (this.window) {
        this.window.close();
        this.window = null;
      }
      return { 
        success: false, 
        canProceed: false, 
        error: error.message 
      };
    }
  }

  async createEmailWindow() {
    this.window = new BrowserWindow({
      width: 500,
      height: 400,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      show: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    const emailHtmlPath = path.join(__dirname, "react-app", "email-verification.html");
    await this.window.loadFile(emailHtmlPath);
    
    log.info("📧 [EMAIL] Email verification window created");
  }

  async waitForEmailSubmission() {
    return new Promise((resolve) => {
      // Create a unique handler ID for this instance
      const handlerName = `email:submit:${Date.now()}`;
      
      log.info("📧 [EMAIL] Setting up email submission handler:", handlerName);
      
      // Handle email submission with instance-specific handler
      const submitHandler = async (event, data) => {
        const { email } = data;
        log.info("📧 [EMAIL] Received email submission:", email);
        
        // For now, always pass regardless of email (as requested)
        const result = {
          success: true,
          canProceed: true,
          email: email,
          verified: true, // Always true for now
          message: "Email verification passed"
        };
        
        this.userEmail = email;
        this.verificationResult = result;
        
        // Clean up handler
        ipcMain.removeHandler(handlerName);
        
        resolve(result);
        return result;
      };

      // Register the handler
      ipcMain.handle(handlerName, submitHandler);
      
      // Also register the standard handler name for the frontend
      ipcMain.removeAllListeners("email:submit");
      ipcMain.handle("email:submit", submitHandler);

      // Handle window close (user canceled)
      this.window.on('closed', () => {
        log.info("📧 [EMAIL] Window closed event received");
        if (!this.verificationResult) {
          // Clean up handler
          ipcMain.removeHandler("email:submit");
          ipcMain.removeHandler(handlerName);
          
          resolve({
            success: false,
            canProceed: false,
            error: "User canceled email verification"
          });
        }
      });

      // Add error handling for window destruction
      this.window.on('destroyed', () => {
        log.warn("📧 [EMAIL] Window was destroyed");
        if (!this.verificationResult) {
          resolve({
            success: false,
            canProceed: false,
            error: "Window was destroyed unexpectedly"
          });
        }
      });
    });
  }

  getUserEmail() {
    return this.userEmail;
  }
}

module.exports = { EmailVerification };