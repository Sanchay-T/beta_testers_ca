import React, { useState, useEffect } from "react";
import UnifiedTable from "./UnifiedTable";
// // import refundData from "../../data/refund.json";
import SingleBarChart from "../charts/BarChart";
import { useParams } from "react-router-dom";
import ToggleStrip from "./ToggleStrip";

const Reversal = () => {
  const [data, setData] = useState([]);
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
        const result = await window.electron.getTransactionsByReversal(
          caseId,
          parseInt(individualId)
        );
        console.log("refund transactions:", result);
        // Transform data to include only required fields
        const transformedData = result.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          description: item.description,
          credit: item.amount,
          balance: item.balance,
          category: item.category,
          monthKey: getMonthKey(item.date)
        }));

        const uniqueMonths = [...new Set(transformedData.map(item => item.monthKey))]
          .sort((a, b) => {
            const dateA = getMonthDate(a);
            const dateB = getMonthDate(b);
            return dateA - dateB;
          });
        setData(transformedData)
        setAvailableMonths(uniqueMonths);
        
        // Initially select all months
        setSelectedMonths(uniqueMonths);
      } catch (error) {
        console.error("Error fetching emi transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
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
            <SingleBarChart
              title="Refund/Reversal"
              data={filteredData}
              xAxisKey="date"
              yAxisKey="credit"
              showLegends={true}
            />
          </div>
          <div>
            <UnifiedTable data={filteredData} title="Refund/Reversal Transactions" />
          </div>
        </>
        )}
        </>
      )}
    </div>
  );
};

export default Reversal;
