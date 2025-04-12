import React, { useEffect, useState } from 'react';
import { toast } from '../hooks/use-toast';

const UpdateNotification = () => {
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const { updates } = window.electron;

  useEffect(() => {
    // Set up update event listeners with detailed logging
    updates.onUpdateStatus((status, info) => {
      // console.log('Update status:', status, info);
      setUpdateStatus(status);
      if (status === 'available') {
        toast({
          title: "Update Available",
          description: `A new version (${info?.version || 'unknown'}) is available. Would you like to download it?`,
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
      setUpdateStatus('ready');
      toast({
        title: "Update Ready",
        description: `Version ${info?.version || 'unknown'} has been downloaded and will be installed on restart`,
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
      setUpdateStatus('error');
      toast({
        title: "Update Error",
        description: error,
        variant: "destructive",
      });
    });

    // Check for updates initially
    updates.checkForUpdates().catch(console.error);

    // Cleanup
    return () => updates.removeUpdateListeners();
  }, []);

  if (updateStatus === 'idle' || updateStatus === 'checking') {
    return null;
  }

  if (updateStatus === 'downloading') {
    return (
      <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="text-sm font-medium">Downloading Update</h3>
        <div className="mt-2 h-2 w-full bg-secondary rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{progress.toFixed(1)}%</p>
      </div>
    );
  }

  return null;
};

export default UpdateNotification;