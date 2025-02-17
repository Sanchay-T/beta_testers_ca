import React, { useEffect, useState } from "react";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import ToggleStrip from "./ToggleStrip";
import { useParams } from "react-router-dom";

const Debtors = () => {
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await window.electron.getTransactionsByDebtor(
        caseId,
        parseInt(individualId)
      );

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
        entity: item.entity || '-',
        id: item.id,
        monthKey: getMonthKey(item.date)
      }));

      // Get unique months and sort them
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
      console.error("Error fetching debtors' transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  // Filter data based on selected months
  const filteredData = data.filter(item => 
    selectedMonths.includes(item.monthKey)
  );

  // Transform data for chart to show monthly aggregates
  const getChartData = () => {
    const monthlyData = {};
    
    filteredData.forEach(item => {
      if (!monthlyData[item.monthKey]) {
        monthlyData[item.monthKey] = {
          date: item.monthKey, // Using monthKey as date for x-axis
          credit: 0
        };
      }
      monthlyData[item.monthKey].credit += item.credit;
    });

    return Object.values(monthlyData).sort((a, b) => {
      const dateA = getMonthDate(a.date);
      const dateB = getMonthDate(b.date);
      return dateA - dateB;
    });
  };

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
                xAxisKey="date"
                yAxisKey="credit"
                data={getChartData()}
                title="Debtors"
              />
            </div>
            <div className="w-full">
              <UnifiedTable data={filteredData} title="Debtors Transactions"
                    caseId={caseId} refreshFunction={fetchData}
                    />
            </div>
          </>
        )}
        </>
      )}
    </div>
  );
};

export default Debtors;