import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Ambulance, Loader2 } from "lucide-react";
import TallyTable from "./TallyTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle,DialogFooter,DialogDescription } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { useReportContext } from "../../contexts/ReportContext";


const TallyDirectImport = () => {
  const [vouchers, setVouchers] = useState(["Payment Receipt Voucher", "Contra Voucher"]);
  const [selectedVoucher, setSelectedVoucher] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState(false);
  const [tallyUploadData, setTallyUploadData] = useState([]);
  const [failedTransactions, setFailedTransactions] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [successIds, setSuccessIds] = useState([]); 
  const { reportData, updateReportData } = useReportContext();
  const { caseId } = reportData;

  async function fetchVouchersTransactions() {
    try {
      const data = await window.electron.getTransactions(caseId); // Fetch vouchers from Electron API
      console.log({aq:data});
      console.log({beforeSort:data.data});
      const sortedData = data.sort((a, b) => a.imported - b.imported);
      console.log({sortedData:sortedData});

      const storedReasons = JSON.parse(localStorage.getItem("failedTransactions") || "{}");



       const formattedData = data.map((transaction) => 
        {
        if(transaction.voucher_type==="unknown") return null
          return {
        date: new Date(transaction.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        effective_date: "",
        reference_number:"",
        bill_reference:"",
        dr_ledger: transaction.type==="debit" ? (transaction.entity!=="unknown"?transaction.entity:transaction.category):"",
        cr_ledger:transaction.type==="credit" ? (transaction.entity!=="unknown"?transaction.entity:transaction.category):"",
        amount:transaction.amount,
        voucher_type:transaction.voucher_type,
        // voucher_type:transaction.voucher_type==="debit" ? "Payment Voucher":"Receipt Voucher",
        narration:transaction.description,
        id:transaction.id,
        imported:transaction.imported===1?true:false,
        failed_reason: storedReasons[transaction.id] || "", // ✅ Include failed reason
      }});
      // Remove null values
      const filteredData = formattedData.filter((data) => data !== null);
      setTransactions(filteredData);
      setSelectedVoucher("Payment Receipt Voucher");
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch available vouchers
  useEffect(() => {
   
    fetchVouchersTransactions();
  }, []);

  // Fetch transactions for selected voucher
  const handleVoucherChange = async (voucherId) => {
    setSelectedVoucher(voucherId);
    setLoading(true);
    try {
      const response = await window.electron.getVoucherTransactions(voucherId);
      if (!response.success) throw new Error(response.message);
      // Sort by imported satatus


      setTransactions(response.data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
    setLoading(false);
  };

  const formatDateForTally = (dateString) => {
    if (!dateString) return "";

    // Handle "YYYY-MM-DD" format (effectiveDate)
    if (dateString.includes("-")) {
        return dateString.replace(/-/g, ""); // Remove hyphens
    }

    // Handle "DD/MM/YYYY" format (invoiceDate)
    if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/");
        return `${year}${month}${day}`;
    }

    return dateString; // Return unchanged if format is unexpected
};

  const updateTallyStatus = async (successIds) => {
    console.log({successIds});
    try {
      console.log("Sending requet to Ipc")
      const response = await window.electron.updateTransactionStatus(successIds);
      console.log(response);

      if (!response) throw new Error(response.message);

      console.log("Transaction status updated successfully!");

      // Re-fetch transactions
      fetchVouchersTransactions();
      setConfirmationModal(false);
      setLoading2(false);

    } catch (err) {
      console.log(err)
      console.error("Error updating transaction status:", err);
    }
  }

  const handleTallyUpload = async (transactions) => {
    if (!companyName.trim()) {
      alert("Please enter a company name before uploading.");
      return;
    }
    console.log({transactions:transactions.length});

  // ✅ Check if any transaction is missing DrLedger or CrLedger and their imported is false

  const incompleteTransactions = transactions.filter(
    (transaction) => {
      if(transaction.imported) {
        return false;
      }else{
        return !transaction.dr_ledger || !transaction.cr_ledger;
      }
    }
  );

  if (incompleteTransactions.length > 0) {
    alert("Some transactions are missing DrLedger or CrLedger. Please fill them before uploading.");
    return;
  }

    const tallyData = transactions.map((transaction)=>{
      if(transaction.imported) {
        console.log("Already Imported");
        return null;
      }
      const tempVoucherType = transaction.voucher_type==="Payment Voucher" ? "Payment":"Receipt";
      return {
        companyName: companyName,
        invoiceDate: formatDateForTally(transaction.date),
        // invoiceDate:"20240401",
        effectiveDate: formatDateForTally(transaction.effective_date ||null), // TODO : change this after asking poojan - Using invoice date if effective date is not available
        // effectiveDate: "20240401", // TODO : change this after asking poojan - Using invoice date if effective date is not available
        referenceNumber: transaction.reference_number ||null,
        DrLedger: transaction.dr_ledger || null,
        // DrLedger: "sbin" || null,
        CrLedger: transaction.cr_ledger || null,
        // CrLedger: "icic" || null,
        amount: transaction.amount,
        narration: transaction.narration,
        voucherName: tempVoucherType,
        id:transaction.id
      }
    })

    // Remove null values
    const filteredData = tallyData.filter((data) => data !== null);



    setConfirmationModal(true);
    setTallyUploadData(filteredData);
  }


  const handleUploadAfterConfirmation=async ()=>{
    setLoading2(true);

      try {
        const response = await window.electron.uploadToTally(tallyUploadData);
        const failedTransactions = response.failedTransactions; // strcutre = {id, error}
        const successIds = response.successIds;

        const storedReasons = JSON.parse(localStorage.getItem("failedTransactions") || "{}");
        
        // Update failed transactions with reasons
        failedTransactions.forEach((transaction) => {
            storedReasons[transaction.id] = transaction.error; // Store error by transaction ID
        });

        // Remove successIds from stored reasons (clear errors for successful transactions)
        successIds.forEach((id) => {
            delete storedReasons[id];
          });

        localStorage.setItem("failedTransactions", JSON.stringify(storedReasons));

          // ✅ Update transactions immediately to reflect failed reasons in the table
          setTransactions((prevTransactions) =>
            prevTransactions.map((transaction) => ({
              ...transaction,
              failed_reason: storedReasons[transaction.id] || "", // Update failed reason immediately
            }))
          );

        // show a dailog box with failed transactions
        if (failedTransactions.length > 0) {
          console.log("Failed Transactions:", failedTransactions);
          setSuccessIds(successIds);
          setTransactions((prevTransactions) =>
            prevTransactions.map((transaction) => ({
              ...transaction,
              imported: successIds.includes(transaction.id) ? true : transaction.imported,
            }))
          );
          // also update the status of the transactions
          setFailedTransactions(failedTransactions);
          setConfirmationModal(false);
        }

      } catch (err) {
        // console.log(`Row ${i + 1} -> Error sending data to Tally:`, err);
      }finally{
          setLoading2(false);
      }
  }

  return (
    <Card>
      <CardHeader>
  
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">{`Tally ${selectedVoucher} Transactions`}</CardTitle>
          
          <div className="flex gap-4">
            <Select onValueChange={handleVoucherChange} value={selectedVoucher}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a Voucher" />
              </SelectTrigger>
              <SelectContent>
                {vouchers.map((voucher) => (
                  <SelectItem key={voucher} value={voucher}>
                    {voucher}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
      </CardHeader>
      <CardContent className="">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : transactions.length > 0 ? (
          <TallyTable data={transactions} title={" "} subtitle={" "} handleUpload={handleTallyUpload} setCompanyName={setCompanyName} companyName={companyName}/>
        ) : (
          <div className="text-center py-6 text-gray-500">No transactions available</div>
        )}
      </CardContent>

         {/* Category Update Confirmation Modal */}
      <Dialog open={confirmationModal} onOpenChange={setConfirmationModal}>
        <DialogContent className="min-w-[500px] max-w-[40%]">
          <DialogHeader>
            <DialogTitle>Confirm Tally Import</DialogTitle>
            <DialogDescription>
              <p className="mt-4 text-lg">You are about to import {tallyUploadData.length} transactions to Tally. Are you sure you want to proceed?
              </p>
              {/* Show a note that already uploaded transaction wont get uploaded again */}

              <p className="my-4 text-sm text-gray-500">
                Note: Already uploaded transactions will not be uploaded again.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmationModal(false)}>
              Cancel
            </Button>
            
            <Button disabled={loading2} variant="default" onClick={handleUploadAfterConfirmation}>
              {loading2 ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog to show failed transaction and reasons */}
      <Dialog open={failedTransactions.length > 0} onOpenChange={setFailedTransactions}>
        <DialogContent className="min-w-[500px] max-w-[40%] max-h-[90%] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alert</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            <Table>
            {successIds.length>0&&<TableHead>
                <TableRow>
                  {/* <TableHeader>Transaction ID</TableHeader> */}
                  <TableHeader className="text-lg text-green-700">Successfully uploaded {successIds.length} transactions</TableHeader>
                </TableRow>
              </TableHead>}
              <TableBody>
                {failedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    {/* <TableCell>{transaction.id}</TableCell> */}
                    <TableCell>{transaction.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogDescription>
          <DialogFooter className={"sticky bottom-0"}>
            <Button variant="default" onClick={() => setFailedTransactions([])}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default TallyDirectImport