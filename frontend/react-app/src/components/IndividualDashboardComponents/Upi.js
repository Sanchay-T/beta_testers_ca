import { useState, useEffect } from "react";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import { useParams } from "react-router-dom";
import ToggleStrip from "./ToggleStrip";

import { motion, AnimatePresence } from "framer-motion";

const Upi = () => {
  const [upiCrData, setUpiCrData] = useState([]);
  const [upiDrData, setUpiDrData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("upi-cr");
  const { caseId, individualId } = useParams();
  const [availableMonthsDr, setAvailableMonthsDr] = useState([]);
  const [availableMonthsCr, setAvailableMonthsCr] = useState([]);
  const [selectedMonthsDr, setSelectedMonthsDr] = useState([]);
  const [selectedMonthsCr, setSelectedMonthsCr] = useState([]);

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
        const crResponse = await window.electron.getTransactionsByUpiCr(
          caseId,
          Number.parseInt(individualId)
        );
        const drResponse = await window.electron.getTransactionsByUpiDr(
          caseId,
          Number.parseInt(individualId)
        );

        // Transform UPI-Cr data
        const transformedUpiCrData = crResponse.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          description: item.description,
          credit: item.amount || 0,
          balance: item.balance || 0,
          category: item.category || "-",
          monthKey: getMonthKey(item.date),
          entity: item.entity || "-",
          id: item.id,
        }));

        // Transform UPI-Dr data
        const transformedUpiDrData = drResponse.map((item) => ({
          date: new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          description: item.description,
          debit: Math.abs(item.amount) || 0, // Ensure positive value
          balance: item.balance || 0,
          category: item.category || "-",
          monthKey: getMonthKey(item.date),
          entity: item.entity || "-",
          transactionId: item.id,
        }));


        const uniqueMonthsDr = [...new Set(transformedUpiDrData.map(item => item.monthKey))]
        .sort((a, b) => {
          const dateA = getMonthDate(a);
          const dateB = getMonthDate(b);
          return dateA - dateB;
        });
        const uniqueMonthsCr = [...new Set(transformedUpiDrData.map(item => item.monthKey))]
        .sort((a, b) => {
          const dateA = getMonthDate(a);
          const dateB = getMonthDate(b);
          return dateA - dateB;
        });

        setAvailableMonthsCr(uniqueMonthsCr);
        setAvailableMonthsDr(uniqueMonthsDr);
        setSelectedMonthsCr(uniqueMonthsCr)
        setSelectedMonthsDr(uniqueMonthsDr)
        setUpiCrData(transformedUpiCrData);
        setUpiDrData(transformedUpiDrData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching UPI transactions:", err);
        setError("Failed to fetch UPI transaction data");
        setIsLoading(false);
      }
    };

  useEffect(() => {
  

    fetchData();
  }, [caseId, individualId]);

  const chartConfig = {
    yAxis: {
      min: 0,
      max: 40000,
      ticks: [0, 9000, 18000, 27000, 36000],
    },
  };

  const columnTypes = {
    Debit: "bar",
    Credit: "bar",
    Balance: "line",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black text-xl font-semibold">
            Loading UPI data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-900 bg-opacity-50 backdrop-filter backdrop-blur-lg p-8 rounded-lg shadow-lg">
          <p className="text-red-200 text-xl font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const filteredUpiCrData = upiCrData.filter((item) =>
    selectedMonthsCr.includes(item.monthKey)
  );

  
  // Transform data for chart to show monthly aggregates
  const getCrChartData = () => {
    const monthlyData = {};
    
    filteredUpiCrData.forEach(item => {
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

  const filteredUpiDrData = upiDrData.filter((item) =>
    selectedMonthsDr.includes(item.monthKey)
  );

  
  // Transform data for chart to show monthly aggregates
  const getDrChartData = () => {
    const monthlyData = {};
    
    filteredUpiDrData.forEach(item => {
      if (!monthlyData[item.monthKey]) {
        monthlyData[item.monthKey] = {
          date: item.monthKey, // Using monthKey as date for x-axis
          debit: 0
        };
      }
      monthlyData[item.monthKey].debit += item.debit;
    });

    return Object.values(monthlyData).sort((a, b) => {
      const dateA = getMonthDate(a.date);
      const dateB = getMonthDate(b.date);
      return dateA - dateB;
    });
  };


  return (
    <div className="min-h-screen text-white p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        {/* <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          UPI Transactions
        </h1> */}
        <div className="mb-5">
          <div className="flex justify-left space-x-4">
            <button
              onClick={() => setActiveTab("upi-cr")}
              className={`px-6 py-2 rounded-full text-lg font-semibold transition-all duration-300 ${
                activeTab === "upi-cr"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              UPI-Cr
            </button>
            <button
              onClick={() => setActiveTab("upi-dr")}
              className={`px-6 py-3 rounded-full text-lg font-semibold transition-all duration-300 ${
                activeTab === "upi-dr"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              UPI-Dr
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "upi-cr" && (
              <div className="space-y-8">
                {upiCrData.length === 0 ? (
                  <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
                    <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                      No UPI Credit Data Available
                    </p>
                  </div>
                ) : (
                  <>
                   <ToggleStrip
                        columns={availableMonthsCr}
                        selectedColumns={selectedMonthsCr}
                        setSelectedColumns={setSelectedMonthsCr}
                      />
                    <div className="border border-gray-200 rounded-lg">
                      <h2 className="text-2xl font-semibold mb-4 p-6 text-black">
                        UPI Credit
                      </h2>
                      <div className="h-[400px]">
                        <BarLineChart
                          data={getCrChartData()}
                          xAxisKey="date"
                          columnTypes={columnTypes}
                          config={chartConfig}
                        />
                      </div>
                    </div>
                    <div className="w-full">
                      <UnifiedTable
                        data={filteredUpiCrData}
                        title="UPI Credit Transactions"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "upi-dr" && (
              <div className="space-y-8">
                {upiDrData.length === 0 ? (
                  <div className=" bg-gray-100 p-4 rounded-md w-full h-[10vh]">
                    <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                      No UPI Debit Data Available
                    </p>
                  </div>
                ) : (
                  <>
                   <ToggleStrip
                        columns={availableMonthsDr}
                        selectedColumns={selectedMonthsDr}
                        setSelectedColumns={setSelectedMonthsDr}
                      />
                    <div className="border border-gray-200 rounded-lg">
                      <h2 className="text-2xl font-semibold mb-4 p-6 text-black">
                        UPI Debit
                      </h2>
                      
                      <div className="h-[400px]">
                        <BarLineChart
                          data={getDrChartData()}
                          xAxisKey="date"
                          columnTypes={columnTypes}
                          config={chartConfig}
                        />
                      </div>
                    </div>

                   
  

                    <div className="w-full">
                      <UnifiedTable
                        data={filteredUpiDrData}
                        title="UPI Debit Transactions"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Upi;
