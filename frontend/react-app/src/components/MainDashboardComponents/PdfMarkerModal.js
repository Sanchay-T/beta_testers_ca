import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { useToast } from "../../hooks/use-toast";
import PdfMarker from "./PdfMarker";

const PDFMarkerModal = ({
  isOpen,
  onClose,
  selectedFailedFile,
  source,
  setFailedDatasOfCurrentReport,
  failedDatasOfCurrentReport,
  currentCaseName,
}) => {
  const [initialConfigFormatted, setInitialConfigFormatted] = useState({
    lines: [],
  });
  const [pdfEditLoading, setPdfEditLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = (data) => {
    onClose();
  };

  const addColsToStatementData = (pdfPath, columns) => {
    if (!selectedFailedFile) return;
    if (selectedFailedFile.path !== pdfPath) return;
    selectedFailedFile.rectifiedColumns = columns;
    selectedFailedFile.resolved = true;
    setFailedDatasOfCurrentReport((prev) =>
      prev.map((item) =>
        item.path === selectedFailedFile.path ? selectedFailedFile : item
      )
    );

    onClose();
  };

  const handleSubmitEditPdf = async () => {
    setPdfEditLoading(true);
    const allRectified = failedDatasOfCurrentReport.every(
      (statement) => statement.resolved
    );

    if (allRectified) {
      // Call the API to update the statements
      const result = await window.electron.editPdf(
        failedDatasOfCurrentReport,
        currentCaseName
      );
      console.log("result", result);

      if (result.success && result.data.failedStatements.length === 0) {
        toast({
          title: "Success",
          description: "All statements have been rectified.",
          variant: "success",
          className: "bg-white text-black opacity-100 shadow-lg",
        });
        setPdfEditLoading(false);
      } else {
        // If the rectification failed, show error message and reasons
        const unrectifiedStatements = failedDatasOfCurrentReport.filter(
          (statement) => statement.respectiveReasonsForError
        );

        toast({
          title: "Rectification Failed",
          description: (
            <div>
              <p className="mb-2">
                Some statements could not be rectified. Please contact sales for
                assistance.
              </p>
              <ul className="list-disc pl-4">
                {unrectifiedStatements.map((statement, index) => (
                  <li key={index} className="text-sm">
                    {statement.pdfName}: {statement.respectiveReasonsForError}
                  </li>
                ))}
              </ul>
            </div>
          ),
          variant: "destructive",
          duration: 6000,
        });
      }
    } else {
      toast({
        title: "Contact Sales",
        description:
          "Unable to rectify all statements. Please contact our sales team for assistance.",
        variant: "destructive",
        duration: 5000,
      });
    }
    setPdfEditLoading(false);
  };

  useEffect(() => {
    if (selectedFailedFile?.columns) {
      setInitialConfigFormatted({
        lines: selectedFailedFile.columns.map((line) => ({ x: line })),
      });
    }
    console.log("PDFMarkerModal: selectedFailedFile", selectedFailedFile);
  }, [selectedFailedFile]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-6 overflow-y-auto">
        {selectedFailedFile ? (
          <PdfMarker
            addColsToStatementData={addColsToStatementData}
            initialConfig={initialConfigFormatted}
            pdfPath={
              source === "indiviualDasboard"
                ? selectedFailedFile?.filePath
                : selectedFailedFile?.path
            }
          />
        ) : (
          <div className="text-center text-red-500">
            Error: PDF path not available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PDFMarkerModal;
