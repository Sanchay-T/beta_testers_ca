import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import { useParams } from "react-router-dom";
import ToggleStrip from "./ToggleStrip";

const Cash = () => {
  const [withdrawalData, setWithdrawalData] = useState([]);
  const [depositData, setDepositData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { caseId, individualId } = useParams();
  const [availableMonthsDr, setAvailableMonthsDr] = useState([]);
  const [selectedMonthsDr, setSelectedMonthsDr] = useState([]);
  const [availableMonthsCr, setAvailableMonthsCr] = useState([]);
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
  
  console.log("in cash", caseId, individualId);
  const fetchData = async () => {
    try {
      const withdrawalResponse =
        await window.electron.getTransactionsByCashWithdrawal(
          caseId,
          parseInt(individualId)
        );
      const depositResponse =
        await window.electron.getTransactionsByCashDeposit(
          caseId,
          parseInt(individualId)
        );

      // Transform withdrawal data
      const transformedWithdrawalData = withdrawalResponse.map((item) => ({
        date: new Date(item.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        Description: item.description,
        Debit: Math.abs(item.amount) || 0, // Ensure positive value
        Balance: item.balance || 0,
        category: item.category || "-",
        monthKey: getMonthKey(item.date),
        id: item.id,

      }));

      console.log("withdrawal data", transformedWithdrawalData);

      // Transform deposit data
      const transformedDepositData = depositResponse.map((item) => ({
        date: new Date(item.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        Description: item.description,
        Credit: item.amount || 0,
        Balance: item.balance || 0,
        category: item.category || "-",
        monthKey: getMonthKey(item.date),
        id: item.id,


      }));

      console.log("deposit data", transformedDepositData);

      const uniqueMonthsCr = [...new Set(transformedDepositData.map(item => item.monthKey))]
      .sort((a, b) => getMonthDate(a) - getMonthDate(b));
      const uniqueMonthsDr = [...new Set(transformedWithdrawalData.map(item => item.monthKey))]
        .sort((a, b) => getMonthDate(a) - getMonthDate(b));

      setWithdrawalData(transformedWithdrawalData);
      setAvailableMonthsDr(uniqueMonthsDr);
      setSelectedMonthsDr(uniqueMonthsDr);

      setDepositData(transformedDepositData);
      setAvailableMonthsCr(uniqueMonthsCr);
      setSelectedMonthsCr(uniqueMonthsCr);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching cash transactions:", err);
      setError("Failed to fetch transaction data");
      setIsLoading(false);
    }
  };

  useEffect(() => {
 

    fetchData();
  }, []);

  console.log("Withdrawal data:", withdrawalData);
  console.log("Deposit data:", depositData);

  const filteredCrData = depositData.filter(item => 
    selectedMonthsCr.includes(item.monthKey)
  );

  const filteredDrData = withdrawalData.filter(item => 
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
      <Tabs defaultValue="withdrawal">
        <TabsList className="grid w-[500px] grid-cols-2 pb-10 mb-4">
          <TabsTrigger value="withdrawal">Withdrawal</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawal">
          {withdrawalData.length === 0 ? (
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
                <div className="mb-6 w-full h-[60vh]">
                  <BarLineChart
                    data={filteredDrData}
                    xAxisKey="date"
                    columnTypes={columnTypes}
                    config={chartConfig}
                  />
                </div>
                <div>
                  <UnifiedTable
                    data={filteredDrData}
                    title="Cash Widthdrawal Transactions"
                    caseId={caseId}
                    refreshFunction={fetchData}
                  />
                </div>
              </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="deposit">
          {depositData.length === 0 ? (
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
                <div className="mb-6 w-full h-[60vh]">
                  <BarLineChart
                    data={filteredCrData}
                    xAxisKey="date"
                    columnTypes={columnTypes}
                    config={chartConfig}
                  />
                </div>
                <div>
                  <UnifiedTable data={filteredCrData} title="Cash Deposit Transactions" 
                    caseId={caseId}
                    refreshFunction={fetchData}
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

export default Cash;
