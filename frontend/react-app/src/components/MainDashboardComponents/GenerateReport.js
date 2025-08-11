import React, { useState, useCallback, useMemo } from "react";
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
import { cn } from "../../lib/utils"; // for conditional class names

export default function GenerateReport({ activeTab }) {
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
  const [warning, setWarning] = useState([]);
  const [warningExpanded, setWarningExpanded] = useState(false);
  const [dateRangeWarning, setDateRangeWarning] = useState(null);

  const hasScannedOrEncodedWarning = useMemo(() => {
    if (!Array.isArray(warning)) return false;

    return warning.some((msg) =>
      /image-only|scanned|non-text|encoded/i.test(msg)
    );
  }, [warning]);

  // extract balance-mismatch errors
  const balanceMismatchErrors = warning.filter((msg) =>
    msg.startsWith("Balance mismatch")
  );

  // everything else stays “red”
  const otherErrors = warning.filter(
    (msg) =>
      !msg.startsWith("Balance mismatch") &&
      !/image-only|scanned|non-text|encoded/i.test(msg)
  );

  // put next to your other helpers
  const OCR_REASON_RE = /(image-only|scanned|non-text|encoded)/i;

  const onlyOcrableFailures = (reasons = []) =>
    reasons.length > 0 && reasons.every((r) => OCR_REASON_RE.test(r));

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
      status: "Processing",
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
      const filesWithPaths = selectedFiles.map((file, index) => {
        const detail = fileDetails[index];
        return {
          pdf_paths: file.path,
          bankName: detail.bankName,
          passwords: detail.password || "",
          start_date: convertDateFormat(detail.start_date), // Convert date format
          end_date: convertDateFormat(detail.end_date), // Convert date format
          ca_id: currentCaseId,
        };
      });

      setFailedStatements([]);
      setSuccessfulStatements([]);
      setShowRectifyButton(false);
      setShowAnalysisButton(false);
      setMissingMonthsList([]);
      setWarning([]);
      setDateRangeWarning(null); // Reset date range warning
      setWarningExpanded(false); // Reset warning expansion state

      const result = await window.electron.generateReportIpc(
        {
          files: filesWithPaths,
        },
        caseName,
        false,
        "generate-report"
      );

      console.log({ electronResponse: result });
      if (
        result.data.missingMonthsList &&
        result.data.missingMonthsList.length > 0
      ) {
        setMissingMonthsList(result.data.missingMonthsList);
      }

      if (result.data.warning && result.data.warning.length > 0) {
        const formatted = result.data.warning.filter((w) => w && w.trim());

        // regex to find your date-overlap error
        const re =
          /The period for Bank:[^)]+\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)[^()]*\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)/;

        // split into dateErrors vs. rest
        let drWarn = null;
        const rest = formatted.filter((msg) => {
          const m = msg.match(re);
          if (m) {
            const [, fetchedStart, fetchedEnd, userStart, userEnd] = m;
            drWarn = { fetchedStart, fetchedEnd, userStart, userEnd };
            return false; // remove from “rest”
          }
          return true; // keep everything else
        });

        setDateRangeWarning(drWarn); // either an object or null
        setWarning(Array.from(new Set(rest))); // your existing red/amber logic
      }

      setCurrentCaseId(result.data.caseId); // Store caseId
      console.log({ result });
      if (result.success) {
        setDialogOpen(true); // Open the Dialog
        toast.dismiss(newToastId);

        console.log("Report generated successfully:", result.data);
        if (result.data.failedFiles.length > 0) {
          // ----- decide whether *all* failures are OCR-friendly -----
          const { respective_reasons_for_error: reasons = [] } =
            result.data.failedStatements || {};

          const mustRectify = !onlyOcrableFailures(reasons);
          setShowRectifyButton(mustRectify); // ✅ true only when some non-OCR error exists

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

          updateReportData({
            recentReportsData: [newData, ...reportData.recentReportsData],
          });

          if (activeTab !== "Generate Report")
            toast({
              title: "Failed",
              description: `${caseName} report had some issues!`,
              variant: "destructive",
            });
        } else {
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

          updateReportData({
            recentReportsData: [newData, ...reportData.recentReportsData],
          });
        }

        if (result.data.totalTransactions && activeTab !== "Generate Report") {
          toast({
            title: "Success",
            description: `${caseName} report generated successfully!`,
            duration: Infinity,
            variant: "success",
          });
        }

        if (result.data.totalTransactions > 0) {
          setShowAnalysisButton(true);
        }

        // setFailedStatements(result.pdf_paths_not_extracted || []); // Store failed
        setSelectedFiles([]);
        setFileDetails([]);

        // Handle Scanned and encoded files
        console.log({ aiyaz: result.data.failedStatements });
        const failedStatementsFromBackend = result.data.failedStatements || [];
        console.log({ tyope: typeof failedStatementsFromBackend });

        const paths = failedStatementsFromBackend.paths || [];
        const reasons =
          failedStatementsFromBackend.respective_reasons_for_error || [];
        const bankNames = failedStatementsFromBackend.bank_names || [];
        const passwords = failedStatementsFromBackend.passwords || [];
        const startDates = failedStatementsFromBackend.start_dates || [];
        const endDates = failedStatementsFromBackend.end_dates || [];

        // Helper: Match OCR-triggering reasons
        const isOcrCandidate = (reason = "") => {
          const r = reason.toLowerCase();
          return (
            r.includes("image-only") ||
            r.includes("scanned") ||
            r.includes("non-text") ||
            r.includes("encoded")
          );
        };

        // ✅ Filter out null or undefined pdfs and match OCR-triggering reasons
        const eligibleIndexes = reasons
          .map((reason, idx) =>
            isOcrCandidate(reason) && paths[idx] ? idx : null
          )
          .filter((i) => i !== null);
        console.log({ eligibleIndexes });
        const scannedOCRFiles = eligibleIndexes.map((i) => ({
          bankName: bankNames[i],
          pdf_paths: paths[i],
          passwords: passwords[i],
          start_date: startDates[i],
          end_date: endDates[i],
          ca_id: result.data.caseId,
          is_ocr: isOcrCandidate(reasons[i]),
        }));

        console.log({ scannedOCRFiles });
        // If any OCR-worthy files found
        if (eligibleIndexes.length > 0) {
          const newData = {
            id: result.data.caseId,
            name: caseName,
            userId: null,
            status: "Processing",
            pages: null,
            createdAt: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            // statements: null,
          };

          updateReportData({
            recentReportsData: [newData, ...reportData.recentReportsData],
          });

          toast({
            id: newToastId,
            title: "Running OCR",
            description: (
              <div className="mt-2 w-full flex items-center gap-2">
                <div className="flex items-center gap-4">
                  <CircularProgress className="w-full" />
                </div>
                <p className="text-sm text-gray-500">
                  Processing scanned/encoded PDFs…
                </p>
              </div>
            ),
            variant: "default",
            duration: Infinity,
          });
          // toast({
          //   title: "OCR Triggered",
          //   description: `Detected scanned or encoded PDFs.`,
          //   variant: "default",
          //   duration: 5000,
          // });

          console.log({
            files: scannedOCRFiles,
            caseName,
            is_ocr: true,
            soure: "add-pdf",
          });
          try {
            const ocrResult = await window.electron.generateReportIpc(
              { files: scannedOCRFiles },
              caseName,
              "add-pdf"
            );

            setFailedStatements([]);
            setSuccessfulStatements([]);
            setShowRectifyButton(false);
            setShowAnalysisButton(false);
            setMissingMonthsList([]);
            setWarning([]);
            setDateRangeWarning(null); // Reset date range warning
            setWarningExpanded(false); // Reset warning expansion state

            console.log("OCR Result:", ocrResult);

            if (
              ocrResult.data.missingMonthsList &&
              ocrResult.data.missingMonthsList.length > 0
            ) {
              setMissingMonthsList(ocrResult.data.missingMonthsList);
            }

            if (ocrResult.data.warning && ocrResult.data.warning.length > 0) {
              const formatted = ocrResult.data.warning.filter(
                (w) => w && w.trim()
              );

              // regex to find your date-overlap error
              const re =
                /The period for Bank:[^)]+\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)[^()]*\((\d{2}-\d{2}-\d{4}) to (\d{2}-\d{2}-\d{4})\)/;

              // split into dateErrors vs. rest
              let drWarn = null;
              const rest = formatted.filter((msg) => {
                const m = msg.match(re);
                if (m) {
                  const [, fetchedStart, fetchedEnd, userStart, userEnd] = m;
                  drWarn = { fetchedStart, fetchedEnd, userStart, userEnd };
                  return false; // remove from “rest”
                }
                return true; // keep everything else
              });

              setDateRangeWarning(drWarn); // either an object or null
              setWarning(Array.from(new Set(rest))); // your existing red/amber logic
            }

            // setCurrentCaseId(ocrResult.data.caseId); // Store caseId
            console.log({ ocrResult });
            if (ocrResult.success) {
              setDialogOpen(true); // Open the Dialog
              toast.dismiss(newToastId);

              console.log("ocrResult generated successfully:", ocrResult.data);
              if (ocrResult.data.failedFiles.length > 0) {
                setShowRectifyButton(true);
                const failedFiles = ocrResult.data.failedFiles.map(
                  (file_path) => {
                    // Get the filename from the path and remove the timestamp
                    const filename = file_path.split("\\").pop(); // Get filename from path
                    const filenameWithoutTimestamp = filename.substring(
                      filename.indexOf("-") + 1
                    ); // Remove everything before first hyphen
                    return filenameWithoutTimestamp;
                  }
                );
                setFailedStatements(failedFiles || []); // Store failed

                const newData = {
                  id: ocrResult.data.caseId,
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

                // setShowRectifyButton(true);
                const successfulFiles = ocrResult.data.successfulFiles.map(
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

                updateReportData({
                  recentReportsData: [newData, ...reportData.recentReportsData],
                });

                if (activeTab !== "Generate Report")
                  toast({
                    title: "Failed",
                    description: `${caseName} report had some issues!`,
                    variant: "destructive",
                  });
              } else {
                // setShowRectifyButton(true);
                const successfulFiles = ocrResult.data.successfulFiles.map(
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
                  id: ocrResult.data.caseId,
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

                updateReportData({
                  recentReportsData: [newData, ...reportData.recentReportsData],
                });
              }

              if (
                ocrResult.data.totalTransactions &&
                activeTab !== "Generate Report"
              ) {
                toast({
                  title: "Success",
                  description: `${caseName} report generated successfully!`,
                  duration: Infinity,
                  variant: "success",
                });
              }

              if (ocrResult.data.totalTransactions > 0) {
                setShowAnalysisButton(true);
              }

              // setFailedStatements(ocrResult.pdf_paths_not_extracted || []); // Store failed
              setSelectedFiles([]);
              setFileDetails([]);

              clearInterval(progressIntervalRef.current);
              setProgress(100);
              toast.dismiss(newToastId);

              // open dialog and everything

              setLoading(false);
              localStorage.removeItem("dashboardData");
              // refreshPage();
              progressIntervalRef.current = null;

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

            // toast({
            //   title: "OCR Completed",
            //   variant: "success",
            // });
          } catch (ocrErr) {
            toast({
              title: "OCR Failed",
              description: "OCR retry failed for scanned/encoded PDFs.",
              variant: "destructive",
            });
            console.error("OCR error:", ocrErr);
          }
        }
        clearInterval(progressIntervalRef.current);
        setProgress(100);
        toast.dismiss(newToastId);

        // open dialog and everything

        setLoading(false);
        localStorage.removeItem("dashboardData");
        // refreshPage();
        progressIntervalRef.current = null;

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
      console.log({ error });
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
      if (activeTab !== "Generate Report") {
        toast({
          title: "Error",
          description: "Failed to generate report",
          variant: "destructive",
        });
      }
      // refreshPage();
      const updatedRecentReportData = reportData.recentReportsData;
      updateReportData({ recentReportsData: updatedRecentReportData });
    } finally {
      return true;
    }
  };

  const viewAnalysis = () => {
    navigate(`/individual-dashboard/${currentCaseId}/defaultTab`);
  };

  const handleRectify = () => {
    setDialogOpen(false);

    updateReportData({
      ...reportData,
      triggerRectify: { caseId: currentCaseId, caseName: currentCaseName },
    });
  };

  const notifications = [
    { id: 1, message: "You have a new message." },
    // { id: 2, message: "Your report is ready to download." },
    // { id: 3, message: "New comment on your post." },
  ];

  // Function to trigger refresh
  const refreshPage = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // const handleTestEdit = () => {
  //   window.electron.excelFileDownload(5);
  // };
  const observerError =
    "ResizeObserver loop completed with undelivered notifications.";
  window.addEventListener("error", (e) => {
    if (e.message === observerError) {
      e.stopImmediatePropagation();
      console.error(
        "AQ - ResizeObserver loop completed with undelivered notifications."
      );
    }
  });

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
  scanned: {
    header: "IMPORTANT NOTES regarding scanned PDFs processing:",
    items: [
      "Sharp, readable text – zoom in; if you can read every digit, so can we",
      "Aligned and maintains continuity across all pages",
      "Clear, without overlapping narration in the amount fields",
      "Avoid photo-scanned PDFs – no issues if it’s clear and aligned",
    ],
  },
  };

  return (
    <div className="p-8 pt-0 space-y-8 bg-white dark:bg-black min-h-screen">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight dark:text-slate-300">
          Report Generator
        </h2>
        {/* <button onClick={handleTestEdit}>Test Excel download</button> */}
        {/* <div className="flex items-center space-x-4">
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
        </div> */}
      </div>

      <div>
        <GenerateReportForm
          key={refreshTrigger}
          handleReportSubmit={handleSubmit}
          onReportGenerated={refreshPage}
        />
      </div>

      <RecentReports key={refreshTrigger} onReportGenerated={refreshPage} />

     <Card className="p-6">
  <h4 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
    <AlertCircle className="h-5 w-5 text-amber-500" />
    Important Notes
  </h4>
  <h6 className="text-gray-600 dark:text-slate-300 mb-4">
    Certain statements may not be processed properly due to various reasons.
    Below is a list of common unsupported or partially extracted formats:
  </h6>
  <ul className="space-y-3">
    {note.content.map((item, idx) => (
      <li
        key={idx}
        className="flex gap-3 items-center text-gray-600 dark:text-slate-300"
      >
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <span>{item}</span>
      </li>
    ))}

    {/* scanned-PDF header as a bold “parent” bullet */}
    <li className="flex gap-3 items-start text-gray-600 dark:text-slate-300">
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
      <span className="font-semibold">{note.scanned.header}</span>
    </li>

    {/* scanned-PDF details as indented sub-bullets */}
    {note.scanned.items.map((sub, i) => (
      <li
        key={i}
        className="flex gap-3 items-center text-gray-600 dark:text-slate-300 ml-8"
      >
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span>{sub}</span>
      </li>
    ))}
  </ul>
</Card>

      {/* Dialog for successful report generation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} className="">
        <DialogContent className="max-h-[90vh] overflow-y-auto pb-0 border-none shadow-none">
          <DialogHeader>
            {successfulStatements.length > 0 ? (
              <DialogTitle>
                Report {currentCaseName} Generated Successfully!
              </DialogTitle>
            ) : (
              <DialogTitle className="flex items-end gap-x-2 items-center">
                <AlertTriangle className="text-yellow-500 w-6 h-6 " />
                Some statement had errors.
              </DialogTitle>
            )}
            <DialogDescription className="flex items-end gap-x-4 pt-4">
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
          {hasScannedOrEncodedWarning && (
            <div className="mb-4 mt-2">
              {/* <h3 className="text-md font-semibold flex items-center gap-x-2 mb-2">
                <AlertCircle className="text-blue-500 w-5 h-5" />
                OCR Triggered
              </h3> */}
              <Card className="p-3 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  We detected one or more scanned or encoded PDFs. We are
                  processing your statements in the background. Processing will take approximately
                  1-2 minutes per page, depending on the configuration of your pc.
                </p>
              </Card>
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

          {/* ——— Other errors in red ——— */}
          {(otherErrors.length > 0 || dateRangeWarning) && (
            <Card className="p-3 bg-red-50 …">
              <h3 className="…">
                {/* <AlertCircle className="…" /> Warning */}
              </h3>
              <ul className="space-y-1">
                {otherErrors.map((msg, i) => (
                  <li key={i} className="text-red-700 flex items-start">
                    • <span className="ml-1 break-words">{msg}</span>
                  </li>
                ))}

                {dateRangeWarning && (
                  <li className="mt-2 text-red-700">
                    <p className="font-semibold">Date range mismatch:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1">
                      <li>
                        User Input: {dateRangeWarning.userStart}--
                        {dateRangeWarning.userEnd}
                      </li>
                      <li>
                        Available: {dateRangeWarning.fetchedStart}--
                        {dateRangeWarning.fetchedEnd}
                      </li>
                    </ul>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* ——— Balance-mismatch in amber, collapsible ——— */}
          {balanceMismatchErrors.length > 0 && (
            <div className="mb-4 mt-2">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setWarningExpanded(!warningExpanded)}
              >
                <h3 className="text-md font-semibold flex items-center gap-x-2">
                  <AlertCircle className="text-amber-500 w-5 h-5" />
                  Balance mismatch details
                </h3>
                <ChevronRight
                  className={cn(
                    "transition-transform text-amber-500 w-5 h-5",
                    warningExpanded ? "rotate-90" : ""
                  )}
                />
              </div>

              {warningExpanded && (
                <Card className="p-3 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 mt-2">
                  <ul className="space-y-1">
                    {balanceMismatchErrors.map((msg, idx) => (
                      <li
                        key={idx}
                        className="text-amber-700 dark:text-amber-400 flex items-start"
                      >
                        • <span className="ml-1 break-all">{msg}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          <div className="flex gap-4 sticky w-full p-4  bottom-0 bg-white ">
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