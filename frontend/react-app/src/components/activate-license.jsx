import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
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
import { useAuth } from "../contexts/AuthContext";
import { Alert, AlertDescription } from "./ui/alert";
import Logo from "../data/assets/logo.png";
import {
  Eye,
  EyeOff,
  Network,
  Key,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Server,
  Lock,
  UserPlus,
  AlertTriangle,
  RefreshCcw,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { motion } from "framer-motion";
// import { set } from "react-datepicker/dist/date_utils";

export function LicenseActivationForm({ className, ...props }) {
  const { login, loading, error, isActivated, isSignedUp, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activationMethod, setActivationMethod] = useState("direct");
  const [activationStep, setActivationStep] = useState(1);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    licenseKey: "",
    role: "CA",
  });
  const [networkLicense, setNetworkLicense] = useState({
    serverAddress: "",
    port: "27000",
    username: "",
  });
  const [networkLicenses, setNetworkLicenses] = useState([]);
  const [selectedNetworkLicense, setSelectedNetworkLicense] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activationStatus, setActivationStatus] = useState(null);
  const [isNetworkSearching, setIsNetworkSearching] = useState(false);
  // New state for inactive licenses
  const [inactiveLicenses, setInactiveLicenses] = useState([]);
  const [revokingLicense, setRevokingLicense] = useState(null);
  // Track modal open state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to close the modal
  const handleCloseModal = () => {
    setInactiveLicenses([]);
    setIsModalOpen(false);
  };

  // Option 1: Auto-open the modal if inactive licenses are present
  useEffect(() => {
    if (inactiveLicenses && inactiveLicenses.length > 0) {
      setIsModalOpen(true);
    }
  }, [inactiveLicenses]);


  useEffect(() => {
    if (isActivated) {
      console.log("isActivated is true");
      if (isSignedUp) {
        console.log("isSignedUp is true");

        setActivationStep(3);
        return;
      }

      setActivationStep(2);
    }
  }, [isActivated, isSignedUp]);


  // ------------------
  // Handlers
  // ------------------

  const handleDirectActivation = async (e) => {
    e.preventDefault();
    setActivationStatus("processing");

    try {
      const result = await window.electron.auth.activateLicense({
        licenseKey: credentials.licenseKey,
        role: credentials.role,
      });

      if (result.success) {

        try {
          const result = await window.electron.auth.connectNetworkLicense({
            ip: "localhost",
            port: "7890",
          });
          console.log("Network License Result:", result);
          if (result.success) {
            setActivationStatus("active");
            setActivationStep(2);
            localStorage.setItem("role", credentials.role);
          } else {
            setActivationStatus("active");
            setActivationStep(2);
          }
        } catch (error) {
          console.error("Error connecting to network license:", error);
          setActivationStatus("active");
          setActivationStep(2);
        }
        localStorage.setItem("role", credentials.role);
      } else {
        setActivationStatus("failed");
      }
    } catch (error) {
      setActivationStatus("failed");
    }
  };

  const handleNetworkLicenseSearch = async (e) => {
    e.preventDefault();
    setIsNetworkSearching(true);

    try {
      const result = await window.electron.auth.searchnNetworkLicenses({ serviceType: "license-server" });

      if (result.success && result.licenses && result.licenses.length > 0) {
        console.log("Network Licenses Found:", result.licenses);
        setNetworkLicenses(result.licenses);
      } else {
        setNetworkLicenses([]);
        setActivationStatus("network-not-found");
      }
    } catch (error) {
      setActivationStatus("network-error");
    } finally {
      setIsNetworkSearching(false);
    }
  };

  const handleNetworkLicenseSelect = async (license) => {
    setSelectedNetworkLicense(license);
    setActivationStatus("processing");
    // Clear any previous inactive licenses
    setInactiveLicenses([]);

    console.log("Selected Network License:", license);
    console.log("Network License:", networkLicense);

    try {
      const result = await window.electron.auth.connectNetworkLicense({
        ip: license.ip,
        port: license.port,
      });
      console.log("Network License Result:", result);
      if (result.success) {
        setActivationStatus("active");
        setActivationStep(2);
        localStorage.setItem("role", credentials.role);
      } else {
        console.log("Network License Error:", result.inactiveLicenses);
        // Check for inactive licenses in the result
        if (result.inactiveLicenses && result.inactiveLicenses.length > 0) {
          setInactiveLicenses(result.inactiveLicenses);
          setActivationStatus("inactive-licenses");
        } else {
          setActivationStatus("failed");
        }
      }
    } catch (error) {
      console.error("Error connecting to network license:", error);
      setActivationStatus("failed");
    }
  };

  // New handler for revoking inactive licenses
  const handleRevokeLicense = async (sessionKey) => {
    setRevokingLicense(sessionKey);

    try {
      // Assuming you'll implement this endpoint in your electron main process
      const result = await window.electron.auth.revokeSession({
        sessionKey: sessionKey,
        ip: selectedNetworkLicense.ip,
        port: selectedNetworkLicense.port
      });

      if (result.success) {
        // Remove the revoked license from the list
        setInactiveLicenses(prev => prev.filter(session => session.sessionKey !== sessionKey));

        // If that was the last one, retry connection automatically
        if (inactiveLicenses.length === 1) {
          handleNetworkLicenseSelect(selectedNetworkLicense);
        }
      } else {
        // Handle revoke failure
        console.error("Failed to revoke license:", result.error);
      }
    } catch (error) {
      console.error("Error revoking license:", error);
    } finally {
      setRevokingLicense(null);
    }
  };

  // New handler to retry after revoking licenses
  const handleRetryAfterRevoke = () => {
    if (selectedNetworkLicense) {
      handleNetworkLicenseSelect(selectedNetworkLicense);
    }
  };

  const handleAccountSetup = async (e) => {
    e.preventDefault();
    try {
      const success = await signUp({
        email: credentials.email,
        password: credentials.password,
        role: localStorage.getItem("role") || credentials.role,
      });
      if (success) {
        setActivationStep(3);
      }
    } catch (error) {
      console.error("Account setup failed:", error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      // console.log("Inside Login");
      let result = await login({
        email: credentials.email,
        password: credentials.password,
        role: localStorage.getItem("role") || credentials.role,
      });


      // console.log("License activation result:", success);
      if (result) {
        const from = location.state?.from?.pathname || "/";
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  // ------------------
  // Input changes
  // ------------------

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleNetworkInputChange = (e) => {
    const { id, value } = e.target;
    setNetworkLicense((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // ------------------
  // Animation Variants
  // ------------------

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.1, duration: 0.3 },
    }),
  };

  // ------------------
  // UI Render Helpers
  // ------------------

  const renderStatusAlert = () => {
    if (!activationStatus) return null;

    switch (activationStatus) {
      case "active":
        return (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-700 mr-2" />
            <AlertDescription className="text-green-700">
              License successfully activated! Please continue to set up your account.
            </AlertDescription>
          </Alert>
        );
      case "failed":
        return (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              License activation failed. Please check your license key or network settings and try again.
            </AlertDescription>
          </Alert>
        );
      case "network-not-found":
        return (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              No network licenses found. Please verify server address and port.
            </AlertDescription>
          </Alert>
        );
      case "network-error":
        return (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Error connecting to license server. Please check your network connection.
            </AlertDescription>
          </Alert>
        );
      case "processing":
        // You could also show a small spinner if you like
        return null;
      default:
        return null;
    }
  };

  // New function to render inactive licenses UI
  const renderInactiveLicenses = () => {
    if (inactiveLicenses.length === 0) return null;

    return (
      // Modal container and backdrop
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop: clicking on it can close the modal if desired */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleCloseModal} // make sure you define this function to close the modal
        />

        {/* Popup card with framer-motion animation */}
        <motion.div
          className="relative z-50 w-full max-w-2xl mx-auto rounded-md border border-amber-200 bg-white shadow-lg p-6 overflow-visible" // Changed from overflow-hidden
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Close button */}
          <button
            onClick={handleCloseModal}
            className="absolute -top-3 -right-3 p-2 rounded-full bg-white border border-gray-300 shadow-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 z-50"
          >
            <X className="h-5 w-5 text-gray-700 hover:text-gray-900" />
          </button>

          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-700 mr-2" />
            <AlertDescription className="text-amber-700">
              Your device has inactive licenses that need to be revoked before activating a new one.
              Please revoke any unused licenses below.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border border-amber-200 overflow-hidden">
            {/* Mobile view - Card-based layout */}
            <div className="md:hidden">
              {inactiveLicenses.map((license) => (
                <div key={license.sessionKey} className="p-4 border-b border-amber-100 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">
                        {license.sessionDetails.hostname || 'Unknown Device'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {license.sessionDetails.username || 'Unknown User'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeLicense(license.sessionKey)}
                      disabled={revokingLicense === license.sessionKey}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      {revokingLicense === license.sessionKey ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Revoking...
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3 mr-1" />
                          Revoke
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Last Used:</span>{" "}
                    {new Date(license.sessionDetails.lastHeartbeat).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view - Table layout */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-amber-800">
                      Device
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-amber-800">
                      Last Used
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-amber-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {inactiveLicenses.map((license) => (
                    <tr key={license.sessionKey} className="bg-white">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium">
                          {license.sessionDetails.hostname || 'Unknown Device'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {license.sessionDetails.username || 'Unknown User'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(license.sessionDetails.lastHeartbeat).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeLicense(license.sessionKey)}
                          disabled={revokingLicense === license.sessionKey}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          {revokingLicense === license.sessionKey ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Revoke
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {inactiveLicenses.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleRetryAfterRevoke}
                className="bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry Connection
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    );
  };


  const renderProgressSteps = () => {
    return (
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-4">
          {/* Step 1 */}
          <div
            className={`flex items-center justify-center rounded-full h-8 w-8 
              ${activationStep >= 1
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-600"
              }`}
          >
            <Key className="h-4 w-4" />
          </div>

          <div
            className={`h-1 w-12 ${activationStep >= 2 ? "bg-blue-600" : "bg-gray-200"
              }`}
          />

          {/* Step 2 */}
          <div
            className={`flex items-center justify-center rounded-full h-8 w-8 
              ${activationStep >= 2
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-600"
              }`}
          >
            <UserPlus className="h-4 w-4" />
          </div>

          <div
            className={`h-1 w-12 ${activationStep >= 3 ? "bg-blue-600" : "bg-gray-200"
              }`}
          />

          {/* Step 3 */}
          <div
            className={`flex items-center justify-center rounded-full h-8 w-8 
              ${activationStep >= 3
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-600"
              }`}
          >
            <Lock className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };

  // ------------------
  // JSX
  // ------------------

  return (
    <motion.div
      className={cn("flex flex-col gap-6 max-w-md mx-auto", className)}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      {...props}
    >
      <Card className="shadow-lg rounded-lg">
        <CardHeader className="pb-2 text-center">
          <motion.img
            src={Logo}
            alt="CypherSOL Logo"
            className="w-48 mx-auto pb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          />
          <CardTitle className="text-2xl font-semibold">License Activation</CardTitle>
          <CardDescription>
            {activationStep === 1 && "Activate your product license"}
            {activationStep === 2 && "Create your account"}
            {activationStep === 3 && "Login to your account"}
          </CardDescription>
          {renderProgressSteps()}
        </CardHeader>

        <CardContent className="pt-0">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {renderStatusAlert()}

          {/* Render inactive licenses if present */}
          {activationStatus === "inactive-licenses" && isModalOpen && renderInactiveLicenses()}

          {activationStep === 1 && (
            <Tabs
              defaultValue="direct"
              onValueChange={setActivationMethod}
              className="w-full"
            >
              {/* Tabs */}
              <TabsList className="flex w-full mb-6 bg-gray-100 rounded-md p-1">
                <TabsTrigger
                  value="direct"
                  className="flex-1 py-2 rounded-md font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm data-[state=active]:border border-gray-200 transition-colors"
                >
                  <Key className="mr-2 h-4 w-4" />
                  New License
                </TabsTrigger>
                <TabsTrigger
                  value="network"
                  className="flex-1 py-2 rounded-md font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm data-[state=active]:border border-gray-200 transition-colors"
                >
                  <Network className="mr-2 h-4 w-4" />
                  Network License
                </TabsTrigger>
              </TabsList>

              {/* Direct Activation */}
              <TabsContent value="direct">
                <motion.form
                  onSubmit={handleDirectActivation}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                >
                  <div className="flex flex-col gap-4">
                    <motion.div className="grid gap-2" custom={0} variants={itemVariants}>
                      <Label htmlFor="licenseKey">License Key</Label>
                      <Input
                        id="licenseKey"
                        type="text"
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        required
                        value={credentials.licenseKey}
                        onChange={handleInputChange}
                      // pattern="^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$"
                      // title="Please enter a valid license key in the format: XXXX-XXXX-XXXX-XXXX"
                      />
                    </motion.div>

                    <motion.div className="grid gap-2" custom={1} variants={itemVariants}>
                      <Label htmlFor="role">Select Product Type</Label>
                      <select
                        id="role"
                        value={credentials.role}
                        onChange={handleInputChange}
                        className="border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="CA">Tax Professionals</option>
                        <option value="MSME">Accounting for Businesses</option>
                      </select>
                    </motion.div>

                    <motion.div custom={2} variants={itemVariants}>
                      <Button
                        type="submit"
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2"
                        disabled={loading || activationStatus === "processing"}
                      >
                        {activationStatus === "processing" ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Activate License
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </motion.form>
              </TabsContent>

              {/* Network License */}
              <TabsContent value="network">
                <motion.div initial="hidden" animate="visible" variants={cardVariants}>
                  <div className="flex flex-col gap-4">
                    <motion.div custom={0} variants={itemVariants}>
                      <Button
                        type="button"
                        onClick={handleNetworkLicenseSearch}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2"
                        disabled={isNetworkSearching}
                      >
                        {isNetworkSearching ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Server className="h-4 w-4" />
                            Search Available Licenses
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </div>

                  {networkLicenses.length > 0 && (
                    <motion.div
                      className="mt-6"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border px-4 py-2 text-left">License Name</th>
                            <th className="border px-4 py-2 text-left">Network IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {networkLicenses.map((license, index) => (
                            <tr
                              key={index}
                              className="hover:bg-blue-50 cursor-pointer"
                              onClick={() => handleNetworkLicenseSelect(license)}
                            >
                              <td className="border px-4 py-2">{license.name}</td>
                              <td className="border px-4 py-2">{license.ip}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </motion.div>
              </TabsContent>

            </Tabs>
          )}

          {/* Step 2: Create Account */}
          {activationStep === 2 && (
            <motion.form
              onSubmit={handleAccountSetup}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <div className="flex flex-col gap-4">
                <motion.div className="grid gap-2" custom={0} variants={itemVariants}>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="johndoe@example.com"
                    required
                    value={credentials.email}
                    onChange={handleInputChange}
                  />
                </motion.div>

                <motion.div className="grid gap-2" custom={1} variants={itemVariants}>
                  <Label htmlFor="password">Create Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={credentials.password}
                      onChange={handleInputChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </motion.div>

                <motion.div custom={2} variants={itemVariants}>
                  <Button
                    type="submit"
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>

                <motion.div className="text-center mt-2" custom={3} variants={itemVariants}>
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => setActivationStep(3)}
                  >
                    Already have an account? Log in
                  </button>
                </motion.div>
              </div>
            </motion.form>
          )}

          {/* Step 3: Login */}
          {activationStep === 3 && (
            <motion.form
              onSubmit={handleLogin}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <div className="flex flex-col gap-4">
                <motion.div className="grid gap-2" custom={0} variants={itemVariants}>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="johndoe@example.com"
                    required
                    value={credentials.email}
                    onChange={handleInputChange}
                  />
                </motion.div>

                <motion.div className="grid gap-2" custom={1} variants={itemVariants}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={credentials.password}
                      onChange={handleInputChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </motion.div>

                <motion.div custom={2} variants={itemVariants}>
                  <Button
                    type="submit"
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </motion.div>

                <motion.div className="text-center mt-2" custom={3} variants={itemVariants}>
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => setActivationStep(2)}
                  >
                    Need to create an account?
                  </button>
                </motion.div>
              </div>
            </motion.form>
          )}

          <motion.div
            className="mt-6 text-center text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Need a license?{" "}
            <button
              type="button"
              className="underline underline-offset-4 text-blue-600 hover:text-blue-800"
              onClick={() => {
                window.electron.shell.openExternal("https://cyphersol.co.in");
              }}
            >
              Purchase now
            </button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}