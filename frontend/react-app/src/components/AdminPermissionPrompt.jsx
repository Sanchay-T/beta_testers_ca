import React from "react";

export const AdminPermissionPrompt = ({
    onRestartAsAdmin,
}) => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl w-full max-w-md">
                <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">
                    Administrator Access Needed
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">
                    This action requires administrator privileges. Please restart the application with elevated rights to proceed.
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
                        onClick={() => window.close()} // Optional close action
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onRestartAsAdmin}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
                    >
                        Restart as Admin
                    </button>
                </div>
            </div>
        </div>
    );
};
