import React, { useEffect, useState } from "react";
import { toast } from "../hooks/use-toast";

const UpdateNotification = () => {
  const [updateStatus, setUpdateStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [systemRequirementsInfo, setSystemRequirementsInfo] = useState(null);
  const { updates, system } = window.electron;

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
            onClick={() => updates.installUpdate()}
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

  return null;
};

export default UpdateNotification;
