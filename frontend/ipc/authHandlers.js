const { ipcMain } = require("electron");
const sessionManager = require("../SessionManager");
const log = require("electron-log");
const licenseManager = require("../LicenseManager");
const { users } = require("../db/schema/User");
const bcrypt = require("bcrypt");
const databaseManager = require("../db/db");
const { eq, exists, sql } = require("drizzle-orm");
const { uuid } = require("systeminformation");
const systemInformation = require("../SystemInformation");
const bonjour = require("bonjour")();
const axios = require("axios");
const path = require("path");
const { encryptData, decryptData } = require("../CryptoHandler"); // your crypto module
const fs = require("fs");
const gatewayServer = require("../InitiateGatewayServer")
const dgram = require('dgram');
const os = require('os');
const ip = require('ip'); // You need to install this via: npm install ip
// const { gateway } = require('default-gateway');
const si = require('systeminformation');



log.info("License manager process.env.NODE_ENV", process.env.NODE_ENV);

const toValidateLicense = process.env.VALIDATE_LICENSE == "true";
log.info("Validate License : ", toValidateLicense);

// Simple check if gateway server is already running
async function isServerRunning(url) {
  try {
    const res = await axios.get(url);
    return res.status === 200;
  } catch {
    return false;
  }
}


async function waitUntilServerIsReady(url, timeout = 10000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await axios.get(url);
      if (res.status === 200) {
        return true;
      }
    } catch (_) {
      // wait and retry

    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Gateway server did not respond in time.");
}



async function getBroadcastAddress() {
  try {
    // Get network interface details
    const networkInterfaces = await si.networkInterfaces();

    // Find the default interface (the one with 'default: true')
    const defaultInterface = networkInterfaces.find(iface => iface.default);

    if (!defaultInterface) {
      throw new Error('No default interface found.');
    }

    // Log the default interface details for debugging
    console.log(`Default Interface: ${defaultInterface.ifaceName}`);
    console.log(`IP: ${defaultInterface.ip4}`);
    console.log(`Subnet: ${defaultInterface.ip4subnet}`);

    // Calculate the broadcast address based on the default interface's IP and subnet mask
    const localIP = defaultInterface.ip4;
    const subnetMask = defaultInterface.ip4subnet;

    // Calculate the broadcast address using the 'ip' package
    const broadcastIP = ip.subnet(localIP, subnetMask).broadcastAddress;

    console.log(`Broadcast Address: ${broadcastIP}`);
    return broadcastIP;

  } catch (error) {
    console.error('Error calculating broadcast address:', error);
  }
}



/**
 * Discover license servers using UDP broadcast as a fallback.
 * @param {number} timeout - Time in milliseconds to wait for responses (default: 3000).
 * @returns {Promise<Array>} - Resolves with an array of discovered services.
 */
function discoverUdpBroadcastServices(timeout = 3000) {
  return new Promise((resolve) => {
    const BROADCAST_PORT = 41234;
    const BROADCAST_MESSAGE = Buffer.from("DISCOVER_LICENSE_SERVER");
    const discoveredServices = [];
    const client = dgram.createSocket('udp4');

    client.bind(() => {
      client.setBroadcast(true);

      // Listen for responses
      client.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());

          const serviceInfo = {
            name: data.host || "Unknown",
            host: data.host,
            ip: rinfo.address,
            port: data.port
          };

          // Deduplicate services based on IP and port
          if (!discoveredServices.some(s => s.ip === serviceInfo.ip && s.port === serviceInfo.port)) {
            discoveredServices.push(serviceInfo);
          }
        } catch (err) {
          log.error("Invalid UDP response format:", err);
        }
      });


      // Send broadcast message
      getBroadcastAddress().then((broadcastIP) => {
        log.info("Broadcast IP : ", broadcastIP);
        client.send(BROADCAST_MESSAGE, 0, BROADCAST_MESSAGE.length, BROADCAST_PORT, broadcastIP);

      }).catch((err) => {
        log.error("Error calculating broadcast address:", err);
      });

      // Wait for responses then close
      setTimeout(() => {
        client.close();
        resolve(discoveredServices);
      }, timeout);
    });
  });
}



