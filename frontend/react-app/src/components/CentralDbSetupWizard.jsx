import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Server,
  RefreshCw,
  AlertTriangle,
  Database,
  Download,
  FolderOpen,
  Edit,
  Wifi,
  Shield,
  Radio,
  Search,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

// Animation variants for smooth transitions
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
};

export function CentralDbSetupWizard({ onComplete }) {
  const navigate = useNavigate();
  
  // Core states for the wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [dbMode, setDbMode] = useState("centralized");
  const [prerequisites, setPrerequisites] = useState({
    networkConnectivity: false,
    mDnsAvailability: false,
    firewallAllowance: false,
    allChecked: false,
  });
  const [prerequisiteConfirmed, setPrerequisiteConfirmed] = useState(false);
  const [installPath, setInstallPath] = useState("");
  const [discoveredServers, setDiscoveredServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [provisioningLogs, setProvisioningLogs] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [statusData, setStatusData] = useState({
    status: "pending",
    logs: [],
    error: null,
  });
  const [manualConfig, setManualConfig] = useState({
    host: "",
    port: "5432",
    username: "postgres",
    password: "postgres"
  });
  const [testConnectionResult, setTestConnectionResult] = useState(null);

  // Poll for provision status
  useEffect(() => {
    if (!pollingEnabled) return;
    
    const pollInterval = setInterval(async () => {
      try {
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.getProvisionStatus();
        
        // Check if we have more logs than before
        if (data.logs && data.logs.length > statusData.logs.length) {
          setStatusData(data);
          
          // If operation is complete or failed, stop polling
          if (data.status === "completed" || data.status === "error") {
            setPollingEnabled(false);
          }
        }
      } catch (error) {
        console.error("Failed to poll status:", error);
        setPollingEnabled(false);
      }
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [pollingEnabled, statusData.logs.length, statusData.status]);

  // All side effects moved to the top level of the component
  // Get default install path on component mount
  useEffect(() => {
    // Default path based on OS
    const getDefaultPath = async () => {
      try {
        const osInfo = await window.electron.system.getOSInfo();
        let defaultPath;
        
        if (osInfo.platform === "win32") {
          defaultPath = `${osInfo.homedir}\\AppData\\Local\\CypherSol\\pgsql-data`;
        } else if (osInfo.platform === "darwin") {
          defaultPath = `${osInfo.homedir}/.cyphersol/pgsql-data`;
        } else {
          defaultPath = `${osInfo.homedir}/.cyphersol/pgsql-data`;
        }
        
        setInstallPath(defaultPath);
      } catch (error) {
        // Fallback to a generic path if OS info is unavailable
        setInstallPath("C:\\ProgramData\\CypherSol\\pgsql-data");
      }
    };
    
    getDefaultPath();
  }, []);

  // Check prerequisites automatically
  useEffect(() => {
    if (currentStep !== 2) return;
    
    const checkPrerequisites = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Use IPC instead of direct fetch calls
        const result = await window.electron.db.checkPrerequisites();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        setPrerequisites({
          networkConnectivity: result.networkConnectivity,
          mDnsAvailability: result.mDnsAvailability,
          firewallAllowance: result.firewallAllowance,
          allChecked: true,
        });
      } catch (err) {
        setError("Failed to check prerequisites: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkPrerequisites();
  }, [currentStep]);
  
  // Handle database discovery
  useEffect(() => {
    if (currentStep !== 3) return;
    
    const discoverDatabases = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.discover();
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        setDiscoveredServers(data);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to discover databases: " + err.message);
        setIsLoading(false);
      }
    };
    
    discoverDatabases();
  }, [currentStep]);
  
  // Handle downloading binaries
  useEffect(() => {
    if (currentStep !== 6) return;
    
    const downloadBinaries = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPollingEnabled(true);
        setStatusData({
          status: "pending",
          logs: [],
          error: null,
        });
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.downloadBinaries({ path: installPath });
        
        if (!data.success) {
          throw new Error(data.error || "Failed to start download");
        }
      } catch (err) {
        setError("Failed to download binaries: " + err.message);
        setIsLoading(false);
        setPollingEnabled(false);
      }
    };
    
    downloadBinaries();
  }, [currentStep, installPath]);
  
  // Handle extract binaries
  useEffect(() => {
    if (currentStep !== 7) return;
    
    const extractBinaries = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPollingEnabled(true);
        setStatusData({
          status: "pending",
          logs: [],
          error: null,
        });
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.extractBinaries({ path: installPath });
        
        if (!data.success) {
          throw new Error(data.error || "Failed to extract binaries");
        }
      } catch (err) {
        setError("Failed to extract binaries: " + err.message);
        setIsLoading(false);
        setPollingEnabled(false);
      }
    };
    
    extractBinaries();
  }, [currentStep, installPath]);
  
  // Handle initialize cluster
  useEffect(() => {
    if (currentStep !== 8) return;
    
    const initializeCluster = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPollingEnabled(true);
        setStatusData({
          status: "pending",
          logs: [],
          error: null,
        });
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.initCluster({ path: installPath });
        
        if (!data.success) {
          throw new Error(data.error || "Failed to initialize database cluster");
        }
      } catch (err) {
        setError("Failed to initialize database cluster: " + err.message);
        setIsLoading(false);
        setPollingEnabled(false);
      }
    };
    
    initializeCluster();
  }, [currentStep, installPath]);
  
  // Handle start postgres
  useEffect(() => {
    if (currentStep !== 9) return;
    
    const startPostgres = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPollingEnabled(true);
        setStatusData({
          status: "pending",
          logs: [],
          error: null,
        });
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.startPostgres({ path: installPath });
        
        if (!data.success) {
          throw new Error(data.error || "Failed to start PostgreSQL server");
        }
      } catch (err) {
        setError("Failed to start PostgreSQL server: " + err.message);
        setIsLoading(false);
        setPollingEnabled(false);
      }
    };
    
    startPostgres();
  }, [currentStep, installPath]);
  
  // Handle advertise via mDNS
  useEffect(() => {
    if (currentStep !== 10) return;
    
    const advertiseService = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setPollingEnabled(true);
        setStatusData({
          status: "pending",
          logs: [],
          error: null,
        });
        
        const osInfo = await window.electron.system.getOSInfo();
        const hostname = osInfo.hostname || "this-machine.local";
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.advertiseMdns({ hostname, port: 5432 });
        
        if (!data.success) {
          throw new Error(data.error || "Failed to advertise database service");
        }
        
        setSelectedServer({
          host: hostname,
          port: 5432,
        });
      } catch (err) {
        setError("Failed to advertise database service: " + err.message);
        setIsLoading(false);
        setPollingEnabled(false);
      }
    };
    
    advertiseService();
  }, [currentStep]);
  
  // Auto-test connection when coming from discovery
  useEffect(() => {
    if (currentStep === 11 && selectedServer && !testConnectionResult) {
      const testConnection = async () => {
        try {
          setIsLoading(true);
          setError(null);
          setTestConnectionResult(null);
          
          const connectionDetails = selectedServer || manualConfig;
          
          if (!selectedServer && manualConfig.host) {
            setSelectedServer({
              host: manualConfig.host,
              port: parseInt(manualConfig.port),
            });
          }
          
          const response = await fetch("http://localhost:7890/db/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: connectionDetails.host,
              port: connectionDetails.port,
              user: "postgres",
              password: "postgres", 
            }),
          });
          
          const data = await response.json();
          setTestConnectionResult(data);
          setIsLoading(false);
        } catch (err) {
          setError("Connection test failed: " + err.message);
          setTestConnectionResult({ success: false, error: err.message });
          setIsLoading(false);
        }
      };
      
      testConnection();
    }
  }, [currentStep, selectedServer, testConnectionResult, manualConfig]);
  
  // Track completion status
  useEffect(() => {
    const completionStatuses = [6, 7, 8, 9, 10];
    if (completionStatuses.includes(currentStep) && statusData.status === "completed") {
      setIsLoading(false);
    }
  }, [statusData.status, currentStep]);

  // Render the current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderDatabaseModeSelection();
      case 2:
        return renderPrerequisitesCheck();
      case 3:
        return renderDiscoverDatabase();
      case 4:
        return renderSelectInstallPath();
      case 5:
        return renderConfirmDownload();
      case 6:
        return renderDownloadBinaries();
      case 7:
        return renderExtractBinaries();
      case 8:
        return renderInitializeCluster();
      case 9:
        return renderStartPostgres();
      case 10:
        return renderAdvertiseMdns();
      case 11:
        return renderValidateConnection();
      case 12:
        return renderDone();
      default:
        return <div>Unknown step</div>;
    }
  };

  // Progress steps indicator
  const renderProgressSteps = () => {
    return (
      <div className="flex justify-center mb-6">
        <div className="flex space-x-2">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors duration-300",
                currentStep > i + 1
                  ? "bg-green-500"
                  : currentStep === i + 1
                  ? "bg-blue-600"
                  : "bg-gray-300"
              )}
            />
          ))}
        </div>
      </div>
    );
  };

  // Step 1: Choose Database Mode
  const renderDatabaseModeSelection = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Choose Database Mode</Label>
          <p className="text-sm text-gray-500">
            Select how you want to store your data
          </p>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <input
              type="radio"
              id="centralized"
              name="dbMode"
              value="centralized"
              checked={dbMode === "centralized"}
              onChange={() => setDbMode("centralized")}
              className="mt-1"
            />
            <div>
              <Label htmlFor="centralized" className="text-base font-medium">
                Centralized Database
              </Label>
              <p className="text-sm text-gray-500">
                Set up a central database that multiple users can access. Ideal for team environments.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <input
              type="radio"
              id="local"
              name="dbMode"
              value="local"
              checked={dbMode === "local"}
              onChange={() => setDbMode("local")}
              className="mt-1"
              disabled
            />
            <div>
              <Label htmlFor="local" className="text-base font-medium text-gray-400">
                Local Database
              </Label>
              <p className="text-sm text-gray-400">
                Store data locally on this device only. Best for single users. (Coming soon)
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end pt-4">
          <Button 
            onClick={() => setCurrentStep(2)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Helper component for live logs
  const LiveLogsViewer = ({ logs }) => {
    const logsEndRef = useRef(null);
    
    useEffect(() => {
      // Auto-scroll to bottom when logs update
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);
    
    return (
      <div className="border rounded-md bg-black text-green-400 p-2 h-40 overflow-y-auto font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">Waiting for logs...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    );
  };

  // Step 2: Prerequisites Check
  const renderPrerequisitesCheck = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Prerequisites Check</Label>
          <p className="text-sm text-gray-500">
            Ensure your system meets the requirements for a centralized database setup
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span>Checking system requirements...</span>
          </div>
        ) : error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(2)}
            >
              Retry
            </Button>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5 text-gray-600" />
                  <span>Network connectivity (port 5432)</span>
                </div>
                {prerequisites.allChecked && (
                  prerequisites.networkConnectivity ? 
                  <CheckCircle className="h-5 w-5 text-green-500" /> :
                  <X className="h-5 w-5 text-red-500" />
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Radio className="h-5 w-5 text-gray-600" />
                  <span>mDNS/Bonjour availability</span>
                </div>
                {prerequisites.allChecked && (
                  prerequisites.mDnsAvailability ? 
                  <CheckCircle className="h-5 w-5 text-green-500" /> :
                  <X className="h-5 w-5 text-red-500" />
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-gray-600" />
                  <span>Firewall allowance for port 5432</span>
                </div>
                {prerequisites.allChecked && (
                  prerequisites.firewallAllowance ? 
                  <CheckCircle className="h-5 w-5 text-green-500" /> :
                  <X className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
            
            {prerequisites.allChecked && (
              !prerequisites.networkConnectivity || 
              !prerequisites.mDnsAvailability || 
              !prerequisites.firewallAllowance
            ) && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  Some prerequisites are not met. You may proceed, but database setup might fail.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="confirm-prereq"
                checked={prerequisiteConfirmed}
                onChange={(e) => setPrerequisiteConfirmed(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="confirm-prereq" className="text-sm">
                I confirm that my system meets the requirements or I'll resolve the issues.
              </Label>
            </div>
            
            <div className="flex justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)}
                disabled={!prerequisiteConfirmed}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // Step 3: Discover Central DB
  const renderDiscoverDatabase = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Discover Central Database</Label>
          <p className="text-sm text-gray-500">
            Looking for existing database servers on your network
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <Search className="h-8 w-8 animate-pulse text-blue-600" />
            <span>Scanning network...</span>
          </div>
        ) : error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(3)}
            >
              Retry
            </Button>
          </Alert>
        ) : discoveredServers.length > 0 ? (
          <div className="space-y-4">
            <Label htmlFor="server-select">Select a Server</Label>
            <select
              id="server-select"
              className="w-full p-2 border rounded-md"
              value={selectedServer ? `${selectedServer.host}:${selectedServer.port}` : ""}
              onChange={(e) => {
                const [host, port] = e.target.value.split(":");
                setSelectedServer({ host, port: parseInt(port) });
              }}
            >
              <option value="">-- Select a Server --</option>
              {discoveredServers.map((server, index) => (
                <option key={index} value={`${server.host}:${server.port}`}>
                  {server.host}:{server.port}
                </option>
              ))}
            </select>
            
            <div className="flex justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(11)}
                disabled={!selectedServer}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center py-2">No database servers found on your network.</p>
            
            <div className="flex justify-center space-x-4 pt-2">
              <Button 
                onClick={() => setCurrentStep(4)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Server className="mr-2 h-4 w-4" />
                Provision Here
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedServer({ host: "", port: 5432 });
                  setCurrentStep(11);
                }}
                className="flex-1"
              >
                <Edit className="mr-2 h-4 w-4" />
                Enter Manually
              </Button>
            </div>
            
            <div className="flex justify-start pt-4">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // Step 4: Select Install Path
  const renderSelectInstallPath = () => {
    const handleBrowse = async () => {
      try {
        const result = await window.electron.dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select Install Directory'
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          setInstallPath(result.filePaths[0]);
        }
      } catch (err) {
        console.error("Error selecting directory:", err);
      }
    };
    
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Select Installation Path</Label>
          <p className="text-sm text-gray-500">
            Choose where to install the database files
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="install-path">Installation Directory</Label>
            <div className="flex space-x-2">
              <Input
                id="install-path"
                value={installPath}
                onChange={(e) => setInstallPath(e.target.value)}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={handleBrowse}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(3)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={() => setCurrentStep(5)}
              disabled={!installPath}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Step 5: Confirm Download
  const renderConfirmDownload = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Confirm Download</Label>
          <p className="text-sm text-gray-500">
            We will now download PostgreSQL binaries
          </p>
        </div>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p>
            We will now download (~10 MB) PostgreSQL binaries into:
          </p>
          <p className="font-mono text-sm mt-2 p-2 bg-gray-100 rounded">
            {installPath}
          </p>
        </div>
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(4)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => setCurrentStep(6)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Proceed
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 6: Download Binaries
  const renderDownloadBinaries = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Downloading PostgreSQL</Label>
          <p className="text-sm text-gray-500">
            Downloading database binaries to your system
          </p>
        </div>
        
        <LiveLogsViewer logs={statusData.logs} />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Downloading...</span>
          </div>
        ) : statusData.error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{statusData.error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(6)}
            >
              Retry
            </Button>
          </Alert>
        ) : statusData.status === "completed" ? (
          <div className="flex items-center justify-center py-2 text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>Download completed successfully!</span>
          </div>
        ) : null}
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setPollingEnabled(false);
              setCurrentStep(5);
            }}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => setCurrentStep(7)}
            disabled={isLoading || statusData.error || statusData.status !== "completed"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 7: Extract Binaries
  const renderExtractBinaries = () => {
    
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Extracting PostgreSQL</Label>
          <p className="text-sm text-gray-500">
            Extracting and preparing database files
          </p>
        </div>
        
        <LiveLogsViewer logs={statusData.logs} />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Extracting files...</span>
          </div>
        ) : statusData.error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{statusData.error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(7)}
            >
              Retry
            </Button>
          </Alert>
        ) : statusData.status === "completed" ? (
          <div className="flex items-center justify-center py-2 text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>Extraction completed successfully!</span>
          </div>
        ) : null}
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setPollingEnabled(false);
              setCurrentStep(6);
            }}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => setCurrentStep(8)}
            disabled={isLoading || statusData.error || statusData.status !== "completed"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 8: Initialize Cluster
  const renderInitializeCluster = () => {
    
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Initializing Database Cluster</Label>
          <p className="text-sm text-gray-500">
            Setting up the PostgreSQL database cluster
          </p>
        </div>
        
        <LiveLogsViewer logs={statusData.logs} />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Initializing database cluster...</span>
          </div>
        ) : statusData.error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{statusData.error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(8)}
            >
              Retry
            </Button>
          </Alert>
        ) : statusData.status === "completed" ? (
          <div className="flex items-center justify-center py-2 text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>Database cluster initialized successfully!</span>
          </div>
        ) : null}
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setPollingEnabled(false);
              setCurrentStep(7);
            }}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => setCurrentStep(9)}
            disabled={isLoading || statusData.error || statusData.status !== "completed"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 9: Start Postgres
  const renderStartPostgres = () => {
    
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Starting PostgreSQL Server</Label>
          <p className="text-sm text-gray-500">
            Starting the database server
          </p>
        </div>
        
        <LiveLogsViewer logs={statusData.logs} />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Starting PostgreSQL server...</span>
          </div>
        ) : statusData.error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{statusData.error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(9)}
            >
              Retry
            </Button>
          </Alert>
        ) : statusData.status === "completed" ? (
          <div className="flex items-center justify-center py-2 text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>PostgreSQL server started successfully!</span>
          </div>
        ) : null}
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setPollingEnabled(false);
              setCurrentStep(8);
            }}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => setCurrentStep(10)}
            disabled={isLoading || statusData.error || statusData.status !== "completed"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 10: Advertise via mDNS
  const renderAdvertiseMdns = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Advertising Database Service</Label>
          <p className="text-sm text-gray-500">
            Making your database discoverable on the network via mDNS/Bonjour
          </p>
        </div>
        
        <LiveLogsViewer logs={statusData.logs} />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Setting up network discovery...</span>
          </div>
        ) : statusData.error ? (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">{statusData.error}</AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={() => setCurrentStep(10)}
            >
              Retry
            </Button>
          </Alert>
        ) : statusData.status === "completed" ? (
          <div className="flex items-center justify-center py-2 text-green-600">
            <CheckCircle className="h-6 w-6 mr-2" />
            <span>Database service is now discoverable!</span>
          </div>
        ) : null}
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setPollingEnabled(false);
              setCurrentStep(9);
            }}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => setCurrentStep(11)}
            disabled={isLoading || statusData.error || statusData.status !== "completed"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 11: Validate Connection
  const renderValidateConnection = () => {
    // This function is safe to keep here as it's not a React Hook
    // It's just a regular async function used by event handlers
    const testConnection = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setTestConnectionResult(null);
        
        const connectionDetails = selectedServer || manualConfig;
        
        // Update connection details if needed (for manually entered values)
        if (!selectedServer && manualConfig.host) {
          setSelectedServer({
            host: manualConfig.host,
            port: parseInt(manualConfig.port),
          });
        }
        
        // Use IPC instead of direct fetch call
        const data = await window.electron.db.validateConnection({
          host: connectionDetails.host,
          port: connectionDetails.port,
          user: "postgres",
          password: "postgres", // Default password
        });
        
        setTestConnectionResult(data);
        setIsLoading(false);
      } catch (err) {
        setError("Connection test failed: " + err.message);
        setTestConnectionResult({ success: false, error: err.message });
        setIsLoading(false);
      }
    };
    
    // If we're coming from a discovery or have a server selected, auto-test the connection
    if (currentStep === 11 && selectedServer && !testConnectionResult) {
      // We'll call this once when rendering
      // This is okay since it's not a hook but just a function call within the render function
      testConnection();
    }
    
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label className="text-base font-medium">Validate Database Connection</Label>
          <p className="text-sm text-gray-500">
            Test the connection to your PostgreSQL database
          </p>
        </div>
        
        {!selectedServer ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={manualConfig.host}
                onChange={(e) => setManualConfig({ ...manualConfig, host: e.target.value })}
                placeholder="localhost or IP address"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={manualConfig.port}
                onChange={(e) => setManualConfig({ ...manualConfig, port: e.target.value })}
                placeholder="5432"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Connection Details</Label>
            <div className="p-3 border rounded-md bg-gray-50">
              <div className="grid grid-cols-3 gap-1">
                <span className="text-gray-500">Host:</span>
                <span className="col-span-2 font-mono">{selectedServer.host}</span>
                
                <span className="text-gray-500">Port:</span>
                <span className="col-span-2 font-mono">{selectedServer.port}</span>
                
                <span className="text-gray-500">User:</span>
                <span className="col-span-2 font-mono">postgres</span>
              </div>
            </div>
          </div>
        )}
        
        {testConnectionResult && (
          <div className={cn(
            "p-3 border rounded-md",
            testConnectionResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          )}>
            {testConnectionResult.success ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span>Connection successful!</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span>{testConnectionResult.error || "Connection failed."}</span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-center">
          <Button 
            onClick={testConnection}
            disabled={isLoading || (!selectedServer && !manualConfig.host)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                Test Connection
              </>
            )}
          </Button>
        </div>
        
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              if (selectedServer) {
                // If coming from discovery or provisioning
                const prevStep = manualConfig.host ? 3 : 10;
                setCurrentStep(prevStep);
              } else {
                // If entered manually from discovery
                setCurrentStep(3);
              }
            }}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button 
            onClick={() => {
              // Store connection details in localStorage
              const dbConfig = selectedServer || {
                host: manualConfig.host,
                port: parseInt(manualConfig.port),
              };
              
              localStorage.setItem("dbConfig", JSON.stringify(dbConfig));
              setCurrentStep(12);
            }}
            disabled={isLoading || !testConnectionResult || !testConnectionResult.success}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Finish
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Step 12: Done
  const renderDone = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="space-y-6 text-center"
      >
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Central Database Ready!</h3>
          <p className="text-gray-500">
            Your central database has been successfully set up and configured.
            Other clients can now discover it on your network.
          </p>
        </div>
        
        <div className="pt-4">
          <Button 
            onClick={() => {
              // Navigate to the main application
              if (onComplete) {
                onComplete();
              } else {
                // Default navigation if no callback provided
                navigate("/dashboard");
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            Launch Application
          </Button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-4"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Database Setup Wizard</h1>
          <p className="text-sm text-gray-500">Step {currentStep} of 12</p>
        </div>
        
        {renderProgressSteps()}
        
        <Card>
          <CardContent className="pt-6">
            {renderCurrentStep()}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
