import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,

} from "../ui/dialog";
import DataTable from './UnifiedTable';

const EmiTransactionDialog = ({ isOpen, onClose, selectedEmi, transactions }) => {
    const [filteredTransactions, setFilteredTransactions] = useState([]);


    useEffect(() => {
        if (selectedEmi && transactions) {
            const filtered = transactions.filter(transaction =>
                transaction.debit === selectedEmi.amount
            );

            setFilteredTransactions(filtered);
        }
    }, [selectedEmi, transactions]);


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DataTable
                    data={filteredTransactions}
                    title=" Emi Transactions"
                />
            </DialogContent>
        </Dialog>
    );
};

export default EmiTransactionDialog;