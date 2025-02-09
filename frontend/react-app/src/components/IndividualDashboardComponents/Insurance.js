import React, { useState, useEffect } from "react";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import ToggleStrip from "./ToggleStrip";
import { useParams } from "react-router-dom";
// import investementData from "../../data/investment.json";

const Insurance = () => {
  const [data, setData] = useState([]);
  const [insuranceSummary, setInsuranceSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const { caseId, individualId } = useParams();
    const [availableMonths, setAvailableMonths] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
      // Helper function to get month key
      const getMonthKey = (dateString) => {
        const date = new Date(dateString);
        return `${date.toLocaleString("en-GB", { month: "short" })}-${date.getFullYear()}`;
      };
    
      // Helper function to parse month string to Date
      const getMonthDate = (monthStr) => {
        const [month, year] = monthStr.split("-");
        const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
        return new Date(parseInt(year), monthIndex);
      };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch transactions filtered by "debtor"
        const result = await window.electron.getTransactionsByInsurance(
          caseId,
          parseInt(individualId)
        );
        console.log("Insurance transactions:", result);
        // Transform data to include only required fields
        const transformedData = result.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          description: item.description,
          debit: item.amount,
          balance: item.balance,
          category: item.category,
          monthKey: getMonthKey(item.date)
        }));
        const groupedInsurance = processInsuranceSummary(transformedData);
        setInsuranceSummary(groupedInsurance);
        const uniqueMonths = [...new Set(transformedData.map(item => item.monthKey))]
          .sort((a, b) => {
            const dateA = getMonthDate(a);
            const dateB = getMonthDate(b);
            return dateA - dateB;
          });
        setData(transformedData);
        setAvailableMonths(uniqueMonths);
        
        // Initially select all months
        setSelectedMonths(uniqueMonths);
      } catch (error) {
        console.error("Error fetching insurance transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const processInsuranceSummary = (transactions) => {
    const grouped = [];
    const threshold = 0.7;
  
    transactions.forEach((transaction) => {
      const existing = grouped.find(
        (item) =>
          item.amount === transaction.debit &&
          similarity(item.description, transaction.description) >= threshold
      );
  
      if (existing) {
        existing.frequency++;
      } else {
        grouped.push({
          description: transaction.description,
          amount: transaction.debit,
          frequency: 1,
        });
      }
    });
  
    // Return grouped without filtering, as unique entries should have frequency 1
    return grouped;
  };
  

  const similarity = (str1, str2) => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const match = [...s1].filter((char) => s2.includes(char)).length;
    return match / Math.max(s1.length, s2.length);
  };
  const filteredData = data.filter(item => 
    selectedMonths.includes(item.monthKey)
  );

  if (loading) {
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
      {data.length === 0 ? (
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
            Select months to display the graphs
          </div>
        ) : (
          <>
            <div className="w-full h-[60vh]">
              <BarLineChart
              data={filteredData}
              title="Insurance"
              xAxisKey={"date"}
              yAxisKey={"debit"}
              />
            </div>
            <div>
            <UnifiedTable data={insuranceSummary} title="Insurance Summary" />
          </div>
            <div>
              <UnifiedTable data={filteredData} title="Insurance Transactions" />
            </div>
          </>
        )}
        </>
      )}
    </div>
  );
};

export default Insurance;
