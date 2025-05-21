const { dialog, ipcMain } = require('electron');
const sudo = require('sudo-prompt')
const log = require('electron-log');
const path = require('path');


function registerAppLevelIPCHandlers(appInstance, appWindow, base_dir) {

    ipcMain.handle('app:check-admin-rights', async () => {

        const isElevated = await import('is-elevated');
        const elevated = await isElevated.default();

        return { elevated: elevated };
    });


    ipcMain.on("app:relaunchAsAdmin", () => {

        const isDev = !appInstance.isPackaged;

        const electronPath = path.join(base_dir, 'node_modules', 'electron', 'dist', 'electron.exe');

        const entryPath = path.join(base_dir, 'main.js'); // Adjust this path to your actual entry file

        log.info("Electron Binary Path: ", electronPath);
        log.info("Entry Path: ", entryPath);

        const execCommand = isDev
            ? `"${electronPath}" "${entryPath}"`
            : `"${process.execPath}"`;


        sudo.exec(execCommand, { name: "Cyphersol" }, (error, stdout, stderr) => {
            if (error) {
                log.error("Failed to relaunch as admin:", error);
                throw error;
            }

            console.log('Relaunch Stdout: ' + stdout);
        });

        setTimeout(() => {
            appInstance.exit(0);
        }, 500); // 300ms is usually enough; tweak if needed    });

    })
}


module.exports = { registerAppLevelIPCHandlers };