/**
 * Discover mDNS services by type.
 * @param {string} serviceType - The type of service to discover (required).
 * @param {number} timeout - Time in milliseconds to wait for discovery (default: 5000).
 * @returns {Promise<Array>} - Resolves with an array of discovered services.
 */
function discoverMdnsServices(serviceType = '', timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (!serviceType) {
      return reject(new Error("Service type is required for mDNS discovery."));
    }
    const discoveredServices = [];
    const browser = bonjour.find({ type: serviceType });

    // Listen for each service as it comes online
    browser.on('up', (service) => {
      const serviceInfo = {
        name: service.name || "Unknown",
        host: service.host || "",
        // Try using the referer's address; fallback to addresses array if needed.
        ip: (service.referer && service.referer.address) || (service.addresses && service.addresses[0]) || "",
        port: service.port || ""
      };

      // Deduplicate services based on IP and port
      if (!discoveredServices.some(s => s.ip === serviceInfo.ip && s.port === serviceInfo.port)) {
        discoveredServices.push(serviceInfo);
      }
    });

    // Handle possible errors
    browser.on('error', (err) => {

      browser.stop();
      log.error("Error in DiscoverMdnsServices : ", err)
      reject(err);
    });

    // Stop the browser after the timeout and resolve with the discovered services
    setTimeout(() => {
      browser.stop();
      resolve(discoveredServices);
    }, timeout);
  });
}

