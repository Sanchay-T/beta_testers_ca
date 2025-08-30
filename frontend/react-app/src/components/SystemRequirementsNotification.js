import React, { useEffect, useState } from "react";
import { toast } from "../hooks/use-toast";

const SystemRequirementsNotification = () => {
  const [systemRequirements, setSystemRequirements] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const { system } = window.electron;

  useEffect(() => {
    // Get initial system requirements on component mount
    system.getSystemRequirements()
      .then((requirements) => {
        setSystemRequirements(requirements);
        
        // Show notification if requirements are not met and updates are blocked
        if (requirements.shouldBlockUpdates) {
          setShowNotification(true);
          showSystemRequirementsToast(requirements);
        }
      })
      .catch((error) => {
        console.error("Failed to get system requirements:", error);
      });

    // Listen for system requirements updates from the main process
    system.onSystemRequirementsCheck((requirements) => {
      setSystemRequirements(requirements);
      if (requirements.shouldBlockUpdates) {
        setShowNotification(true);
        showSystemRequirementsToast(requirements);
      }
    });

    // Cleanup
    return () => {
      system.removeSystemRequirementsListeners();
    };
  }, []);

  const showSystemRequirementsToast = (requirements) => {
    const ramInfo = requirements.requirements ? 
      `${requirements.requirements.memoryGB}GB RAM detected` : 
      `${requirements.memoryGB}GB RAM detected`;

    toast({
      title: "System Requirements Notice",
      description: (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-800">
            We've detected that your system has less than 8GB of RAM. 
          </p>
          <p className="text-xs text-gray-600">
            This may limit the performance of advanced features, such as real-time processing 
            or seamless multitasking, in our app. Updates have been paused for system stability.
          </p>
          <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
            <strong>Current System:</strong><br/>
            • RAM: {ramInfo}<br/>
            {requirements.cpuModel && (
              <>• Processor: {requirements.cpuModel.substring(0, 40)}...</>
            )}
          </div>
        </div>
      ),
      variant: "default",
      duration: 0, // Keep until manually dismissed
      className: "max-w-md",
      action: (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              window.electron.shell.openExternal("https://support.microsoft.com/en-us/windows/view-your-system-info-a965a8f2-0773-1d65-472a-1e747c9ebe00");
            }}
            className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-md"
          >
            Check System Settings
          </button>
          <button
            onClick={() => setShowNotification(false)}
            className="px-3 py-1 text-xs bg-gray-600 text-white hover:bg-gray-700 rounded-md"
          >
            Dismiss
          </button>
        </div>
      ),
    });
  };



  return null;
};

export default SystemRequirementsNotification;