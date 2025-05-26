// utils/getSystemUUID.js
const si = require('systeminformation');
const log = require('electron-log'); // Replace with your actual logger if needed

async function getSystemUUID() {
    try {
        const data = await si.system();
        log.info("SystemInformation :", data); // Log the system information for debugging
        // Returns UUID from SMBIOS (Windows/macOS/Linux)
        return data.uuid;
    } catch (error) {
        // Fallback for Linux VMs/edge cases
        log.warn("Failed to get UUID using systeminformation. Error:", error.message);
        return getLinuxFallbackUUID();
    }
}

// Fallback for Linux (if systeminformation fails)
async function getLinuxFallbackUUID() {
    const fs = require('fs').promises;
    try {
        const uuid = await fs.readFile('/sys/class/dmi/id/product_uuid', 'utf8');
        return uuid.trim().toLowerCase();
    } catch (error) {
        // Last resort: Use machine-id (non-hardware, but stable)
        const machineId = await fs.readFile('/etc/machine-id', 'utf8');
        return machineId.trim().toLowerCase();
    }
}

module.exports = { getSystemUUID };