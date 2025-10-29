const { EventEmitter } = require('events');
const log = require('electron-log');

// Delay loading these to avoid circular dependency issues
let licenseManager;
let axios;

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

        SessionManager.instance = this;
    }

    async init() {
        // For future implementation
    }

    static getInstance() {
        if (!SessionManager.instance) {
            new SessionManager();
        }
        return SessionManager.instance;
    }

    startLicenseCountdown(remainingSeconds) {
        if (remainingSeconds <= 0) {
            this.emit('licenseExpired');
            return;
        }

        this.setRemainingSeconds(remainingSeconds);

        this.interval = setInterval(() => {
            remainingSeconds -= 1;

            if (remainingSeconds <= 0) {
                clearInterval(this.interval);
                this.remainingSeconds = 0;
                this.emit('licenseExpired');
            } else {
                this.setRemainingSeconds(remainingSeconds);
            }
        }, 1000);
    }

    setRemainingSeconds(seconds) {
        this.remainingSeconds = seconds;
        this.emit('remainingSecondsUpdated', seconds);
    }

    stopLicenseCountdown() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    setUser(userData) {
        const wasAuthenticated = this.isAuthenticated();
        this._user = userData;
        log.info("Setting user : ", this._user);
        if (wasAuthenticated) {
            this.emit('user-updated', this._user);
        } else {
            this.emit('login', this._user);
        }
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
            if (this.store) {
                this.store.delete('user');
            }
            this.emit('logout');
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
            // Load dependencies only when needed to avoid circular dependency
            if (!licenseManager) {
                licenseManager = require('./LicenseManager');
            }
            if (!axios) {
                axios = require('axios');
            }

            const { clientId, uuid, macAddress, hostname, username, ip, port } = licenseManager.getLicenseInfo();

            const response = await axios.post(`http://${ip}:${port}/api/license/deactivate-session`, {
                clientId,
                uuid,
                macAddress,
                hostname,
                username,
            });

            if (response.data?.success) {
                this.stopLicenseCountdown();
                this.emit('logout');

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
const sessionManagerInstance = new SessionManager();
module.exports = sessionManagerInstance;
