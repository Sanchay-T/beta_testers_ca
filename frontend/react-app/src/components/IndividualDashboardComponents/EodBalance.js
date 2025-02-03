import React, { useState, useMemo, useEffect } from "react";
import SingleLineChart from "../charts/LineChart";
import DataTable from "./TableData";
import ToggleStrip from "./ToggleStrip";

const EodBalance = ({ caseId }) => {
  const [eodData, setEodData] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEodData = async () => {
      try {
        console.log("Fetching EOD data for caseId:", caseId);
        const fetchData = await window.electron.getEodBalance(caseId);
        console.log("data", fetchData);
        if(fetchData.length < 0){
          throw error;
        }
        // Parse the data if it's a string, otherwise use as is
        const parsedData = typeof fetchData[0].data === 'string' 
          ? JSON.parse(fetchData[0].data) 
          : fetchData[0].data;

        // Ensure we have an array
        const dataArray = Array.isArray(parsedData) ? parsedData : [];
        
        setEodData(dataArray);
        console.log("Fetched EOD data:", dataArray);

        // Set numeric columns if we have data
        if (dataArray.length > 0) {
          const columns = Object.keys(dataArray[0]);
          const numeric = columns.filter(
            (column) =>
              column !== "Day" &&
              dataArray.some((row) => {
                const value = String(row[column]);
                return !isNaN(parseFloat(value)) && !value.includes("-");
              })
          );
          setNumericColumns(numeric);
          setSelectedColumns(numeric);
        }
      } catch (err) {
        console.log("hj",err)
        setEodData([])
        // setError("Failed to fetch EOD data");
        console.error("Error fetching EOD data:", err);
        setEodData([]);
      }
    };

    if (caseId) {
      fetchEodData();
    }
  }, [caseId]);

  const [selectedColumns, setSelectedColumns] = useState([]);

  const transformedData = useMemo(() => {
    if (!Array.isArray(eodData)) {
      console.warn('eodData is not an array:', eodData);
      return [];
    }

    return eodData.flatMap((row) => {
      return selectedColumns
        .map((month) => ({
          Month: month,
          Day: row.Day,
          Amount: row[month] === 0 ? "0.00" : parseFloat(row[month]).toFixed(2),
        }))
        .filter((item) => parseFloat(item.Amount) > 0);
    });
  }, [eodData, selectedColumns]);

  const maxValue = useMemo(() => {
    if (!Array.isArray(eodData)) return 0;

    return Math.max(
      ...eodData.flatMap((row) =>
        Object.entries(row)
          .filter(([key]) => key !== "Day")
          .map(([, value]) => parseFloat(value) || 0)
      ),
      0
    );
  }, [eodData]);

  const yAxisMax = Math.ceil(maxValue / 100000) * 100000;

  const chartConfig = {
    yAxis: {
      type: "number",
      domain: [0, yAxisMax / 100000],
      allowDataOverflow: false,
      tickCount: 8,
      scale: "linear",
    },
    xAxis: {
      type: "number",
      domain: [1, 31],
    },
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg p-4 m-8 mt-2 dark:bg-slate-950 w-[80vw]">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg space-y-6 m-8 mt-2 dark:bg-slate-950 w-[80vw]">
      {eodData.length > 0 ? (
        <>
          <ToggleStrip
            columns={numericColumns}
            selectedColumns={selectedColumns}
            setSelectedColumns={setSelectedColumns}
          />
          <div className="flex flex-col gap-1">
            <div className="h-[50vh] w-[80vw]">
              <SingleLineChart
                title="EOD Balance"
                data={eodData}
                xAxisKey="Day"
                selectedColumns={selectedColumns}
                bottom={300}
                height={"h-[45vh]"}
                config={chartConfig}
              />
            </div>
            <div className="mt-5">
              <DataTable data={eodData} title="EOD Balance" />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
          <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            No Data Available
          </p>
        </div>
      )}
    </div>
  );
};

export default EodBalance;