const { EventEmitter } = require('events');
const log = require('electron-log');

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
        const { default: Store } = await import('electron-store');
        this.store = new Store({
            encryptionKey: process.env.NODE_ENV === 'production' ? 'your-encryption-key' : undefined,
            name: 'session'
        });

        this._user = this.store.get('user') || null;

        // console.log('SessionManager initialized', "User:", this._user, " Store: ", this.store);
        console.log('SessionManager initialized');
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
            console.log('License expired');
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
                this.emit('licenseExpired');
                console.log('License expired');
            } else {
                this.setRemainingSeconds(remainingSeconds);
            }
        }, 1000);

        console.log(`License countdown started: ${remainingSeconds} seconds remaining`);
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

    getUser() {
        log.info("GetUser : ", this._user);
        return this._user;
    }

    isAuthenticated() {
        return this._user !== null;
    }

    setUser(userData) {
        this._user = userData;
        this.store.set('user', userData);
        return { success: true };
    }

    clearUser() {
        this._user = null;
        try {
            this.store.delete('user');
            log.info("User deleted");
            return { success: true };
        }
        catch (err) {
            log.error("Error deleting user:", err);
            return { success: false };
        }
    }

    updateUser(userData) {
        return this.setUser({ ...this._user, ...userData });
    }
}

// Create and export singleton instance
// const sessionManager = new SessionManager();
module.exports = SessionManager.getInstance();