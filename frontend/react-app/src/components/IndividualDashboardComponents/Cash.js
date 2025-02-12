import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BarLineChart from "../charts/BarLineChart";
import UnifiedTable from "./UnifiedTable";
import { useParams } from "react-router-dom";
import ToggleStrip from "./ToggleStrip";

const Cash = () => {
  const [withdrawalData, setWithdrawalData] = useState([]);
  const [depositData, setDepositData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("withdrawal");
  const { caseId, individualId } = useParams();
  const [availableMonthsDr, setAvailableMonthsDr] = useState([]);
  const [selectedMonthsDr, setSelectedMonthsDr] = useState([]);
  const [availableMonthsCr, setAvailableMonthsCr] = useState([]);
  const [selectedMonthsCr, setSelectedMonthsCr] = useState([]);

  // Helper function to get month key
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

      const uniqueMonthsCr = [
        ...new Set(transformedDepositData.map((item) => item.monthKey)),
      ].sort((a, b) => getMonthDate(a) - getMonthDate(b));
      const uniqueMonthsDr = [
        ...new Set(transformedWithdrawalData.map((item) => item.monthKey)),
      ].sort((a, b) => getMonthDate(a) - getMonthDate(b));

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

  const filteredCrData = depositData.filter((item) =>
    selectedMonthsCr.includes(item.monthKey)
  );

  const filteredDrData = withdrawalData.filter((item) =>
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
      <div className="flex items-center justify-center h-screen">
        <p className="text-white text-xl font-semibold">Loading Cash Data...</p>
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

  return (
    <div className="min-h-screen text-white p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        <div className="mb-5">
          <div className="flex justify-left space-x-4">
            <button
              onClick={() => setActiveTab("withdrawal")}
              className={`px-6 py-2 rounded-full text-lg font-semibold transition-all duration-300 ${
                activeTab === "withdrawal"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Withdrawal
            </button>
            <button
              onClick={() => setActiveTab("deposit")}
              className={`px-6 py-2 rounded-full text-lg font-semibold transition-all duration-300 ${
                activeTab === "deposit"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Deposit
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
            {activeTab === "withdrawal" && (
              <div className="space-y-8">
                {filteredDrData.length === 0 ? (
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
                    <div className="border border-gray-200 rounded-lg">
                      <h2 className="text-2xl font-semibold mb-4 p-6 text-black">
                        Cash Withdrawal
                      </h2>
                      <div className="h-[400px]">
                        <BarLineChart
                          data={filteredDrData}
                          xAxisKey="date"
                          columnTypes={columnTypes}
                          config={chartConfig}
                        />
                      </div>
                    </div>
                    <div className="w-full">
                      <UnifiedTable
                        data={filteredDrData}
                        title="Cash Withdrawal Transactions"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "deposit" && (
              <div className="space-y-8">
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
                        <div className="border border-gray-200 rounded-lg">
                          <h2 className="text-2xl font-semibold mb-4 p-6 text-black">
                            Cash Deposit
                          </h2>
                          <div className="h-[400px]">
                            <BarLineChart
                              data={filteredCrData}
                              xAxisKey="date"
                              columnTypes={columnTypes}
                              config={chartConfig}
                            />
                          </div>
                        </div>
                        <div className="w-full">
                          <UnifiedTable
                            data={filteredCrData}
                            title="Cash Deposit Transactions"
                            caseId={caseId}
                            refreshFunction={fetchData}
                          />
                        </div>
                      </>
                    )}
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

export default Cash;
