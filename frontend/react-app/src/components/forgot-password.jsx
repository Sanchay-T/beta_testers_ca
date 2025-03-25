import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import Logo from "../data/assets/logo.png";

export function PasswordResetForm({ className, ...props }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        newPassword: "",
        confirmPassword: ""
    });

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    const validateForm = () => {
        if (formData.newPassword !== formData.confirmPassword) {
            setError("Passwords do not match");
            return false;
        }

        if (formData.newPassword.length < 8) {
            setError("Password must be at least 8 characters long");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Send the reset password request through electron IPC
            const result = await window.electron.auth.resetPassword({
                email: formData.email,
                newPassword: formData.newPassword
            });

            if (result.success) {
                setSuccess(true);
            } else {
                setError(result.message || "Failed to reset password. Please try again later.");
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again later.");
            console.error("Password reset error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        navigate('/login');
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <img src={Logo} alt="Logo" className="w-[170px] mx-auto pb-6" />
                    <CardTitle className="text-2xl">Reset Password</CardTitle>
                    <CardDescription>
                        {!success
                            ? "Enter your email and new password to reset your account password"
                            : "Password has been reset successfully"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!success ? (
                        <form onSubmit={handleSubmit}>
                            <div className="flex flex-col gap-6">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email/Username</Label>
                                    <Input
                                        id="email"
                                        type="text"
                                        placeholder="johndoe@example.com"
                                        required
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="newPassword">New Password</Label>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        placeholder="Enter new password"
                                        required
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Confirm new password"
                                        required
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? "Processing..." : "Reset Password"}
                                </Button>
                            </div>

                            <div className="mt-4 text-center text-sm">
                                <Link
                                    to="/login"
                                    className="underline underline-offset-4 text-blue-600 hover:text-blue-800"
                                >
                                    Back to login
                                </Link>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <Alert>
                                <AlertDescription>
                                    Your password has been reset successfully. You can now log in with your new password.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={handleBackToLogin} className="w-full">
                                Back to Login
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}