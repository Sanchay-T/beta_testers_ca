import React, { useState, useCallback } from "react";
import { Bell, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import GenerateReportForm from "../Elements/ReportForm";
import RecentReports from "./RecentReports";
import { CircularProgress } from "../ui/circularprogress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog"; // Import shadcn/ui Dialog components
import { Button } from "../ui/button"; // Import shadcn/ui Button component
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation
import { Card } from "../ui/card";
import { AlertCircle, ChevronRight } from "lucide-react";
import { useReportContext } from "../../contexts/ReportContext";

export default function GenerateReport() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false); // State to control Dialog visibility
  const [failedStatements, setFailedStatements] = useState([]); // State to store failed statements
  const [successfulStatements, setSuccessfulStatements] = useState([]); // State to store successful statements
  const [currentCaseId, setCurrentCaseId] = useState(null); // State to store caseId
  const [showAnalsisButton, setShowAnalysisButton] = useState(false); // State to show Analysis button
  const [showRectifyButton, setShowRectifyButton] = useState(false); // State to show Rectify button
  const [currentCaseName, setCurrentCaseName] = useState(""); // State to store current case name
  const navigate = useNavigate(); // Hook for navigation
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { reportData, updateReportData } = useReportContext();
  const [missingMonthsList, setMissingMonthsList] = useState([]);

  const handleSubmit = async (
    setProgress,
    setLoading,
    setToastId,
    selectedFiles,
    fileDetails,
    setSelectedFiles,
    setFileDetails,
    toast,
    progressIntervalRef,
    simulateProgress,
    convertDateFormat,
    caseName
  ) => {
    if (caseName === "") {
      toast({
        title: "Error",
        description: "Please enter a Case Name",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    setCurrentCaseName(caseName);

    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    const newToastId = toast({
      title: "Initializing Report Generation",
      description: (
        <div className="mt-2 w-full flex items-center gap-2">
          <div className="flex items-center gap-4">
            <CircularProgress className="w-full" />
          </div>
          <p className="text-sm text-gray-500">Preparing to process files...</p>
        </div>
      ),
      duration: Infinity,
    });
    setToastId(newToastId);

    const newData = {
      id: null,
      name: caseName,
      userId: null,
      status: "Pending",
      pages: null,
      createdAt: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      statements: null,
    };

    // const updatedRecentReportData = reportData.recentReportsData(newData);
    updateReportData({
      recentReportsData: [newData, ...reportData.recentReportsData],
    });

    progressIntervalRef.current = simulateProgress();

    try {
      const filesWithContent = await Promise.all(
        selectedFiles.map(async (file, index) => {
          const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsBinaryString(file);
          });

          const detail = fileDetails[index];

          return {
            fileContent,
            pdf_paths: file.name,
            bankName: detail.bankName,
            passwords: detail.password || "",
            start_date: convertDateFormat(detail.start_date), // Convert date format
            end_date: convertDateFormat(detail.end_date), // Convert date format
            ca_id: currentCaseId,
          };
        })
      );

      console.log({ caseName, filesWithContent });

      console.log({ caseName, filesWithContent });

      const result = await window.electron.generateReportIpc(
        {
          files: filesWithContent,
        },
        caseName,
        "generate-report"
      );

      // console.log("months", result.data.missingMonthsList);
      if (
        result.data.missingMonthsList &&
        result.data.missingMonthsList.length > 0
      ) {
        setMissingMonthsList(result.data.missingMonthsList);
      }

      console.log("Report generation result:", result.data);
      setCurrentCaseId(result.data.caseId); // Store caseId

      if (result.success) {
        clearInterval(progressIntervalRef.current);
        setProgress(100);
        toast.dismiss(newToastId);
        toast({
          title: "Success",
          description: `${caseName} Report generated successfully!`,
          duration: 3000,
          variant: "success",
        });
        if (result.data.failedFiles.length > 0) {
          setShowRectifyButton(true);
          const failedFiles = result.data.failedFiles.map((file_path) => {
            // Get the filename from the path and remove the timestamp
            const filename = file_path.split("\\").pop(); // Get filename from path
            const filenameWithoutTimestamp = filename.substring(
              filename.indexOf("-") + 1
            ); // Remove everything before first hyphen
            return filenameWithoutTimestamp;
          });
          setFailedStatements(failedFiles || []); // Store failed

          const newData = {
            id: result.data.caseId,
            name: caseName,
            userId: null,
            status: "Failed",
            pages: null,
            createdAt: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            statements: null,
          };

          updateReportData({
            recentReportsData: [newData, ...reportData.recentReportsData],
          });
        }

        if (result.data.successfulFiles.length > 0) {
          // setShowRectifyButton(true);
          const successfulFiles = result.data.successfulFiles.map(
            (file_path) => {
              // Get the filename from the path and remove the timestamp
              const filename = file_path.split("\\").pop(); // Get filename from path
              const filenameWithoutTimestamp = filename.substring(
                filename.indexOf("-") + 1
              ); // Remove everything before first hyphen
              return filenameWithoutTimestamp;
            }
          );
          setSuccessfulStatements(successfulFiles || []); // Store successful

          const newData = {
            id: result.data.caseId,
            name: caseName,
            userId: null,
            status: "Success",
            pages: null,
            createdAt: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            // statements: null,
          };
          console.log("maxxx", newData);
  
          updateReportData({
            recentReportsData: [newData, ...reportData.recentReportsData],
          });
        }

        if (result.data.totalTransactions) setShowAnalysisButton(true);

        // setFailedStatements(result.pdf_paths_not_extracted || []); // Store failed

        setDialogOpen(true); // Open the Dialog

        setSelectedFiles([]);
        setFileDetails([]);

        // Trigger a page refresh
        // refreshPage();
      } else {
        const errorMessage = result.error
          ? typeof result.error === "object"
            ? JSON.stringify(result.error, null, 2)
            : result.error
          : "Unknown error occurred";

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.log("Report generation failed:", { error: error.stack });

      if (typeof error === "object" && error !== null) {
        console.error("Detailed error:", JSON.stringify(error, null, 2));
      }

      if (error && error.message) {
        console.error("Error message:", error.message);
      }

      if (error && error.stack) {
        console.error("Error stack trace:", error.stack);
      }

      clearInterval(progressIntervalRef.current);
      toast.dismiss(newToastId);
      setProgress(0);
      if (showAnalsisButton || showRectifyButton) {
        setDialogOpen(true);
      }
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
        duration: 5000,
      });
      // refreshPage();
      const updatedRecentReportData = reportData.recentReportsData;
      updateReportData({ recentReportsData: updatedRecentReportData });
    } finally {
      setLoading(false);
      localStorage.removeItem("dashboardData");
      // refreshPage();
      progressIntervalRef.current = null;
    }
  };

  console.log("reportData shubham", reportData);
  const viewAnalysis = () => {
    console.log("View Analysis clicked - ", currentCaseId);
    navigate(`/individual-dashboard/${currentCaseId}/defaultTab`);
  };

  const handleRectify = () => {
    setDialogOpen(false);

    updateReportData({
      ...reportData,
      triggerRectify: { caseId: currentCaseId, caseName: currentCaseName },
    });
    console.log("Rectify clicked ", currentCaseId, currentCaseName);
  };

  const notifications = [
    { id: 1, message: "You have a new message." },
    { id: 2, message: "Your report is ready to download." },
    { id: 3, message: "New comment on your post." },
  ];

  // Function to trigger refresh
  const refreshPage = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // const handleTestEdit = () => {
  //   window.electron.excelFileDownload(5);
  // };

  const note = {
    content: [
      "Scanned copies",
      "Image-Based PDF Statements: Bank statements provided as image-based PDFs, rather than in a structured file format, might lead to processing issues.",
      "File Integrity: Encoded, encrypted, or corrupted files cannot be processed and should not be uploaded.",
      "Handwritten Statements: Handwritten bank statements are not accepted.",
      "Canara Bank Formats: Certain formats of Canara Bank statements may not be compatible with our processing system.",
      "Data Authenticity: Please ensure that the uploaded data has not been tampered with, as alterations can result in incorrect responses.",
      "Statement Recency: Avoid uploading very old bank statements, as changes in keyword formats over time may affect processing accuracy.",
    ],
  };

  return (
    <div className="p-8 pt-0 space-y-8 bg-white dark:bg-black min-h-screen">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight dark:text-slate-300">
          Report Generator
        </h2>
        {/* <button onClick={handleTestEdit}>Test Excel download</button> */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
                     text-gray-600 dark:text-gray-300"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-14 mt-48 w-64 bg-white dark:bg-gray-800 
                          border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm z-50" // Reduced shadow
            >
              <ul className="max-h-60 overflow-y-auto p-2 space-y-2">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                             dark:hover:bg-gray-700 rounded-lg"
                  >
                    {notification.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div>
        <GenerateReportForm
          key={refreshTrigger}
          handleReportSubmit={handleSubmit}
          onReportGenerated={refreshPage}
        />
      </div>

      <RecentReports key={refreshTrigger} onReportGenerated={refreshPage} />

      {/* statments which we dont work with */}
      <Card className="p-6">
        <h4 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Important Notes
        </h4>
        <h6 className="text-gray-600 dark:text-slate-300 mb-4">
          Certain statements may not be processed properly due to various
          reasons. Below is a list of common unsupported or partially extracted
          formats:
        </h6>
        <ul className="space-y-3">
          {note.content.map((item, idx) => (
            <li
              key={idx}
              className="flex gap-3 items-center text-gray-600 dark:text-slate-300"
            >
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Dialog for successful report generation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            {failedStatements.length === 0 ? (
              <DialogTitle>
                Report {currentCaseName} Generated Successfully!
              </DialogTitle>
            ) : (
              <DialogTitle className="flex items-end gap-x-2">
                <AlertTriangle className="text-yellow-500 w-6 h-6 mt-2" />
                Some statement had errors.
              </DialogTitle>
            )}
            <DialogDescription className="flex items-end gap-x-4 pt-4 ">
              {console.log(
                "failedStatements from alert box ",
                failedStatements
              )}
              {/* {failedStatements.length === 0 && (
                <div className="flex items-center gap-x-4">
                  <CheckCircle className="text-green-500 w-6 h-6 mt-2" />
                  <p>Your report has been generated successfully.</p>
                </div>
              )} */}
            </DialogDescription>
          </DialogHeader>

          {(failedStatements.length > 0 || successfulStatements.length > 0) && (
            <div className="mb-2">
              <ul className="list-disc pl-5">
                {failedStatements.map((statement, index) => (
                  <li key={index} className="text-red-400">
                    {statement}
                  </li>
                ))}
                {successfulStatements.map((statement, index) => (
                  <li key={index} className="text-green-700">
                    {statement}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Display Missing Months Section */}
          {missingMonthsList.length > 0 && (
            <div className="mb-4 mt-2">
              <h3 className="text-md font-semibold flex items-center gap-x-2 mb-2">
                <AlertCircle className="text-amber-500 w-5 h-5" />
                Missing Months
              </h3>
              <Card className="p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <ul className="space-y-1">
                  {missingMonthsList.map((month, index) => (
                    <li
                      key={index}
                      className="text-amber-700 dark:text-amber-400 flex items-center"
                    >
                      <ChevronRight className="w-4 h-4 mr-1 flex-shrink-0" />
                      <span>{month}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
                  These months are missing from your statements. You may want to
                  add them for a complete analysis.
                </p>
              </Card>
            </div>
          )}
          <div className="flex gap-4">
            {showAnalsisButton && (
              <Button onClick={() => viewAnalysis()} className="flex-1">
                View Analysis
              </Button>
            )}

            {showRectifyButton && (
              <Button onClick={handleRectify} className="flex-1">
                Rectify Now
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
