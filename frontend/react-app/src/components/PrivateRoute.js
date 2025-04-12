// src/auth/components/PrivateRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Alert, AlertDescription } from "../components/ui/alert";

export const PrivateRoute = ({ children }) => {
    const { user, loading, error } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="m-4">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!user) {
        // console.log("Redirecting to login page");
        // Save the attempted location for redirect after login
        // return <Navigate to="/login" state={{ from: location }} replace />;
        return <Navigate to="/license-activation" state={{ from: location }} replace />;
    }

    // console.log("User is authenticated");

    return children;
};
