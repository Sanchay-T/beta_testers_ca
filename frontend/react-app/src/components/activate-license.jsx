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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { motion } from "framer-motion";

export function LicenseActivationForm({ className, ...props }) {
  const { login, loading, error, isActivated, signUp, activateLicense } = useAuth();
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

  useEffect(() => {
    // Check if license is already activated (pseudo-code)
    const checkActivationStatus = async () => {
      try {
        const status = await window.electron.ipcRenderer.invoke("check-license-status");
        if (status.isActivated) {
          setActivationStatus("active");
        }
      } catch (error) {
        console.error("Failed to check license status:", error);
      }
    };
    checkActivationStatus();
  }, []);

  // ------------------
  // Handlers
  // ------------------

  const handleDirectActivation = async (e) => {
    e.preventDefault();
    setActivationStatus("processing");

    try {
      const result = await window.electron.ipcRenderer.invoke("activate-license", {
        licenseKey: credentials.licenseKey,
        role: credentials.role,
      });

      if (result.success) {
        setActivationStatus("active");
        setActivationStep(2);
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
      const result = await window.electron.auth.searchnNetworkLicenses({ serviceType: "license" });

      if (result.success && result.licenses && result.licenses.length > 0) {
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

    try {
      const result = await window.electron.ipcRenderer.invoke("connect-network-license", {
        licenseId: license.id,
        serverAddress: networkLicense.serverAddress,
        port: networkLicense.port,
        username: networkLicense.username,
        role: credentials.role,
      });

      if (result.success) {
        setActivationStatus("active");
        setActivationStep(2);
        localStorage.setItem("role", credentials.role);
      } else {
        setActivationStatus("failed");
      }
    } catch (error) {
      setActivationStatus("failed");
    }
  };

  const handleAccountSetup = async (e) => {
    e.preventDefault();
    try {
      const success = await window.electron.ipcRenderer.invoke("sign-up", {
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
      const success = await window.electron.ipcRenderer.invoke("login", {
        email: credentials.email,
        password: credentials.password,
        role: localStorage.getItem("role") || credentials.role,
      });
      if (success) {
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
                        pattern="^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$"
                        title="Please enter a valid license key in the format: XXXX-XXXX-XXXX-XXXX"
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
                              <td className="border px-4 py-2">{license.networkIp}</td>
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
