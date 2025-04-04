import { LicenseActivationForm } from "../activate-license";

export default function LicenseActivation() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm">
                <LicenseActivationForm />
            </div>
        </div>
    );
}