function registerAuthHandlers(userDataPath) {
  const db = databaseManager.getInstance().getDatabase();

  // Handle login
  ipcMain.handle("auth:login", async (event, credentials) => {
    try {
      console.log("Login data:", credentials);
      // return sessionManager.setUser(userData);
      const user = (
        await db.select().from(users).where(eq(users.name, credentials.email))
      )[0];

      console.log("User login present: ", user);
      if (!user) {
        throw new Error("Invalid email or password"); // User not found
      }

      // Use bcrypt to compare the plain-text password with the hashed password
      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isPasswordValid) {
        return { success: false, message: "Invalid email or password" };
      }


      // ✅ Get system info from your license manager
      const { clientId, uuid, macAddress, hostname, username, ip, port } = licenseManager.getLicenseInfo(); // Ensure this function returns what you need

      // ✅ Call the .NET licensing server API to activate session
      const response = await axios.post(`http://${ip}:${port}/api/license/activate-session`, {
        clientId,
        uuid,
        macAddress,
        hostname,
        username
      });

      const { data } = response;

      if (!data.success) {
        throw new Error("Session activation failed");
      }

      sessionManager.setUser({ userId: user.id, email: user.email, role: user.role, name: user.name });
      log.info("Login User session activated:", sessionManager.getUser());

      log.info("Login License session activated:", data);

      // ✅ Start countdown based on license validity
      if (data.remainingSeconds && data.remainingSeconds > 0) {
        sessionManager.startLicenseCountdown(data.remainingSeconds);
      }


      return { success: true, user: credentials };
    } catch (error) {

      if (error.response && error.response.data.errorCode === "session-not-available") {
        log.info("Login error:", error.message, error.response.data);
        return { success: false, error: "Your session has expired. Please use a license from the network.", errorCode: "session-not-available" };
      }
      else {
        log.info("Login error:", error.message, error.response.data);
        return { success: false, error: "An unexpected error occurred" };
      }
    }
  });

  // Handle logout
  ipcMain.handle("auth:logout", async () => {
    try {
      return sessionManager.logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
      return { success: false, error: error.message };
    }
  });

  // Get user session
  ipcMain.handle("auth:getUser", () => {
    log.info("GetUser IPCMAIN : ", sessionManager.getUser());
    return sessionManager.getUser();
  });

  // Update user data
  ipcMain.handle("auth:updateUser", async (event, userData) => {
    try {
      return sessionManager.updateUser(userData);
    } catch (error) {
      console.error("Update user error:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("auth:signUp", async (event, credentials) => {
    let user;

    try {


      const userAlreadyExists = await db
        .select()
        .from(users)
        .where(eq(users.name, credentials.email));

      console.log("User already exists: ", userAlreadyExists);

      if (userAlreadyExists.length > 0) {
        // if (toValidateLicense) {
        return { success: false, error: "User already exists." };
        // }

        // user = userAlreadyExists;
      } else {
        // Step 3: Create New User
        const hashedPassword = await bcrypt.hash(credentials.password, 10);

        const dateJoined = new Date();
        const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        // console.log("dateJoined : ", dateJoined, "HashPassword : ", hashedPassword);
        try {
          user = await db
            .insert(users)
            .values({
              // name: credentials.name || credentials.email.split("@")[0],
              name: credentials.email,
              email: credentials.email,
              role: credentials.role,
              password: hashedPassword,
              dateJoined: dateJoined,
              expiryDate: expiryDate,
            })
            .returning();
        } catch (err) {
          log.info("Error in creating new user : ", err);
          return { success: false, error: "Failed to register user." };
        }

        // const remainingSeconds = licenseManager.calculateRemainingSeconds(
        //   result.data.expiry_timestamp
        // );
        // const storeResult = await licenseManager.storeLicense({
        //   licenseKey: credentials.licenseKey,
        //   email: credentials.email,
        // });

        // if (storeResult.success) {
        //   sessionManager.startLicenseCountdown(remainingSeconds);
        // }

        return {
          success: true,
          message: "User created successfully.",
          user: user[0],
        };
      }
    } catch (err) {
      log.info("Error in creating new user : ", err);
      return {
        success: false,
        error: "Failed to register user.",
      };
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

  // Set up IPC handler for direct password reset using local DB
  ipcMain.handle("auth:reset-password", async (event, data) => {
    // Validate input data
    if (!data || !data.email || !data.newPassword) {
      console.error("Password reset failed: Missing required fields");
      return {
        success: false,
        message: "Email and new password are required.",
      };
    }

    // Validate password strength
    if (data.newPassword.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters long.",
      };
    }

    try {
      if (!db) {
        console.error("Password reset failed: Database connection error");
        return {
          success: false,
          message: "Database connection error. Please try again later.",
        };
      }

      // Find the user by email
      let existingUser;
      try {
        existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, data.email))
          .get();
      } catch (dbError) {
        log.error("Error querying user:", dbError);
        return {
          success: false,
          message: "Failed to retrieve user information. Database error.",
        };
      }

      if (!existingUser) {
        log.info(
          `Password reset attempted for non-existent user: ${data.email}`
        );
        return {
          success: false,
          message:
            "Email/Username not found. Please check your entry and try again.",
        };
      }

      // Hash the new password
      let hashedPassword;
      try {
        // const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(data.newPassword, 10);
      } catch (hashError) {
        console.error("Error hashing password:", hashError);
        return {
          success: false,
          message: "Failed to process your new password. Please try again.",
        };
      }

      // Update the user's password in the database
      try {
        await db
          .update(users)
          .set({
            password: hashedPassword,
            lastLogin: new Date(),
          })
          .where(eq(users.email, data.email))
          .run();
      } catch (updateError) {
        log.error("Error updating password in database:", updateError);
        return {
          success: false,
          message:
            "Failed to update password in database. Please try again later.",
        };
      }

      log.info(`Password successfully reset for user: ${data.email}`);
      return {
        success: true,
        message: "Password has been reset successfully",
      };
    } catch (error) {
      // Catch any other unexpected errors
      log.error("Unexpected error during password reset:", error);

      // Check if it's a database-related error
      if (
        error.code &&
        (error.code.includes("SQLITE") || error.code.includes("DB"))
      ) {
        return {
          success: false,
          message: "Database error occurred. Please try again later.",
        };
      }

      // Generic error response
      return {
        success: false,
        message:
          "An unexpected error occurred while resetting your password. Please try again later.",
      };
    }
  });


  ipcMain.handle('auth:check-account-status', async () => {
    try {
      // Query to select one user from the 'users' table
      const result = await db.select().from(users).limit(1);

      // Print the length of the result array to the console
      console.log("Number of users found:", result.length);

      // Return "yes" if a user exists, false otherwise
      return (result && result.length > 0) ? { "success": true, "message": "Users found" } : { "success": false, "message": "No users found" };
    } catch (error) {
      // Log error details and return false in case of failure
      console.error("Error while checking account status:", error);
      return { "success": false, "message": "Failed to check account status" };
    }
  });


  ipcMain.handle("license:check", async () => {
    try {
      const isValid = await licenseManager.checkActivation();

      return {
        success: isValid,
        message: isValid ? "License key is valid." : "Invalid license key.",
      };
    } catch (error) {
      console.error("Error validating license key:", error);
      return { success: false, message: "Failed to validate license key." };
    }
  });


  ipcMain.handle("license:activate", async (event, args) => {

    const { licenseKey, role } = args;
    const uuid_hash = await systemInformation.getHashedUUID();
    console.log("UUID Hash:", uuid_hash);
    const serverUrl = "http://localhost:7890/api/health";

    try {
      // ✅ Check first if it's already running
      const alreadyRunning = await isServerRunning(serverUrl);

      if (!alreadyRunning) {
        log.info("Starting license gateway server...");
        await gatewayServer.initialize();
        const alreadyRunning = await isServerRunning(serverUrl);
        log.info("License gateway server started.");
        // Wait until the server is responsive
        await waitUntilServerIsReady(serverUrl, 10000);
      } else {
        log.info("License gateway server already running.");
      }

      const deviceInfo = {
        uuid: systemInformation.getUUID(),
        macAddress: systemInformation.getMACAddress(),
        hostname: systemInformation.getHostname(),
        windowsUserSID: systemInformation.getWindowsUserSID(),
        username: systemInformation.getUsername(),
      }
      const response = await axios.post("http://localhost:7890/api/activate-license", {
        licenseKey,
        role,
        deviceInfo
      });

      if (response.status === 200) {
        log.info("License activated successfully:", response.data);
        return { success: true, data: response.data };
      } else {
        log.error("License activation failed:", response.data.message);
        return { success: false, error: response.data.message || "Invalid license" };
      }
    } catch (err) {
      log.error("Error activating license:", err.message);
      return { success: false, error: "License service not reachable." };
    }
  });


  // IPC Handler for searching network licenses using mDNS discovery,
  // then validating each discovered service via its /api/validate-license endpoint.
  ipcMain.handle("license:search-network-licenses", async (event, networkLicense) => {
    try {
      // Determine service type (default to "license" if not provided)
      const serviceType = networkLicense?.serviceType || "license-server";
      let discoveredServices = [];

      // Run both discoveries in parallel
      const [mdnsServices, udpServices] = await Promise.all([
        discoverMdnsServices(serviceType, 5000),
        discoverUdpBroadcastServices(5000)
      ]);


      if (mdnsServices.length >= udpServices.length) {
        discoveredServices = mdnsServices;
        if (mdnsServices.length === 0) {
          log.info("No services found via either mDNS or UDP.");
        } else {
          log.info(`Using mDNS results (${mdnsServices.length} services).`);
        }
      } else {
        discoveredServices = udpServices;
        log.info(`Using UDP broadcast results (${udpServices.length} services).`);
      }
      log.info("Final discovered services:", discoveredServices);

      // log.info("Discovered services:", discoveredServices);
      const validatedServices = [];
      const now = Date.now() / 1000; // current time in seconds

      // Iterate over discovered services and validate each one
      for (const service of discoveredServices) {
        try {
          // Construct the validation URL (assuming the endpoint is /api/validate-license)
          const url = `http://${service.ip}:${service.port}/api/validate-license`;
          // Send a POST request (empty body or you can add required data)
          const response = await axios.post(url, {});

          // Check response validity:
          // Assume a valid response has response.data.status === "OK"
          // and an expiry_timestamp greater than current time.
          if (response.data && response.data.status === "OK" && response.data.expiry_timestamp > now) {
            validatedServices.push({
              ...service,
              validation: response.data
            });
          }
        } catch (err) {
          log.error("Validation error for service", service, ":", err.message);
          // Skip this service if validation fails.
        }
      }

      return { success: true, licenses: validatedServices };
    } catch (error) {
      log.error("Error searching network licenses:", error);
      return { success: false, error: error.message };
    }
  });


  ipcMain.handle("license:connect-network-license", async (event, licenseData) => {
    log.info("Connecting to network license:", licenseData);
    try {
      const { ip, port } = licenseData;
      if (!ip || !port) throw new Error("An unexpected error occurred.");

      const uuid = systemInformation.getUUID(); // assuming you defined this somewhere
      const uuidHash = systemInformation.getHashedUUID(); // assuming you defined this somewhere
      const macAddress = systemInformation.getMACAddress(); // assuming you defined this somewhere
      const hostname = systemInformation.getHostname(); // assuming you defined this somewhere
      const windowsUserSID = systemInformation.getWindowsUserSID(); // assuming you defined this somewhere
      const username = systemInformation.getUsername(); // assuming you defined this somewhere

      log.info("Details for license connection:",
        uuid,
        uuidHash,
        macAddress,
        windowsUserSID,
        hostname,
        username,
      );

      const response = await axios.post(`http://${ip}:${port}/api/license/assign`, {
        clientId: windowsUserSID,
        uuid: uuid,
        hostname: hostname,
        username: username,
        macAddress: macAddress,
      });

      log.info("License assignment response:", response.data);

      const { message, activeCount, maxUsers, ...data } = response.data;

      if (response.data.success) {

        const enrichedLicenseData = {
          ...data,
          clientId: windowsUserSID,
          uuid,
          hostname,
          macAddress,
          username,
          ip,
          port
        };

        const encryptedData = await encryptData(JSON.stringify(enrichedLicenseData));

        const filePath = path.join(userDataPath, "clientLicense.enc");
        fs.writeFile(filePath, encryptedData, (err) => {
          if (err) {
            log.error("Failed to write license file:", err);
          } else {
            log.info("License file saved successfully at:", filePath);
            licenseManager.setLicenseInfo(enrichedLicenseData);
            licenseManager.isActivated = true;
          }
        });
        return { success: true, data: enrichedLicenseData };
      }
      else {
        log.error("License assignment failed:", response.data.message);
        return { success: false, error: "License assignment failed. An unexpected error occurred." };
      }

    } catch (error) {
      if (error.response) {
        log.error("License assignment error:", error.response.data, error.message);
        if (error.response.data.inactiveLicenses) {
          return {
            success: false,
            error: error.response.data.error,
            inactiveLicenses: error.response.data.inactiveLicenses,
          };
        } else if (error.response.data.activeLicenses) {
          return {
            success: false,
            error: error.response.data.error,
            activeLicenses: error.response.data.activeLicenses
          };
        }
      }
      else {
        log.error("License connection error:", error.message);
        return { success: false, error: "License connection failed. An unexpected error occurred." };
      }
    }
  });


  ipcMain.handle("license:revoke-session", async (event, licenseData) => {
    log.info("Revoking license session:", licenseData);

    const { sessionKey, ip, port } = licenseData;

    try {
      const response = await axios.post(`http://${ip}:${port}/api/license/revoke-session`, {
        sessionKey: sessionKey,
      });

      log.info("License revocation response:", response.data);
      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        log.error("License revocation failed:", response.data.message);
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      log.error("License revocation error:", error.message);
      return { success: false, error: error.message };
    }
  })

};

module.exports = { registerAuthHandlers };
