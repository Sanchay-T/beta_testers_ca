const { dialog, ipcMain } = require('electron');

function registerAppLevelIPCHandlers(appInstance) {

    ipcMain.handle('app:check-admin-rights', async () => {

        const isElevated = await import('is-elevated');
        const elevated = await isElevated.default();

        if (!elevated) {
            const result = await dialog.showMessageBox({
                type: 'warning',
                buttons: ['Restart as Admin', 'Cancel'],
                defaultId: 0,
                cancelId: 1,
                title: 'Administrator Required',
                message:
                    'This action requires administrative privileges.\n\nWould you like to restart the app as Administrator?',
            });

            if (result.response === 0) {
                appInstance.relaunch({ args: process.argv.slice(1), execPath: process.execPath, handleSquirrelEvent: false });
                appInstance.exit();
                return { restarting: true }; // ⚠ Will likely not reach here, but added for completeness
            }

            return { elevated: false };
        }

        return { elevated: true };
    });

}


module.exports = { registerAppLevelIPCHandlers };