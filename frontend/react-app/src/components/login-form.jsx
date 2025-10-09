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
import { Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";

export function LoginForm({ className, ...props }) {
  const { login, loading, error, isActivated, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // const [needsLicense, setNeedsLicense] = useState(true);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    licenseKey: "",
    role: "CA",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // useEffect(() => {
  //   const checkLicenseStatus = async () => {
  //     const hasValidLicense = await checkLicense();
  //     setNeedsLicense(!hasValidLicense);
  //   };

  //   checkLicenseStatus();
  // }, []);
  // On mount: load remembered credentials, if any
  useEffect(() => {
    const saved = localStorage.getItem("rememberedCredentials");
    if (saved) {
      const { email, password } = JSON.parse(saved);
      setCredentials((c) => ({ ...c, email, password }));
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Save or clear from localStorage
    if (rememberMe) {
      localStorage.setItem(
        "rememberedCredentials",
        JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        })
      );
    } else {
      localStorage.removeItem("rememberedCredentials");
    }

    let success = false;
    if (!isActivated) {
      // First handle license activation
      console.log("Inside Signup..", credentials);
      success = await signUp(credentials);
      // set localstorage for role selection
      // localStorage.setItem("role", credentials.role);
      if (!success) {
        return;
      }
    } else {
      // console.log("Inside Login");
      success = await login({
        email: credentials.email,
        password: credentials.password,
        // role: localStorage.getItem("role") || credentials.role,
      });
    }

    // console.log("License activation result:", success);
    if (success) {
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [id]: value,
    }));
  };
  // console.log("inputCredentials", credentials);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <img src={Logo} alt="Logo" className="w-[170px] mx-auto pb-6" />
          <CardTitle className="text-2xl ">Login</CardTitle>
          <CardDescription>
            {!isActivated
              ? "Please enter your license key and credentials"
              : "Enter your credentials to login"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Show license key field only if needed */}
              {!isActivated && (
                <>
                  <div className="grid gap-2">
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
                  </div>
                  {/* Role Selection Dropdown */}
                  <div className="grid gap-2">
                    <Select
                      onValueChange={(value) => {
                        setCredentials((prev) => ({
                          ...prev,
                          role: value,
                        }));
                      }}
                      defaultValu={credentials.role}
                      value={credentials.role}
                      required
                      className="w-full"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="CA">Tax Professionals</SelectItem>
                          <SelectItem value="MSME">
                            Accounting for Businesses
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="Enter your User Name"
                  required
                  value={credentials.email}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={credentials.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <Label htmlFor="rememberMe" className="cursor-pointer">
                  Remember me
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processing..." : "Login"}
              </Button>
            </div>

            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="underline underline-offset-4 text-blue-600 hover:text-blue-800"
                onClick={() => {
                  window.electron.shell.openExternal("https://cyphersol.co.in");
                }}
              >
                Sign up
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
