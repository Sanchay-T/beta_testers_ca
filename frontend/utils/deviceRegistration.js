// utils/deviceRegistration.js
const log = require("electron-log");
const crypto = require("crypto");

/**
 * Device Registration Utility for Cyphersol API Integration
 * Handles device registration with the Cyphersol devices API
 */
class DeviceRegistration {
  constructor() {
    this.apiBaseUrl = 'https://cyphersol.co.in/api';
    this.maxRetries = 3;
    this.retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s
  }

  /**
   * Register device with Cyphersol API
   * @param {string} email - User email (already validated)
   * @param {Object} deviceData - Device information
   * @param {string} detectedMode - Detected mode (scan/unscan/hybrid)
   * @returns {Promise<Object>} Registration result
   */
  async registerDevice(email, deviceData, detectedMode = null) {
    const startTime = Date.now();
    
    try {
      log.info("🔌 DEVICE_REGISTRATION: Starting device registration", {
        email: email.substring(0, 3) + "***" + email.substring(email.indexOf('@')),
        detectedMode,
        timestamp: new Date().toISOString()
      });

      // Validate required parameters
      if (!email) {
        throw new Error("Email is required for device registration");
      }

      if (!deviceData) {
        throw new Error("Device data is required for registration");
      }

      // Prepare device payload according to Cyphersol API schema
      const devicePayload = this.prepareDevicePayload(deviceData, detectedMode);
      
      // Validate required device fields
      this.validateDevicePayload(devicePayload);

      const requestPayload = {
        email: email,
        device: devicePayload
      };

      log.info("🔌 DEVICE_REGISTRATION: Prepared payload", {
        email: email.substring(0, 3) + "***" + email.substring(email.indexOf('@')),
        deviceFields: Object.keys(devicePayload),
        hasAllRequired: this.hasAllRequiredFields(devicePayload)
      });

      // Attempt registration with retry logic
      const result = await this.registerWithRetry(requestPayload);

      const duration = Date.now() - startTime;
      log.info("🔌 DEVICE_REGISTRATION: Registration completed successfully", {
        duration,
        deviceUuid: devicePayload.uuid?.substring(0, 8) + "...",
        registeredMode: devicePayload.detected_mode
      });

      return {
        success: true,
        data: result,
        duration,
        registeredAt: new Date().toISOString()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      log.error("🔌 DEVICE_REGISTRATION: Registration failed", {
        error: error.message,
        duration,
        email: email?.substring(0, 3) + "***" + email?.substring(email?.indexOf('@') || 0)
      });

      return {
        success: false,
        error: error.message,
        duration,
        failedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Prepare device payload according to Cyphersol API schema
   * @param {Object} deviceData - Raw device data from SystemInformation
   * @param {string} detectedMode - Detected compatibility mode
   * @returns {Object} Formatted device payload
   */
  prepareDevicePayload(deviceData, detectedMode) {
    // Map our device data to Cyphersol API format
    const payload = {
      uuid: deviceData.uuid || deviceData.UUID || "unknown-uuid",
      hostname: deviceData.hostname || "unknown-hostname", 
      username: deviceData.username || "unknown-username",
      mac_address: deviceData.macAddress || deviceData.mac_address || "unknown-mac",
      windows_user_sid: deviceData.windowsUserSID || deviceData.windows_user_sid || "unknown-sid"
    };

    // Add detected_mode if available and valid
    if (detectedMode && this.isValidMode(detectedMode)) {
      payload.detected_mode = detectedMode.toLowerCase();
    }

    return payload;
  }

  /**
   * Validate device payload has all required fields
   * @param {Object} payload - Device payload to validate
   * @throws {Error} If required fields are missing
   */
  validateDevicePayload(payload) {
    const requiredFields = ['uuid', 'hostname', 'username', 'mac_address', 'windows_user_sid'];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!payload[field] || payload[field] === `unknown-${field.replace('_', '')}`) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`Missing or invalid required device fields: ${missingFields.join(', ')}`);
    }

    // Validate detected_mode if present
    if (payload.detected_mode && !this.isValidMode(payload.detected_mode)) {
      log.warn("🔌 DEVICE_REGISTRATION: Invalid detected_mode, removing from payload", {
        invalidMode: payload.detected_mode
      });
      delete payload.detected_mode;
    }
  }

  /**
   * Check if detected mode is valid according to API spec
   * @param {string} mode - Mode to validate
   * @returns {boolean} True if valid
   */
  isValidMode(mode) {
    const validModes = ['scan', 'unscan', 'hybrid'];
    return validModes.includes(mode.toLowerCase());
  }

  /**
   * Check if payload has all required fields with valid values
   * @param {Object} payload - Device payload
   * @returns {boolean} True if all required fields are present and valid
   */
  hasAllRequiredFields(payload) {
    const requiredFields = ['uuid', 'hostname', 'username', 'mac_address', 'windows_user_sid'];
    return requiredFields.every(field => 
      payload[field] && 
      payload[field] !== `unknown-${field.replace('_', '')}`
    );
  }

  /**
   * Register device with retry logic
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} API response
   */
  async registerWithRetry(payload) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        log.info(`🔌 DEVICE_REGISTRATION: Attempt ${attempt + 1}/${this.maxRetries}`);
        
        const response = await fetch(`${this.apiBaseUrl}/devices/add/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 10000 // 10 second timeout
        });

        // Handle successful response (201 Created)
        if (response.status === 201) {
          const result = await response.json();
          log.info("🔌 DEVICE_REGISTRATION: API call successful", {
            status: response.status,
            attempt: attempt + 1
          });
          return result;
        }

        // Handle API errors
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          // Handle specific 400 errors
          if (Array.isArray(errorData) && errorData.includes("User with this email does not exist.")) {
            throw new Error("User email not found in Cyphersol system. This should not happen after email validation.");
          } else {
            throw new Error(`Device registration validation failed: ${JSON.stringify(errorData)}`);
          }
        }

        throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);

      } catch (error) {
        lastError = error;
        log.warn(`🔌 DEVICE_REGISTRATION: Attempt ${attempt + 1} failed`, {
          error: error.message,
          attempt: attempt + 1,
          willRetry: attempt < this.maxRetries - 1
        });

        // Don't retry for certain errors
        if (error.message.includes("User email not found") || 
            error.message.includes("validation failed")) {
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelays[attempt]);
        }
      }
    }

    // All retries failed
    throw new Error(`Device registration failed after ${this.maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Delay helper for retry logic
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get stored registration status for a device
   * @param {string} uuid - Device UUID
   * @returns {Object|null} Registration status or null if not found
   */
  getRegistrationStatus(uuid) {
    try {
      const stored = localStorage.getItem(`device_registration_${uuid}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      log.warn("🔌 DEVICE_REGISTRATION: Failed to read registration status", {
        error: error.message,
        uuid: uuid?.substring(0, 8) + "..."
      });
      return null;
    }
  }

  /**
   * Store registration status for a device
   * @param {string} uuid - Device UUID
   * @param {Object} status - Registration status
   */
  storeRegistrationStatus(uuid, status) {
    try {
      localStorage.setItem(`device_registration_${uuid}`, JSON.stringify({
        ...status,
        storedAt: new Date().toISOString()
      }));
      
      log.info("🔌 DEVICE_REGISTRATION: Registration status stored", {
        uuid: uuid?.substring(0, 8) + "...",
        success: status.success
      });
    } catch (error) {
      log.warn("🔌 DEVICE_REGISTRATION: Failed to store registration status", {
        error: error.message,
        uuid: uuid?.substring(0, 8) + "..."
      });
    }
  }

  /**
   * Check if device is already registered
   * @param {string} uuid - Device UUID
   * @returns {boolean} True if already registered
   */
  isDeviceRegistered(uuid) {
    const status = this.getRegistrationStatus(uuid);
    return status && status.success;
  }
}

// Export singleton instance
const deviceRegistration = new DeviceRegistration();
module.exports = { deviceRegistration };
