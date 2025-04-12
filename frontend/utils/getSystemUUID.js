// utils/getSystemUUID.js
const si = require('systeminformation');

async function getSystemUUID() {
    try {
        const data = await si.system();
        // Returns UUID from SMBIOS (Windows/macOS/Linux)
        return data.uuid;
    } catch (error) {
        // Fallback for Linux VMs/edge cases
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