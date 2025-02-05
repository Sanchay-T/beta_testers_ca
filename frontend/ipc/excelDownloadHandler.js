const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const databaseManager = require('../db/db');
const { transactions } = require('../db/schema/Transactions');
const { statements } = require('../db/schema/Statement');
const { cases } = require('../db/schema/Cases');
const { summary } = require('../db/schema/Summary');
const { eod } = require('../db/schema/EodSchema');
const { eq, and, SQL, sql, inArray, Name } = require("drizzle-orm");
const axios = require("axios");


function registerExcelDownloadHandlers(downloadPath) {

    const db = databaseManager.getInstance().getDatabase();
    log.info("Database instance : ", db);

    const formatDate = (dateString) => {
        const date = new Date(dateString); // Parse the date string
        const day = String(date.getDate()).padStart(2, '0'); // Get day and pad with zero
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Get month (0-based) and pad with zero
        const year = date.getFullYear(); // Get full year

        return `${day}-${month}-${year}`; // Format as dd-mm-yyyy
    };


    ipcMain.handle('excel-report-download', async (event, caseId) => {

        let new_categories = [];
        let transactionsForCase = [];
        let formattedTransactions = [];
        let statementsForCase = [];
        let caseName = "";
        let response = null;

        try {

            // get the case name
            try {
                caseName = await db
                    .select({
                        "name": cases.name,
                    })
                    .from(cases)
                    .where(eq(cases.id, caseId));


                caseName = caseName[0].name;
                log.info("Case Name : ", caseName);
            }
            catch (err) {
                log.error("Error fetching case name:", err);
                throw err;
            }


            try {
                // get all statements for the case
                statementsForCase = await db
                    .select({
                        "accountNumber": statements.accountNumber,
                        "customerName": statements.customerName,
                        "bankName": statements.bankName
                    })
                    .from(statements)
                    .where(eq(statements.caseId, caseId));

            }
            catch (err) {
                log.error("Error fetching statements for case:", err);
                throw err;
            }



            try {
                transactionsForCase = await db
                    .select({
                        "Date": transactions.date,
                        "Description": transactions.description,
                        "Type": transactions.type,
                        "Amount": transactions.amount,
                        "Balance": transactions.balance,
                        "Category": transactions.category,
                        "Entity": transactions.entity,
                        "Bank": transactions.bank
                    })
                    .from(transactions)
                    .innerJoin(statements, eq(transactions.statementId, statements.id))
                    .innerJoin(cases, eq(statements.caseId, cases.id))
                    .where(eq(cases.id, caseId));
            }
            catch (err) {
                log.error("Error fetching transactions for case:", err);
                throw err;
            }

            if (transactionsForCase.length > 0) {

                formattedTransactions = transactionsForCase.map(txn => {

                    const { Date, Amount, Type, ...remainingFields } = txn;

                    return {
                        "Value Date": formatDate(Date),
                        ...remainingFields,
                        "Debit": Type === "debit" ? Amount : 0,
                        "Credit": Type === "credit" ? Amount : 0,
                    };
                });
            }

            log.info("Formatted Transactions : ", formattedTransactions.slice(0, 2));

            const nameAndNumberData = statementsForCase.map(statement => ({
                "Account Number": statement.accountNumber,
                "Account Name": statement.customerName,
                "Bank": statement.bankName
            }));

            log.info("Name and Number Data : ", nameAndNumberData.slice(0, 2));


            try {

                const serverEndpoint = "http://localhost:7500/excel-download/";

                const payload = {
                    transaction_data: formattedTransactions,
                    name_n_num: nameAndNumberData,
                    case_name: caseName,
                }

                // 

                // use axios 
                response = await axios.post(serverEndpoint, payload, {
                    headers: { "Content-Type": "application/json" },
                    timeout: 300000,
                    validateStatus: (status) => status === 200,
                });

            }
            catch (err) {
                log.error("API Error:", err.response.data.detail, err.code);
                throw err.response.data.detail;
            }

            if (!response) {
                throw new Error("Error processing this request");
            }

            try {
                // Assuming caseName fetching logic is here
                // Fetching data for the report (statements, transactions, etc.)

                // Prepare file path for the Excel report
                // const reportFilePath = path.join(__dirname, `${caseName}_report.xlsx`);
                const reportFilePath = response.data;
                const fileName = `${caseName}_report.xlsx`;
                const downloadFilePath = path.join(downloadPath, fileName);
                log.info("Report file path:", reportFilePath);
                log.info("Download path:", downloadFilePath);

                // Stream the file to the renderer
                const readStream = fs.createReadStream(reportFilePath);

                readStream.on('data', (chunk) => {
                    log.info("Sending chunk to renderer");
                    event.sender.send('excel-report-chunk', chunk); // Send chunk to the renderer
                });

                readStream.on('end', () => {
                    log.info("File download complete");
                    event.sender.send('excel-report-complete', { message: 'File download complete', fileName: fileName }); // Notify completion
                });

                readStream.on('error', (err) => {
                    log.info("Error streaming the file:", err);
                    event.sender.send('excel-report-error', { error: 'Error streaming the file' });
                });

            } catch (err) {
                log.info("Error processing the report:", err);
                event.sender.send('excel-report-error', { error: 'Error processing the report' });
            }

        }
        catch (err) {
            log.error("Something went wrong:", err);
        }

    });
}


module.exports = { registerExcelDownloadHandlers };