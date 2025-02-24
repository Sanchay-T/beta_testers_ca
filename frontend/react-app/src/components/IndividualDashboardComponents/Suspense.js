import React, { useState, useEffect } from "react";
import UnifiedTable from "./UnifiedTable";
import ToggleStrip from "./ToggleStrip";
import { RotateCw } from "lucide-react";
import { Button } from "../ui/button";
import { useParams } from "react-router-dom";


const Suspense = () => {
  // const [creditData, setCreditData] = useState([]);
  // const [debitData, setDebitData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suspenseAllData, setSuspenseAllData] = useState([]);
  // const [
  //   totalCreditDebitTransactionCount,
  //   setTotalCreditDebitTransactionCount,
  // ] = useState(0);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const { caseId, individualId, defaultTab } = useParams();


  const getMonthKey = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleString("en-GB", {
      month: "short",
    })}-${date.getFullYear()}`;
  };

  // Helper function to parse month string to Date
  const getMonthDate = (monthStr) => {
    const [month, year] = monthStr.split("-");
    const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
    return new Date(parseInt(year), monthIndex);
  };

  const processData = (transactions) => {
    return transactions.map((transaction) => ({
      date: new Date(transaction.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      description: transaction.description,
      credit:
        transaction.type.toLowerCase() === "credit" ? transaction.amount : 0,
      debit:
        transaction.type.toLowerCase() === "debit" ? transaction.amount : 0,
      balance: transaction.balance,
      category: transaction.category,
      id: transaction.id,
      monthKey: getMonthKey(transaction.date),
    }));
  };

  const fetchData = async () => {
    try {
      const suspenseTransactionaAll =
        await window.electron.getTransactionsBySuspense(
          caseId,
          parseInt(individualId)
        );

      console.log("suspenseTransactionaAll", suspenseTransactionaAll);

      const transformedSuspenseData = processData(suspenseTransactionaAll);

      console.log("transformedSuspenseData", transformedSuspenseData);

      const uniqueMonths = [
        ...new Set(transformedSuspenseData.map((item) => item.monthKey)),
      ].sort((a, b) => {
        const dateA = getMonthDate(a);
        const dateB = getMonthDate(b);
        return dateA - dateB;
      });
      setSuspenseAllData(transformedSuspenseData);
      setAvailableMonths(uniqueMonths);

      // Initially select all months
      setSelectedMonths(uniqueMonths);
    } catch (error) {
      console.error("Error fetching suspense transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = suspenseAllData.filter((item) =>
    selectedMonths.includes(item.monthKey)
  );

  if (isLoading) {
    return (
      <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
        <p className="text-gray-800 text-center mt-3 font-medium text-lg">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg m-8 mt-2 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Suspense Transactions
        </h2>

        {/* Refresh Button */}
        <Button
          onClick={fetchData}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RotateCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            Loading...
          </p>
        </div>
      ) : suspenseAllData.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            No Data Available
          </p>
        </div>
      ) : (
        <>
          <ToggleStrip
            columns={availableMonths}
            selectedColumns={selectedMonths}
            setSelectedColumns={setSelectedMonths}
          />

          {selectedMonths.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-400 my-6">
              Select months to view data
            </div>
          ) : (
            <UnifiedTable
              data={filteredData}
              title="Suspense Transactions"
              refreshFunction={fetchData}
              source="suspense"
            />
          )}
        </>
      )}
    </div>
  );
};

export default Suspense;
