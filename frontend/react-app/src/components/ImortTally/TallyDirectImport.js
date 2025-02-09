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
import { buildTallyXml } from "./TallyUploadScript";
import { Dialog, DialogContent, DialogHeader, DialogTitle,DialogFooter,DialogDescription } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";

const TallyDirectImport = ({caseId}) => {
  const [vouchers, setVouchers] = useState(["Payment Receipt Voucher", "Contra Voucher"]);
  const [selectedVoucher, setSelectedVoucher] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState(false);
  const [tallyUploadData, setTallyUploadData] = useState([]);

  async function fetchVouchersTransactions() {
    try {
      const data = await window.electron.getTransactions(caseId); // Fetch vouchers from Electron API
      console.log({aq:data});
       const formattedData = data.map((transaction) => ({
        
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
        // voucher_type:transaction.voucher_type,
        voucher_type:transaction.type==="debit" ? "Payment Voucher":"Receipt Voucher",
        narration:transaction.description,
        id:transaction.id,
        imported:transaction.imported===1?true:false

      }));
      setTransactions(formattedData);
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
    console.log({transactions:transactions.length});

    const tallyData = transactions.map((transaction)=>{
      if(transaction.imported) {
        console.log("Already Imported");
        return null;
      }
      const tempVoucherType = transaction.voucher_type==="Payment Voucher" ? "Payment":"Receipt";
      return {
        companyName: "CypherSol",
        invoiceDate: formatDateForTally(transaction.date),
        effectiveDate: formatDateForTally(transaction.effective_date || transaction.date), // TODO : change this after asking poojan - Using invoice date if effective date is not available
        referenceNumber: transaction.reference_number || "Ref002",
        DrLedger: transaction.dr_ledger || "Cash",
        CrLedger: transaction.cr_ledger || "Cash",
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
    const successIds = [];
    setLoading2(true);

    // for (let i = 0; i < tallyUploadData.length; i++) {
      for (let i = 10; i < 12; i++) {
      const row = tallyUploadData[i];
      const xmlContent = buildTallyXml(row);
  
      try {
        const response = await fetch("http://localhost:9000", {
          method: "POST",
          mode: "no-cors", // Allow CORS
          headers: { "Content-Type": "application/xml" },
          body: xmlContent
        });
        console.log({response});
        const responseText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, "text/xml");
        const lineErrors = doc.getElementsByTagName("LINEERROR");
  
        if (lineErrors.length > 0) {
          let errorMessages = [];
          for (let k = 0; k < lineErrors.length; k++) {
            errorMessages.push(lineErrors.item(k).textContent);
          }
          console.log(`Row ${i + 1} -> Failed with errors:`, errorMessages.join(" | "));
        } else {
          console.log(`Row ${i + 1} -> Success!`);
          successIds.push(row.id);
        }
      } catch (err) {
        console.log(`Row ${i + 1} -> Error sending data to Tally:`, err);
      }
    }
    updateTallyStatus(successIds);

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
          <TallyTable data={transactions} title={" "} subtitle={" "} handleUpload={handleTallyUpload} />
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
    </Card>
  );
}

export default TallyDirectImport