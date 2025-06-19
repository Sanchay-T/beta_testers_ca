import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isActivated, setIsActivated] = useState(null);
  const [isSignedUp, setIsSignedUp] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await checkLicenseStatus();
        await checkAccountStatus();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);
  const checkAccountStatus = async () => {
    try {
      const result = await window.electron.auth.checkAccountStatus();
      console.log("Check account status:", result);
      setIsSignedUp(result.success);
    } catch (err) {
      throw err
    }
  };

  const checkLicenseStatus = async () => {
    try {
      const result = await window.electron.auth.checkLicense();
      const activated = result.success;
      // console.log("Check license key isActivated:", result);
      setIsActivated(activated);
      if (activated) {
        // console.log("License key is activated");
        const userData = await window.electron.auth.getUser();
        // console.log("User data:", userData);
        if (userData) setUser(userData);
      }
    } catch (err) {
      throw err
    }
  };

  // Clear error after 5 seconds but keep success messages visible indefinitely
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Success messages don't auto-clear, they remain visible until explicitly cleared or user performs another action

  useEffect(() => {
    // Listen for the 'navigateToLogin' event from the main process via preload.js
    window.electron.onLicenseExpired(() => {
      // Navigate to the login page using React Router's history
      // console.log("License expired React");
      setUser((prev) => {
        setError("License key has expired"); // Call setError before setting user
        return null; // Update user state after setting the error
      });
      // setError('License key has expired');
    });

    // Clean up the listener when the component unmounts
    return () => {
      window.electron.removeLicenseExpiredListener();
    };
  }, []);

  const signUp = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.electron.auth.signUp(credentials);
      console.log("Sign up result:", result);
      if (result.success) {
        setIsSignedUp(true)
        setUser(credentials);
        localStorage.removeItem("dashboardData");
        return true;
      } else {
        setError(result.error || "License activation failed");
        return false;
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      if (!credentials.email || !credentials.password) {
        throw new Error("Email and password are required");
      }

      const result = await window.electron.auth.login(credentials);
      const { success, ...userData } = result

      if (success) {
        // After successful login, explicitly fetch the complete user data
        // const userData = await window.electron.auth.getUser();

        setUser({ ...userData, role: credentials.role });
        console.log("Printing Dama user, ", userData)
        // console.log("User logged in:", userData);
        localStorage.removeItem("dashboardData");
        return true;
      } else {
        throw new Error(result.error || "Login failed");
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const result = await window.electron.auth.logout();

      if (result.success) {
        setUser(null);
        return true;
      } else {
        throw new Error(result.error || "Logout failed");
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // const updateUser = async (userData) => {
  //     try {
  //         setLoading(true);
  //         const result = await window.auth.updateUser(userData);

  //         if (result.success) {
  //             setUser(prev => ({ ...prev, ...userData }));
  //             return true;
  //         } else {
  //             throw new Error(result.error || 'Update failed');
  //         }
  //     } catch (err) {
  //         setError(err.message);
  //         return false;
  //     } finally {
  //         setLoading(false);
  //     }
  // };

  const checkAuth = () => {
    return !!user;
  };

  const value = {
    user,
    loading,
    error,
    successMessage,
    isActivated,
    isSignedUp,
    signUp,
    login,
    logout,
    // updateUser,
    checkAuth,
    setIsActivated,
    setIsSignedUp,
    setError,
    setSuccessMessage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
