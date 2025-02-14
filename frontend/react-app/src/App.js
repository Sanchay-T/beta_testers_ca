import React, { useEffect } from "react";
import "./App.css";
import Dashboard from "./Pages/Home";
import { ThemeProvider } from "./components/theme-provider";
import { HashRouter, Routes, Route } from "react-router-dom";
import CaseDashboard from "./Pages/CaseDashboard";
import IndividualDashboard from "./Pages/IndividualDashboard";
import ElectronIntro from "./components/ElectronIntro";
import { useState } from "react";
import { SidebarProvider } from "./components/ui/sidebar";
import { BreadcrumbProvider } from "./contexts/BreadcrumbContext";
import { ReportProvider } from "./contexts/ReportContext";
import { PrivateRoute } from "./components/PrivateRoute";
import Login from "./components/Authentication/Login";
import UpdateNotification from "./components/UpdateNotification";
import { useLoading } from "./contexts/LoadingContext";
import { useToast } from "./hooks/use-toast";

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const { isExcelLoading, isReportLoading } = useLoading();
  const { toast } = useToast();

   // Toast for Excel Download
   useEffect(() => {
    let toastId;
    
    if (isExcelLoading) {
      toastId = toast({
        title: "Downloading Excel",
        description: (
          <div className="mt-2 w-full flex items-center gap-2">
            <p className="text-sm text-gray-500">
              Preparing Excel, Please Wait...
            </p>
          </div>
        ),
        duration: Infinity,
      });
    }

    return () => {
      if (toastId) {
        toast.dismiss(toastId);
      }
    };
  }, [isExcelLoading, toast]);


  
  return (
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
      {showIntro && <ElectronIntro onComplete={() => setShowIntro(false)} />}
      <UpdateNotification />
      <SidebarProvider>
        <HashRouter>
          <BreadcrumbProvider>
            <ReportProvider>

            {/* <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/:defaultTab" element={<Dashboard />} />
              <Route
                path="/case-dashboard/:caseId/:defaultTab"
                element={<IndividualDashboard />}
              />
              <Route
                path="/individual-dashboard/:caseId/:individualId/:defaultTab"
                element={<IndividualDashboard />}
              />
              <Route
                path="/individual-dashboard/:caseId/:defaultTab"
                element={<IndividualDashboard />}
              />
            </Routes> */}

            <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/:defaultTab"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/case-dashboard/:caseId/:defaultTab"
                element={
                  <PrivateRoute>
                    <CaseDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/individual-dashboard/:caseId/:individualId/:defaultTab"
                element={
                  <PrivateRoute>
                    <IndividualDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/individual-dashboard/:caseId/:defaultTab"
                element={
                  <PrivateRoute>
                    <IndividualDashboard />
                  </PrivateRoute>
                }
              />
            </Routes>
            </ReportProvider>
          </BreadcrumbProvider>
        </HashRouter>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
