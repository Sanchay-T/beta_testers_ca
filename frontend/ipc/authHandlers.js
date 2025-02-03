const { ipcMain } = require('electron');
const sessionManager = require('../SessionManager');
const log = require('electron-log');
const licenseManager = require('../LicenseManager');
const { users } = require('../db/schema/User');
const bcrypt = require('bcrypt');
const databaseManager = require('../db/db');

const { eq, exists, sql } = require("drizzle-orm");

function registerAuthHandlers() {
    const db = databaseManager.getInstance().getDatabase();
    log.info("Database instance : ", db);

    log.info('Registering auth IPC handlers');
    // Handle login
    ipcMain.handle('auth:login', async (event, credentials) => {
        try {
            console.log('Login data:', credentials);
            // return sessionManager.setUser(userData);
            const user = (await db.select()
                .from(users)
                .where(eq(users.name, credentials.email)))[0];

            console.log("User login present: ", user);
            if (!user) {
                throw new Error('Invalid email or password'); // User not found
            }

            // Use bcrypt to compare the plain-text password with the hashed password
            const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

            if (!isPasswordValid) {
                throw new Error('Invalid email or password'); // Incorrect password
            }

            // Set the user session
            const { licenseKey, uuidHash } = await licenseManager.getLicenseKey();
            console.log("License key:", licenseKey);

            if (!licenseKey) {
                throw new Error('License key not found');
            }

            // Validate the license
            const result = await licenseManager.validateLicense(licenseKey, credentials.email, uuidHash, true);
            console.log("License activation result:", result);

            if (!result.success) {
                throw new Error('Invalid license key');
            }

            const remainingSeconds = licenseManager.calculateRemainingSeconds(result.data.expiry_timestamp);
            sessionManager.startLicenseCountdown(remainingSeconds);

            sessionManager.setUser(user);

            return { success: true, user: credentials };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle logout
    ipcMain.handle('auth:logout', async () => {
        try {
            return sessionManager.clearUser();
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    });

    // Get user session
    ipcMain.handle('auth:getUser', () => {
        log.info("GetUser IPCMAIN : ", sessionManager.getUser());
        return sessionManager.getUser();
    });

    // Update user data
    ipcMain.handle('auth:updateUser', async (event, userData) => {
        try {
            return sessionManager.updateUser(userData);
        } catch (error) {
            console.error('Update user error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("auth:signUp", async (event, credentials) => {

        const result = await licenseManager.validateLicense(credentials.licenseKey, credentials.email);
        console.log("License activation result:", result);

        if (result.success) {

            // const userAlreadyExists = await db.select(
            //     exists(db.select().from(users).where(eq(users.email, credentials.email)))
            // );

            const userAlreadyExists = await db.select().from(users).where(eq(users.name, credentials.email));

            console.log("User already exists: ", userAlreadyExists);
            if (userAlreadyExists.length > 0) {
                return { success: false, error: "User already exists." };
            }

            // const user = await db.insert(users).values({ ...credentials }).returning({ id: users.id }).get();

            // Step 3: Create New User
            const hashedPassword = await bcrypt.hash(credentials.password, 10);

            const dateJoined = new Date();

            // console.log("dateJoined : ", dateJoined, "HashPassword : ", hashedPassword);
            let newUser;
            try {

                newUser = await db
                    .insert(users)
                    .values({
                        // name: credentials.name || credentials.email.split("@")[0],
                        name: credentials.email,
                        email: credentials.email,
                        password: hashedPassword,
                        dateJoined: dateJoined,
                    })
                    .returning();
            } catch (err) {
                log.info("Error in creating new user : ", err);
                return { success: false, error: "Failed to register user." };
            }

            const remainingSeconds = licenseManager.calculateRemainingSeconds(result.data.expiry_timestamp);
            const storeResult = await licenseManager.storeLicense({ licenseKey: credentials.licenseKey, email: credentials.email });

            if (storeResult.success) {
                sessionManager.startLicenseCountdown(remainingSeconds);
            }

            return {
                success: true,
                message: "User created successfully.",
                user: newUser[0],
            };
        }

        return {
            success: false,
            error: result.error,
        }

    });

    // ipcMain.handle("license:activate", async (event, credentials) => {
    //     try {
    //         const result = await licenseManager.validateAndStoreLicense(credentials);
    //         return { success: true };
    //     } catch (error) {
    //         console.error("Error retrieving license key:", error);
    //         return { success: false, message: "Failed to retrieve license key." };
    //     }
    // });

    ipcMain.handle("license:check", async () => {
        try {
            const isValid = await licenseManager.checkActivation();

            return { success: isValid, message: isValid ? "License key is valid." : "Invalid license key." };
        } catch (error) {
            console.error("Error validating license key:", error);
            return { success: false, message: "Failed to validate license key." };
        }
    });

}

module.exports = { registerAuthHandlers };