const { ipcMain } = require('electron');
const sessionManager = require('../SessionManager');
const log = require('electron-log');
const licenseManager = require('../LicenseManager');
const db = require('../db/db');
const { transactions } = require('../db/schema/Transactions');
const { statements } = require('../db/schema/Statement');
const { cases } = require('../db/schema/Cases');
const { summary } = require('../db/schema/Summary');
const { eod } = require('../db/schema/Eod');
const { opportunityToEarn } = require('../db/schema/OpportunityToEarn');
const { eq, and, SQL, sql, inArray } = require("drizzle-orm");
const axios = require("axios");

function registerEditReportHandlers() {

    async function processOpportunityToEarnData(opportunityToEarnData, caseId) {
        try {
            log.info(
                "Full Opportunity to Earn Data:",
                JSON.stringify(opportunityToEarnData)
            );

            // Check if the data is an array with at least one element
            const opportunityToEarnArray = Array.isArray(opportunityToEarnData)
                ? opportunityToEarnData
                : opportunityToEarnData["Opportunity to Earn"];

            if (!opportunityToEarnArray || opportunityToEarnArray.length === 0) {
                log.warn("No Opportunity to Earn data found");
                return false;
            }

            const opportunityToEarnValues = Array.isArray(opportunityToEarnArray)
                ? opportunityToEarnArray[0]
                : opportunityToEarnArray;

            const validCaseId = caseId

            let homeLoanValue = 0;
            let loanAgainstProperty = 0;
            let businessLoan = 0;
            let termPlan = 0;
            let generalInsurance = 0;

            for (const item of opportunityToEarnArray) {
                const product = item["Product"];
                const amount = parseFloat(item["Amount"]) || 0;

                if (!isNaN(amount)) {
                    if (product.includes("Home Loan")) {
                        homeLoanValue += amount;
                    } else if (product.includes("Loan Against Property")) {
                        loanAgainstProperty += amount;
                    } else if (product.includes("Business Loan")) {
                        businessLoan += amount;
                    } else if (product.includes("Term Plan")) {
                        termPlan += amount;
                    } else if (product.includes("General Insurance")) {
                        generalInsurance += amount;
                    }
                }
            }

            log.info(
                "Extracted opportunity to earn values:",
                homeLoanValue,
                loanAgainstProperty,
                businessLoan,
                termPlan,
                generalInsurance
            );

            const existingOpportunityToEarn = await db
                .select()
                .from(opportunityToEarn)
                .where(eq(opportunityToEarn.caseId, validCaseId));

            if (existingOpportunityToEarn.length > 0) {
                // Update the existing opportunity to earn record
                await db
                    .update(opportunityToEarn)
                    .set({
                        homeLoanValue,
                        loanAgainstProperty,
                        businessLoan,
                        termPlan,
                        generalInsurance,
                    })
                    .where(eq(opportunityToEarn.caseId, validCaseId));
            } else {
                // Insert new opportunity to earn record
                await db.insert(opportunityToEarn).values({
                    caseId: validCaseId,
                    homeLoanValue,
                    loanAgainstProperty,
                    businessLoan,
                    termPlan,
                    generalInsurance,
                    createdAt: new Date(),
                });
            }

            log.info(`Opportunity to earn data processed for case ${validCaseId}`);
            return true;
        } catch (error) {
            log.error("Error processing opportunity to earn data:", error);
            throw error;
        }
    }

    const processSummaryData = async (parsedData, caseId) => {
        try {
            const validCaseId = caseId

            // Validate the summary data
            if (
                !parsedData ||
                typeof parsedData !== "object" ||
                !parsedData["Particulars"] ||
                !parsedData["Income Receipts"] ||
                !parsedData["Important Expenses"] ||
                !parsedData["Other Expenses"]
            ) {
                throw new Error("Invalid summary data provided");
            }

            // Prepare summary data object
            const summaryData = {
                particulars: parsedData["Particulars"],
                incomeReceipts: parsedData["Income Receipts"],
                importantExpenses: parsedData["Important Expenses"],
                otherExpenses: parsedData["Other Expenses"],
            };

            // Check if summary data already exists for this case
            const existingSummary = await db
                .select()
                .from(summary)
                .where(eq(summary.caseId, validCaseId))
                .limit(1);

            if (existingSummary.length > 0) {
                // Update the existing summary record
                await db
                    .update(summary)
                    .set({
                        data: JSON.stringify(summaryData),
                        updatedAt: new Date(),
                    })
                    .where(eq(summary.caseId, validCaseId));
                // log.info(`Updated Data:`,summaryData);
            } else {
                // Insert new summary record
                await db.insert(summary).values({
                    caseId: validCaseId,
                    data: JSON.stringify(summaryData),
                    createdAt: new Date(),
                });
            }

            log.info(`Summary data processed for case ${validCaseId}`);
            return true;
        } catch (error) {
            log.error("Error processing summary data:", error);
            throw error;
        }
    };


    const formatDate = (dateString) => {
        const date = new Date(dateString); // Parse the date string
        const day = String(date.getDate()).padStart(2, '0'); // Get day and pad with zero
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Get month (0-based) and pad with zero
        const year = date.getFullYear(); // Get full year

        return `${day}-${month}-${year}`; // Format as dd-mm-yyyy
    };

    const sanitizeJSONString = (jsonString) => {
        return jsonString
            .replace(/: *NaN/g, ": null")
            .replace(/: *undefined/g, ": null")
            .replace(/: *Infinity/g, ": null")
            .replace(/: *-Infinity/g, ": null");
    };

    const bulkUpdateTransactions = async (finalSql, ids) => {
        await db.update(transactions).set({ category: finalSql }).where(inArray(transactions.id, ids));
    };

    // Prepare data for database insertion
    const prepareTransactionsForDB = async (data) => {
        console.log({ prepareTransactionsForDB: data })
        if (!data || Object.keys(data).length === 0) {
            return; // No data to process
        }

        // Prepare SQL chunks and IDs
        const sqlChunks = [];
        const ids = [];

        // Start the SQL case statement
        sqlChunks.push(sql`(case`);

        // Iterate through key-value pairs of data
        for (const [key, item] of Object.entries(data)) {
            log.info('Item : ', key, item.category);
            const id = key; // Use transactionId or fallback to key
            const category = item.category || "Uncategorized"; // Default to "Uncategorized"

            sqlChunks.push(sql`when ${transactions.id} = ${id} then ${category}`); // Create case condition
            ids.push(id); // Collect the IDs for the WHERE clause
        }

        // End the SQL case statement
        sqlChunks.push(sql`end)`);

        // Join the SQL chunks
        const finalSql = sql.join(sqlChunks, sql.raw(' '));
        // log.info("Final SQL : ", finalSql, ids);

        return { finalSql, ids };
    };

    const prepareEntityForDB = async (data) => {
        if (!data || data.length === 0) {
            return; // No data to process
        }

        // Prepare SQL chunks and IDs
        const sqlChunks = [];
        const ids = [];

        // Start the SQL case statement
        sqlChunks.push(sql`(case`);

        // Iterate through key-value pairs of data
        // Iterate through the list of objects
        for (const item of data) {
            const id = item.transactionId; // Use transactionId from the object
            const entity = item.entity || null; // Default to "Uncategorized"

            // Log each item for debugging
            log.info('Item:', id, entity);

            // Create case condition
            if (entity) {
                sqlChunks.push(sql`when ${transactions.id} = ${id} then ${entity}`);
            }
            ids.push(id); // Collect the IDs for the WHERE clause
        }


        // End the SQL case statement
        sqlChunks.push(sql`else null end)`);

        // Join the SQL chunks into a final SQL statement
        const finalSql = sql.join(sqlChunks, sql.raw(' '));

        // Log the final query
        log.info("Final SQL:", finalSql.text, ids);

        // Return the final SQL query and IDs
        return { finalSql, ids };
    }

    const bulkUpdateEntity = async (finalSql, ids) => {
        await db.update(transactions).set({ entity: finalSql }).where(inArray(transactions.id, ids));
    };

    ipcMain.handle('edit-category', async (event, data, caseId) => {


        log.info('Edit Category : ', data);
        // const caseId = 26;

        let new_categories = [];
        let transactionsForCase = null;
        let eod_data = null;

        try {
            transactionsForCase = await db
                .select({
                    "id": transactions.id,
                    "Date": transactions.date,
                    "Description": transactions.description,
                    "Type": transactions.type,
                    "Amount": transactions.amount,
                    "Balance": transactions.balance,
                    "Category": transactions.category,
                })
                .from(transactions)
                .innerJoin(statements, eq(transactions.statementId, statements.id))
                .innerJoin(cases, eq(statements.caseId, cases.id))
                .where(eq(cases.id, caseId));
        }
        catch (err) {
            log.error("Error fetching transactions for case:", err);
        }

        log.info("Count of transactions for case:", transactionsForCase.length);



        const frontendData = data
        let aiyaz = 0;

        const updatedTransactions = transactionsForCase.map((transaction, index) => {

            const { id, Date, Amount, Type, ...requiredFields } = transaction;
            log.info(transaction.id);
            const frontendEntry = frontendData[transaction.id.toString()]; // Check if the ID exists in frontend data

            if (frontendEntry) {
                log.info("Found frontend entry for ID:", frontendEntry, id);
                const formattedDate = formatDate(Date);
                // If present in frontend data, update the transaction
                log.info({ transaction, frontendEntry })
                aiyaz = index;
                return {
                    "Value Date": formattedDate,
                    ...requiredFields,
                    Category: frontendEntry.category || transaction.category,
                    Debit: Type === "debit" ? Amount : 0,
                    Credit: Type === "credit" ? Amount : 0
                };

            }

            return {
                "Value Date": formatDate(Date),
                ...requiredFields,
                Debit: Type === "debit" ? Amount : 0,
                Credit: Type === "credit" ? Amount : 0
            };
        });

        log.info("Updated transactions:", updatedTransactions.slice(0, 5));
        log.info("Updated transactions:", updatedTransactions[aiyaz]);



        const newCategories = Object.values(frontendData).reduce((acc, item) => {
            if (item.is_new) {
                acc.push({
                    Description: item.description || "Unknown",
                    "Debit / Credit": item.type == "debit" ? "Debit" : "Credit",
                    Category: item.category || "Uncategorized",
                    Particulars: item.classification || "Others"
                });
            }
            return acc;
        }, []);

        console.log({ newCategories: newCategories, newCategoriesLength: newCategories.length });


        try {
            // get eod data 
            eod_data = await db.select().from(eod).where(eq(eod.caseId, caseId));
            eod_data = JSON.parse(eod_data[0].data);
            log.info("EOD data fetched successfully", typeof eod_data);
        }
        catch (err) {
            log.info("Failed to fetch eod data", err);
        }


        try {
            // make api call 
            const serverEndpoint = "http://localhost:7500/edit-category/";

            const payload = {
                transaction_data: updatedTransactions,
                new_categories: newCategories,
                eod_data: eod_data
            }

            // use axios 
            const response = await axios.post(serverEndpoint, payload, {
                headers: { "Content-Type": "application/json" },
                timeout: 300000,
                validateStatus: (status) => status === 200,
            });

            // log.info("API response:", typeof response.data);

            const sanitizedJsonString = sanitizeJSONString(response.data);
            parsedData = JSON.parse(sanitizedJsonString);

            try {
                await processSummaryData(
                    {
                        Particulars: parsedData["Particulars"] || [],
                        "Income Receipts": parsedData["Income Receipts"] || [],
                        "Important Expenses": parsedData["Important Expenses"] || [],
                        "Other Expenses": parsedData["Other Expenses"] || [],
                    },
                    caseId
                );
            } catch (error) {
                log.error("Error processing summary data:", error);
                throw error;
            }


            // Process Opportunity to Earn Data
            try {
                await processOpportunityToEarnData(
                    parsedData["Opportunity to Earn"] || [],
                    caseId
                );
            } catch (error) {
                log.error("Error processing opportunity to earn data:", error);
                throw error;
            }

            // log.info("API response:", parsedData);

            try {

                const { finalSql, ids } = await prepareTransactionsForDB(frontendData);

                // Insert transactions
                await bulkUpdateTransactions(finalSql, ids);

                // db.run("SELECT * FROM transactions").then((result) => {
                //     log.info("Transactions fetched successfully", result);
                // });
                log.info("Transactions updated successfully");
            }
            catch (error) {
                log.error("Error inserting transactions in batch:", error);
                throw error;
            }

        }
        catch (error) {
            log.error("API call failed:", error);
        }



    })


    ipcMain.handle("edit-entity", async (event, payload) => {
        try {
            const { finalSql, ids } = await prepareEntityForDB(payload);
            log.info({ finalSql, ids })
            await bulkUpdateEntity(finalSql, ids);
            log.info("Entity updated successfully");
            return { success: true };
        } catch (error) {
            log.error("Error inserting entity in batch:", error);
            throw error;
            return { success: false };
        }
    })
}

module.exports = { registerEditReportHandlers };