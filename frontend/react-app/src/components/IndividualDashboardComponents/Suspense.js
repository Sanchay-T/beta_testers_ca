import React, { useState, useEffect } from "react";
import DataTable from "./TableData";
import { useParams } from "react-router-dom";
import {exportToExcel ,shareExcelFile}from "../exportToExcel"
import UnifiedTable from "./UnifiedTable";
const Suspense = () => {
  // const [creditData, setCreditData] = useState([]);
  // const [debitData, setDebitData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suspenseAllData,setSuspenseAllData] = useState([]);
  // const [
  //   totalCreditDebitTransactionCount,
  //   setTotalCreditDebitTransactionCount,
  // ] = useState(0);
  const { caseId, individualId } = useParams();

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
      id:transaction.id

    }));
  };

  useEffect(()=>{
    const fetchData = async () => {

    try{

      const suspenseTransactionaAll =await window.electron.getTransactionsBySuspense(
        caseId,
        parseInt(individualId)
      );

      console.log("suspenseTransactionaAll", suspenseTransactionaAll);

      const transformedSuspenseData = processData(suspenseTransactionaAll);

      console.log("transformedSuspenseData", transformedSuspenseData);

      setSuspenseAllData(transformedSuspenseData);
    }catch{

    }
    }
    setIsLoading(true);
    fetchData()
    setIsLoading(false);
  },[])



  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="rounded-xl shadow-sm m-8 mt-2 bg-white space-y-6 dark:bg-slate-950">
      {suspenseAllData.length === 0 ? (
            <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
              <p className="text-gray-800 text-center mt-3 font-medium text-lg">
                No Data Available
              </p>
            </div>
          ) : (
            <div className="">
              <div>
                <UnifiedTable data={suspenseAllData} title="Suspense Transactions" caseId={caseId} />
              </div>
            </div>
          )}
      
   
    </div>
  );
};

export default Suspense;
