const { EventEmitter } = require('events');
const log = require('electron-log');
const licenseManager = require('./LicenseManager');
const axios = require('axios');

class SessionManager extends EventEmitter {
    constructor() {
        if (SessionManager.instance) {
            return SessionManager.instance;
        }

        super();
        this.store = null;
        this._user = null;
        this.remainingSeconds = 0;
        this.interval = null;

        // this.init();
        SessionManager.instance = this;
    }

    async init() {
        // const { default: Store } = await import('electron-store');
        // this.store = new Store({
        //     encryptionKey: process.env.NODE_ENV === 'production' ? 'your-encryption-key' : undefined,
        //     name: 'session'
        // });

        // this._user = this.store.get('user') || null;
    }

    static getInstance() {
        if (!SessionManager.instance) {
            new SessionManager();  // Create the instance if it doesn't exist
        }
        return SessionManager.instance;
    }

    startLicenseCountdown(remainingSeconds) {

        if (remainingSeconds <= 0) {
            this.emit('licenseExpired');
            return;
        }

        // Set the initial remaining seconds
        this.setRemainingSeconds(remainingSeconds);

        // Start the countdown
        this.interval = setInterval(() => {
            remainingSeconds -= 1;

            if (remainingSeconds <= 0) {
                clearInterval(this.interval);
                this.remainingSeconds = 0;
                // this.stopLicenseCountdown();           // clears + nulls interval
                this.emit('licenseExpired');
            } else {
                this.setRemainingSeconds(remainingSeconds);
            }
        }, 1000);

        // console.log(`License countdown started: ${remainingSeconds} seconds remaining`);
    }

    setRemainingSeconds(seconds) {
        this.remainingSeconds = seconds;
        this.emit('remainingSecondsUpdated', seconds);
        // log.info(`License countdown: ${seconds} seconds remaining`);
    }

    stopLicenseCountdown() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    setUser(userData) {
        this._user = userData;
        log.info("Setting user : ", this._user);
        return {
            success: true,
        };
    }

    getUser() {
        return this._user || null;
    }

    getUserId() {
        const user = this.getUser();
        return user ? user.userId : 1;
    }

    isAuthenticated() {
        return this._user !== null;
    }


    clearUser() {
        this._user = null;
        try {
            this.store.delete('user');
            return { success: true };
        }
        catch (err) {
            log.error("Error deleting user:", err);
            return { success: false };
        }
    }

    async logoutUser() {
        const user = this._user;
        this._user = null;

        if (!user) return { success: true, message: "No active user." };

        try {
            // ✅ Get system info from your license manager
            const { clientId, uuid, macAddress, hostname, username, ip, port } = licenseManager.getLicenseInfo(); // Ensure this function returns what you need

            // ✅ Call the .NET licensing server API to activate session
            const response = await axios.post(`http://${ip}:${port}/api/license/deactivate-session`, {
                clientId,
                uuid,
                macAddress,
                hostname,
                username,
            });

            if (response.data?.success) {
                this.stopLicenseCountdown();

                return {
                    success: true,
                    message: "License session inactivated.",
                    activeCount: response.data.activeCount,
                };
            } else {
                throw new Error(response.data?.error || "Inactivation failed.");
            }
        } catch (err) {
            log.error("Unexpected logout error:", err);
            return { success: false, error: err.message };
        }
    }

    updateUser(userData) {
        return this.setUser({ ...this._user, ...userData });
    }
}

// Create and export singleton instance
// const sessionManager = new SessionManager();
module.exports = SessionManager.getInstance();  