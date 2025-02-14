// ReportContext.js
import React, { createContext, useContext, useState } from "react";

// Create the context
const ReportContext = createContext();

// Create the provider component
export const ReportProvider = ({ children }) => {
  // Define an initial state for the report
  const [reportData, setReportData] = useState({
    reportName: "",
    caseId: null,
    individualId: null,
    customerName:null,
    triggerRectify:{caseId:null,caseName:null},
  });

  // A helper function to update the context data partially.
  const updateReportData = (newData) => {
    setReportData((prevData) => ({
      ...prevData,
      ...newData,
    }));
  };

  return (
    <ReportContext.Provider value={{ reportData, updateReportData }}>
      {children}
    </ReportContext.Provider>
  );
};

// Create a custom hook for easy consumption
export const useReportContext = () => {
  const context = useContext(ReportContext);
  if (context === undefined) {
    throw new Error("useReportContext must be used within a ReportProvider");
  }
  return context;
};
