import React, { useEffect, useState } from "react";
import { toast } from "../hooks/use-toast";

const UpdateNotification = () => {
  const [updateStatus, setUpdateStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [systemRequirementsInfo, setSystemRequirementsInfo] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const { updates, system } = window.electron;

  // Handle install update with full-screen modal
  const handleInstallUpdate = async () => {
    console.log('[UPDATE-UI] User clicked "Restart Now"');
    console.log('[UPDATE-UI] Showing full-screen installation modal');
    setIsInstalling(true);

    // Wait 3 seconds to show user the modal before quitting
    setTimeout(async () => {
      console.log('[UPDATE-UI] Triggering installUpdate()');
      await updates.installUpdate();
    }, 3000);
  };

  useEffect(() => {
    // Set up update event listeners with detailed logging
    updates.onUpdateStatus((status, info) => {
      // console.log('Update status:', status, info);
      setUpdateStatus(status);
      
      // Handle system requirements failure
      if (status === "system-requirements-failed") {
        setSystemRequirementsInfo(info);
        toast({
          title: "Update Paused",
          description: (
            <div className="space-y-2">
              <p className="text-sm text-amber-800">
                Update has been paused due to system requirements.
              </p>
              <p className="text-xs text-gray-600">
                Your system has less than 8GB RAM which may affect app performance during updates.
              </p>
              <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                <strong>Detected:</strong> {info?.requirements?.memoryGB}GB RAM<br/>
                <strong>Recommended:</strong> 8GB RAM minimum
              </div>
            </div>
          ),
          variant: "default",
          duration: 0, // Keep until dismissed
          action: (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  window.electron.shell.openExternal("https://support.microsoft.com/en-us/windows/view-your-system-info-a965a8f2-0773-1d65-472a-1e747c9ebe00");
                }}
                className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-md"
              >
                Check System
              </button>
            </div>
          ),
        });
        return;
      }
      
      if (status === "available") {
        toast({
          title: "Update Available",
          description: `A new version (${
            info?.version || "unknown"
          }) is available. Would you like to download it?`,
          action: (
            <button
              onClick={() => updates.downloadUpdate()}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
            >
              Download
            </button>
          ),
          duration: 0, // Keep until user acts
        });
      }
    });
    updates.onUpdateProgress((progressObj) => {
      setProgress(progressObj.percent || 0);
      if (progressObj.percent === 100) {
        toast({
          title: "Update Downloaded",
          description: "Update will be installed on restart",
          duration: 5000,
        });
      }
    });
    updates.onUpdateDownloaded((info) => {
      // console.log('Update downloaded:', info);
      setUpdateStatus("ready");
      toast({
        title: "Update Ready",
        description: `Version ${
          info?.version || "unknown"
        } has been downloaded and will be installed on restart`,
        action: (
          <button
            onClick={handleInstallUpdate}
            className="px-3 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
          >
            Restart Now
          </button>
        ),
        duration: 0,
      });
    });

    updates.onUpdateError((error) => {
      setUpdateStatus("error");
      // toast({
      //   title: "Update Error",
      //   description: error,
      //   variant: "destructive",
      // });
    });

    // Check for updates initially
    updates.checkForUpdates().catch(console.error);

    // Cleanup
    return () => updates.removeUpdateListeners();
  }, []);

  if (updateStatus === "idle" || updateStatus === "checking") {
    return null;
  }

  // System requirements failed - only show toast, no persistent UI
  if (updateStatus === "system-requirements-failed" && systemRequirementsInfo) {
    return null; // Toast notification is handled in the event listener above
  }

  if (updateStatus === "downloading") {
    return (
      <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="text-sm font-medium">Downloading Update</h3>
        <div className="mt-2 h-2 w-full bg-secondary rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {progress.toFixed(1)}%
        </p>
      </div>
    );
  }

  // Full-screen installation modal
  if (isInstalling) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        color: 'white',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '30px',
          animation: 'spin 2s linear infinite'
        }}>
          ⚙️
        </div>
        <h2 style={{
          fontSize: '32px',
          fontWeight: '600',
          marginBottom: '20px',
          letterSpacing: '-0.5px'
        }}>
          Installing Update
        </h2>
        <p style={{
          fontSize: '18px',
          color: '#94a3b8',
          maxWidth: '500px',
          textAlign: 'center',
          lineHeight: '1.6',
          marginBottom: '30px'
        }}>
          CypherEdge is being updated to the latest version.
          <br />
          The application will restart automatically in a few moments.
        </p>
        <div style={{
          display: 'flex',
          gap: '15px',
          alignItems: 'center',
          fontSize: '16px',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ animation: 'pulse 1.4s infinite ease-in-out', animationDelay: '0s' }}>●</span>
            <span style={{ animation: 'pulse 1.4s infinite ease-in-out', animationDelay: '0.2s' }}>●</span>
            <span style={{ animation: 'pulse 1.4s infinite ease-in-out', animationDelay: '0.4s' }}>●</span>
          </div>
          <span>Please do not close this window</span>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  return null;
};

export default UpdateNotification;
