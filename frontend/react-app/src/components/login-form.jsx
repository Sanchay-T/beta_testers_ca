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

export function LoginForm({ className, ...props }) {
  const { login, loading, error, isActivated, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // const [needsLicense, setNeedsLicense] = useState(true);
  const [credentials, setCredentials] = useState({
    email: "2-32e6d741",
    password: "123",
    licenseKey: "SOMEX4Y4ZLicenseKEYForAiyaz",
  });

  // useEffect(() => {
  //   const checkLicenseStatus = async () => {
  //     const hasValidLicense = await checkLicense();
  //     setNeedsLicense(!hasValidLicense);
  //   };

  //   checkLicenseStatus();
  // }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    let success = false;
    if (!isActivated) {
      // First handle license activation
      console.log("Inside Signup..")
      success = await signUp(credentials);
      if (!success) {
        return;
      }
    }
    else {
      console.log("Inside Login")
      success = await login({
        email: credentials.email,
        password: credentials.password,
      });
    }

    console.log("License activation result:", success);
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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
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
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="m@example.com"
                  required
                  value={credentials.email}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password" // Replace '#' with your desired route
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={credentials.password}
                  onChange={handleInputChange}
                />
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