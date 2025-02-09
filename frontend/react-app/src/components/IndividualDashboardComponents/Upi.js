import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import { useParams } from "react-router-dom";
import ToggleStrip from "./ToggleStrip";

const Upi = () => {
  const [upiCrData, setUpiCrData] = useState([]);
  const [upiDrData, setUpiDrData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { caseId, individualId } = useParams();
  const [availableMonthsCr, setAvailableMonthsCr] = useState([]);
  const [selectedMonthsCr, setSelectedMonthsCr] = useState([]);
  const [availableMonthsDr, setAvailableMonthsDr] = useState([]);
  const [selectedMonthsDr, setSelectedMonthsDr] = useState([]);

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
        parseInt(individualId)
      );
      const drResponse = await window.electron.getTransactionsByUpiDr(
        caseId,
        parseInt(individualId)
      );

      // Transform UPI-Cr data
      const transformedUpiCrData = crResponse.map((item) => ({
        date: new Date(item.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        Description: item.description,
        Credit: item.amount || 0,
        Balance: item.balance || 0,
        category: item.category || '-',
        entity: item.entity || '-',
        id: item.id,
        monthKey: getMonthKey(item.date)
      }));

      // Transform UPI-Dr data
      const transformedUpiDrData = drResponse.map((item) => ({
        date: new Date(item.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        Description: item.description,
        Debit: Math.abs(item.amount) || 0,
        Balance: item.balance || 0,
        category: item.category || '-',
        entity: item.entity || '-',
        transactionId: item.id,
        monthKey: getMonthKey(item.date)
      }));

      // Get unique months for both Cr and Dr transactions
      const uniqueMonthsCr = [...new Set(transformedUpiCrData.map(item => item.monthKey))]
        .sort((a, b) => getMonthDate(a) - getMonthDate(b));
      const uniqueMonthsDr = [...new Set(transformedUpiDrData.map(item => item.monthKey))]
        .sort((a, b) => getMonthDate(a) - getMonthDate(b));

      setUpiCrData(transformedUpiCrData);
      setAvailableMonthsCr(uniqueMonthsCr);
      setSelectedMonthsCr(uniqueMonthsCr);
      
      setUpiDrData(transformedUpiDrData);
      setAvailableMonthsDr(uniqueMonthsDr);
      setSelectedMonthsDr(uniqueMonthsDr);
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

  // Filter data based on selected months
  const filteredCrData = upiCrData.filter(item => 
    selectedMonthsCr.includes(item.monthKey)
  );

  const filteredDrData = upiDrData.filter(item => 
    selectedMonthsDr.includes(item.monthKey)
  );

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
      <div className="rounded-xl shadow-sm m-8 mt-2 space-y-6">
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl shadow-sm m-8 mt-2 space-y-6">
        <div className="bg-red-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-red-800 text-center mt-3 font-medium text-lg">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl shadow-sm m-8 mt-2 space-y-6">
      <Tabs defaultValue="upi-cr">
        <TabsList className="grid w-[500px] grid-cols-2 pb-10 mb-4">
          <TabsTrigger value="upi-cr">UPI-Cr</TabsTrigger>
          <TabsTrigger value="upi-dr">UPI-Dr</TabsTrigger>
        </TabsList>

        <TabsContent value="upi-cr">
          {upiCrData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <>
              <ToggleStrip
                columns={availableMonthsCr}
                selectedColumns={selectedMonthsCr}
                setSelectedColumns={setSelectedMonthsCr}
              />

              {selectedMonthsCr.length === 0 ? (
                <div className="text-center text-gray-600 dark:text-gray-400 my-6">
                  Select months to display the graphs
                </div>
              ) : (
                <>
                  <div className="mb-6 w-full h-[60vh] mt-6">
                    <BarLineChart
                      data={filteredCrData}
                      xAxisKey="date"
                      columnTypes={columnTypes}
                      config={chartConfig}
                    />
                  </div>
                  <div>
                    <UnifiedTable data={filteredCrData} title="UPI Credit Transactions" 
                    caseId={caseId} refreshFunction={fetchData}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="upi-dr">
          {upiDrData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <>
              <ToggleStrip
                columns={availableMonthsDr}
                selectedColumns={selectedMonthsDr}
                setSelectedColumns={setSelectedMonthsDr}
              />

              {selectedMonthsDr.length === 0 ? (
                <div className="text-center text-gray-600 dark:text-gray-400 my-6">
                  Select months to display the graphs
                </div>
              ) : (
                <>
                  <div className="mb-6 w-full h-[60vh] mt-6">
                    <BarLineChart
                      data={filteredDrData}
                      xAxisKey="date"
                      columnTypes={columnTypes}
                      config={chartConfig}
                    />
                  </div>
                  <div>
                    <UnifiedTable data={filteredDrData} title="UPI Debit Transactions" 
                    caseId={caseId} refreshFunction={fetchData}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Upi;