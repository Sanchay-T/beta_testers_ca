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
    categoryOptions: [
        "Bank Charges",
        "Bank Interest Received",
        "Bonus Paid",
        "Bonus Received",
        "Bounce",
        "Cash Deposits",
        "Cash Reversal",
        "Cash Withdrawal",
        "Closing Balance",
        "Credit Card Payment",
        "Debtors",
        "Departmental Stores",
        "Donation",
        "Food Expense/Hotel",
        "General Insurance",
        "Gold Loan",
        "GST Paid",
        "Income Tax Paid",
        "Income Tax Refund",
        "Indirect tax",
        "Interest Debit",
        "Interest Received",
        "Investment",
        "Life insurance",
        "Loan",
        "Loan given",
        "Local Cheque Collection",
        "Online Shopping",
        "Opening Balance",
        "Other Expenses",
        "POS-Cr",
        "POS-Dr",
        "Probable Claim Settlement",
        "Property Tax",
        "Provident Fund",
        "Redemption, Dividend & Interest",
        "Refund/Reversal",
        "Rent Paid",
        "Rent Received",
        "Salary Paid",
        "Salary Received",
        "Subscription / Entertainment",
        "TDS Deducted",
        "Total Income Tax Paid",
        "Travelling Expense",
        "UPI-Cr",
        "UPI-Dr",
        "Utility Bills",
        "Loan taken",
        "Loan Given",
        "Self transfer",
        "Suspense",
      ],
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
