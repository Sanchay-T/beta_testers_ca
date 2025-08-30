const { ipcMain, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const log = require("electron-log");
const axios = require("axios");
const sessionManager = require("../SessionManager");
const licenseManager = require("../LicenseManager");
const databaseManager = require("../db/db");
const { transactions } = require("../db/schema/Transactions");
const { statements } = require("../db/schema/Statement");
const { cases } = require("../db/schema/Cases");
const { eod } = require("../db/schema/EodSchema");
const { summary } = require("../db/schema/Summary");
const { failedStatements } = require("../db/schema/FailedStatements");
const { eq, and, inArray } = require("drizzle-orm");
const { opportunityToEarn } = require("../db/schema/OpportunityToEarn");
const getBaseUrl = require("../getBaseUrl");

let db = null;

const sanitizeJSONString = (jsonString) => {
  if (!jsonString) return jsonString;
  if (typeof jsonString !== "string") return jsonString;
  if (!jsonString) return jsonString;
  if (typeof jsonString !== "string") return jsonString;

  return jsonString
    .replace(/: *NaN/g, ": null")
    .replace(/: *undefined/g, ": null")
    .replace(/: *Infinity/g, ": null")
    .replace(/: *-Infinity/g, ": null");
};

const validateAndTransformTransaction = (transaction, statementId) => {
  if (
    transaction.Description === "" ||
    transaction.Description === null ||
    transaction.Description === undefined
  ) {
    log.info("FOUND NULL TRANSACTION - ", transaction.Description);
  }
  // log.info({ BeforeTransformation: transaction });
  if (!transaction["Value Date"]) {
    log.info("Missing required transaction fields");
    throw new Error("Missing required transaction fields");
  }
  let date = null;
  try {
    const [day, month, year] = transaction["Value Date"].split("-");
    date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (error) {
    throw new Error(`Invalid date format: ${transaction["Value Date"]}`);
  }

  let amount = 0;
  let type = "";
  if (
    transaction.Credit !== null &&
    !isNaN(transaction.Credit) &&
    transaction.Credit > 0
  ) {
    amount = Math.abs(transaction.Credit);
    type = "credit";
  } else if (
    transaction.Debit !== null &&
    !isNaN(transaction.Debit) &&
    transaction.Debit != 0
  ) {
    amount = transaction.Debit;
    type = "debit";
  }

  let balance = 0;
  if (transaction.Balance !== null && !isNaN(transaction.Balance)) {
    balance = parseFloat(transaction.Balance);
  }

  // remove trailing . from entity name
  if (transaction.Entity) {
    transaction.Entity = transaction.Entity.replace(/\.$/, "");
  }

  return {
    statementId,
    date: date,
    description: transaction.Description,
    amount: amount,
    category: transaction.Category || "uncategorized",
    type: type,
    balance: balance,
    bank: transaction.Bank.replace(/\d/g, "") || "unknown",
    entity: transaction.Entity || "unknown",
    voucher_type: transaction["Voucher type"] || "unknown",
  };
};

// const isDuplicateTransaction = async (transaction, statementId) => {
//   const existing = await db
//     .select()
//     .from(transactions)
//     .where(
//       and(
//         eq(transactions.statementId, statementId),
//         eq(transactions.date, transaction.date),
//         eq(transactions.amount, transaction.amount),
//         eq(transactions.description, transaction.description)
//       )
//     );
//   return existing.length > 0;
// };

const storeTransactionsBatch = async (transformedTransactions) => {
  console.log("Inside storeTransactionsBatch", transformedTransactions.length);
  try {
    if (transformedTransactions.length === 0) return;

    const uniqueTransactions = transformedTransactions;

    log.info({ uniqueTransactionsLength: uniqueTransactions.length });

    if (uniqueTransactions.length === 0) {
      log.info("No new unique transactions to store");
      return true;
    }

    const existingStatements = await db
      .select()
      .from(statements)
      .where(eq(statements.id, uniqueTransactions[0].statementId));

    if (existingStatements.length === 0) {
      throw new Error(
        `Statement ${uniqueTransactions[0].statementId} not found`
      );
    }

    const chunkSize = 50;
    console.log("Unique Transactions : ", uniqueTransactions.length);
    log.info({ uniqueTransactionsExample: uniqueTransactions[1] });
    for (let i = 0; i < uniqueTransactions.length; i += chunkSize) {
      const chunk = uniqueTransactions.slice(i, i + chunkSize);
      console.log("Chunk Size : ", chunk.length);
      await db.insert(transactions).values(chunk);
      log.info(
        `Stored transactions batch ${i / chunkSize + 1}, size: ${chunk.length}`
      );
    }

    return true;
  } catch (error) {
    log.error("Error storing transactions batch:", error);
    throw error;
  }
};

const getOrCreateCase = async (caseName) => {
  const userId = sessionManager.getUserId() || 1;
  log.info("User ID : ", userId);

  try {
    // First try to find existing case with exact match on name
    const existingCase = await db
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.name, caseName)
          // eq(cases.status, "active")
        )
      )
      .limit(1);

    if (existingCase.length > 0) {
      log.info(
        `Found existing case with ID: ${(existingCase[0].id, caseName)}`
      );
      return existingCase[0].id;
    }

    log.info({ creatingNewCase: caseName });

    // Create new case if not found
    const newCase = await db
      .insert(cases)
      .values({
        name: caseName,
        userId: userId,
        status: "Pending",
        createdAt: new Date(),
      })
      .returning();

    if (newCase.length > 0) {
      log.info(`Created new case with ID: ${(newCase[0].id, caseName)}`);
      return newCase[0].id;
    }

    throw new Error("Failed to create or find case");
  } catch (error) {
    log.error("Error in getOrCreateCase:", error);
    throw error;
  }
};

//Session Management Implementation required:
// const getOrCreateCase = async (caseId) => {
//   try {
//     // First try to find existing case
//     const existingCase = await db
//       .select({
//         id: cases.id,
//       })
//       .from(cases)
//       .where(eq(cases.id, caseId))
//       .limit(1);

//     if (existingCase.length > 0) {
//       log.info(`Found existing case with ID: ${existingCase[0].id}`);
//       return existingCase[0].id;
//     }

//     // Get user ID from session
//     const { userId } = await sessionManager.getUser();
//     if (!userId) {
//       throw new Error("User ID not found in session");
//     }

//     // Create new case if not found
//     const newCase = await db
//       .insert(cases)
//       .values({
//         name: caseId,
//         userId,
//         status: "active",
//         createdAt: new Date(),
//       })
//       .returning();

//     if (newCase.length > 0) {
//       log.info(`Created new case with ID: ${newCase[0].id}`);
//       return newCase[0].id;
//     }

//     throw new Error("Failed to create or find case");
//   } catch (error) {
//     log.error("Error in getOrCreateCase:", error);
//     throw error;
//   }
// };

const processStatementAndEOD = async (
  fileDetail,
  transactions_temp,
  eodData,
  caseName,
  nerResults,
  fileIndex,
  successPageNumber // Add this parameter
) => {
  log.info("inside", successPageNumber);
  try {
    const validCaseId = await getOrCreateCase(caseName);
    let statementId = null;
    let processedTransactions = 0;

    // Update the pages count in the cases table
    if (typeof successPageNumber === "number" && !isNaN(successPageNumber)) {
      log.info(
        `Updating pages count to ${successPageNumber} for case ${validCaseId}`
      );
      try {
        await db
          .update(cases)
          .set({
            pages: successPageNumber,
            updatedAt: new Date(),
          })
          .where(eq(cases.id, validCaseId));

        log.info(
          `Updated pages count to ${successPageNumber} for case ${validCaseId}`
        );
      } catch (error) {
        log.error(
          `Failed to update pages count for case ${validCaseId}:`,
          error
        );
        // Continue processing even if page count update fails
      }
    }

    // Get NER results for this file using passed fileIndex
    const customerName = nerResults?.Name?.[fileIndex] || "UNKNOWN";
    const accountNumber = nerResults?.["Acc Number"]?.[fileIndex] || "UNKNOWN";
    log.info("transaction_temp", {
      len: transactions_temp.length,
      example: transactions_temp[1],
    });
    log.info("fileDetail ", { fileDetail });
    // const tempBankName = fileDetail.bankName.replace(/\d/g, "");
    // log.info({withFileIndex:fileDetail.bankName+fileIndex})

    // Rest of the existing function code remains the same...
    const statementTransactions = transactions_temp
      // .filter((t) => t.Bank.replace(/\d/g, "") === fileDetail.bankName)
      .filter((t) => t.Bank === fileDetail.bankName + fileIndex)
      .map((transaction) => {
        try {
          return validateAndTransformTransaction(transaction, null);
        } catch (error) {
          log.warn(
            `Invalid transaction found during validation: ${error.message}`,
            transaction
          );
          return null;
        }
      })
      .filter(Boolean);

    if (statementTransactions.length === 0) {
      throw new Error("No valid transactions found for statement");
    }

    // Process Statement and Transactions
    try {
      let start_date = "";
      let end_date = "";
      if (fileDetail.start_date) {
        const [day1, month1, year1] = fileDetail["start_date"].split("-");
        start_date = new Date(year1, month1 - 1, day1);
      }
      if (fileDetail.end_date) {
        const [day2, month2, year2] = fileDetail["end_date"].split("-");
        end_date = new Date(year2, month2 - 1, day2);
      }
      const statementData = {
        caseId: validCaseId,
        accountNumber: accountNumber,
        customerName: customerName,
        ifscCode: fileDetail.ifscCode || null,
        bankName: fileDetail.bankName,
        filePath: fileDetail.pdf_paths,
        createdAt: new Date(),
        startDate: start_date === "" ? null : start_date,
        endDate: end_date === "" ? null : end_date,
        password: fileDetail.passwords,
      };

      log.info({ addingStatementData: statementData });

      const statementResult = await db
        .insert(statements)
        .values(statementData)
        .returning();

      if (!statementResult || statementResult.length === 0) {
        throw new Error("Failed to create statement record");
      }

      statementId = statementResult[0].id;
      const finalTransactions = statementTransactions.map((transaction) => ({
        ...transaction,
        statementId: statementId.toString(),
        createdAt: new Date(),
      }));
      await storeTransactionsBatch(finalTransactions);
      processedTransactions = finalTransactions.length;
    } catch (error) {
      log.error("Error processing statement and transactions:", error);
      throw error;
    }

    if (eodData && Array.isArray(eodData)) {
      try {
        const existingEOD = await db
          .select()
          .from(eod)
          .where(eq(eod.caseId, validCaseId));

        const validatedEODData = eodData
          .filter((entry) => {
            return (
              entry &&
              typeof entry === "object" &&
              entry.Day !== "Total" &&
              entry.Day !== "Average"
            );
          })
          .map((entry) => {
            try {
              const dayValue =
                typeof entry.Day === "number"
                  ? entry.Day
                  : parseFloat(entry.Day);

              if (isNaN(dayValue)) return null;

              const processedEntry = { Day: dayValue };

              Object.keys(entry).forEach((key) => {
                if (key !== "Day" && typeof entry[key] !== "undefined") {
                  const monthValue =
                    typeof entry[key] === "number"
                      ? entry[key]
                      : parseFloat(entry[key]);

                  if (!isNaN(monthValue)) {
                    processedEntry[key] = monthValue;
                  }
                }
              });

              if (Object.keys(processedEntry).length === 1) return null;

              return processedEntry;
            } catch (error) {
              log.warn("Error processing EOD entry:", error, entry);
              return null;
            }
          })
          .filter(Boolean);

        if (validatedEODData.length > 0) {
          if (existingEOD.length > 0) {
            await db
              .update(eod)
              .set({
                data: JSON.stringify(validatedEODData),
                updatedAt: new Date(),
              })
              .where(eq(eod.caseId, validCaseId));
          } else {
            await db.insert(eod).values({
              caseId: validCaseId,
              data: JSON.stringify(validatedEODData),
              createdAt: new Date(),
            });
          }
        }
      } catch (error) {
        log.error("Error processing EOD data:", error);
        throw error;
      }
    }

    return {
      statementId,
      transactionCount: processedTransactions,
      bankName: fileDetail.bankName,
      customerName,
      accountNumber,
    };
  } catch (error) {
    log.error("Error in processStatementAndEOD:", error);
    throw error;
  }
};

const processSummaryData = async (parsedData, caseName) => {
  log.info("Processing summary data for case:", caseName);
  // log.info("Parsed Data in summary:", parsedData);
  try {
    const validCaseId = await getOrCreateCase(caseName);

    // log.info({ parsedDataFromProcessSummary: parsedData });

    // Validate the summary data
    if (
      !parsedData ||
      typeof parsedData !== "object" ||
      !parsedData["Particulars"] ||
      !parsedData["Income Receipts"] ||
      !parsedData["Important Expenses"] ||
      !parsedData["Other Expenses"] ||
      !parsedData["Contra Debit"] ||
      !parsedData["Contra Credit"]
    ) {
      throw new Error("Invalid summary data provided");
    }

    // Prepare summary data object
    const summaryData = {
      particulars: parsedData["Particulars"],
      incomeReceipts: parsedData["Income Receipts"],
      importantExpenses: parsedData["Important Expenses"],
      otherExpenses: parsedData["Other Expenses"],
      contraDebit: parsedData["Contra Debit"],
      contraCredit: parsedData["Contra Credit"],
    };

    // log.info("Summary Data 1:", summaryData);

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
const updateCaseStatus = async (caseId, status) => {
  try {
    await db
      .update(cases)
      .set({
        status: status,
        updatedAt: new Date(),
      })
      .where(eq(cases.id, caseId));

    log.info(`Updated case ${caseId} status to ${status}`);
  } catch (error) {
    log.error(`Failed to update case ${caseId} status to ${status}:`, error);
    throw error;
  }
};

const processOpportunityToEarnData = async (
  opportunityToEarnData,
  caseName
) => {
  log.info("Processing opportunity to earn data for case:", caseName);
  try {
    // console.log(
    //   "Full Opportunity to Earn Data:",
    //   JSON.stringify(opportunityToEarnData)
    // );

    // Get the case ID for this specific report
    const validCaseId = await getOrCreateCase(caseName);

    await db
      .delete(opportunityToEarn)
      .where(eq(opportunityToEarn.caseId, validCaseId));

    // Extract the array from the object
    const opportunityToEarnArray = Array.isArray(opportunityToEarnData)
      ? opportunityToEarnData
      : opportunityToEarnData["Opportunity to Earn"];

    if (!opportunityToEarnArray || opportunityToEarnArray.length === 0) {
      log.warn("No Opportunity to Earn data found");
      return false;
    }

    // Initialize sums for each category
    let homeLoanValue = 0;
    let loanAgainstProperty = 0;
    let businessLoan = 0;
    let termPlan = 0;
    let generalInsurance = 0;

    // Loop through each product and categorize the amount correctly
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

    // Always insert a new record to append the data
    await db.insert(opportunityToEarn).values({
      caseId: validCaseId,
      homeLoanValue,
      loanAgainstProperty,
      businessLoan,
      termPlan,
      generalInsurance,
    });

    log.info(`New opportunity to earn data appended for case ${validCaseId}`);
    return true;
  } catch (error) {
    log.error("Error processing opportunity to earn data:", error);
    throw error;
  }
};

function preprocessPayload(payload) {
  // 1) Rename or handle the ColumnData "type" field
  //    e.g., rename "type" to "column_type"
  if (Array.isArray(payload.aiyaz_array_of_array)) {
    payload.aiyaz_array_of_array = payload.aiyaz_array_of_array.map(
      (statement) => {
        return statement.map((col) => {
          return {
            ...col,
            // rename `type` -> `column_type`; default to null if it's missing
            column_type: col.type ?? null,
            // remove the old `type` field if needed
            type: undefined,
          };
        });
      }
    );
  }

  // 2) Rename or handle the Transaction "type" field
  //    e.g., rename "type" -> "transaction_type"
  if (Array.isArray(payload.whole_transaction_sheet)) {
    payload.whole_transaction_sheet = payload.whole_transaction_sheet.map(
      (tx) => {
        return {
          ...tx,
          // rename `type` -> `transaction_type`
          transaction_type: tx.type ?? "",
          // remove or set to undefined so it doesn't get sent
          type: undefined,
          // Make sure numeric fields are actually numbers (not strings/null)
          amount: tx.amount || 0,
          balance: tx.balance || 0,
        };
      }
    );
  }

  // 3) Double-check that arrays aren’t undefined
  payload.bank_names = Array.isArray(payload.bank_names)
    ? payload.bank_names
    : [];
  payload.pdf_paths = Array.isArray(payload.pdf_paths) ? payload.pdf_paths : [];
  payload.passwords = Array.isArray(payload.passwords) ? payload.passwords : [];
  payload.start_dates = Array.isArray(payload.start_dates)
    ? payload.start_dates
    : [];
  payload.end_dates = Array.isArray(payload.end_dates) ? payload.end_dates : [];

  // 4) Ensure `ca_id` is a string if that’s what FastAPI expects
  if (payload.ca_id != null) {
    payload.ca_id = String(payload.ca_id);
  }

  return payload;
}
const formatDate = (dateString) => {
  const date = new Date(dateString); // Parse the date string

  const day = String(date.getDate()).padStart(2, "0"); // Get day and pad with zero
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Get month (0-based) and pad with zero
  const year = date.getFullYear(); // Get full year

  return `${day}-${month}-${year}`; // Format as dd-mm-yyyy
};

async function checkStatementLimit() {
  log.info("Checking statement limit...");

  const { ip, port } = licenseManager.getLicenseInfo() || {
    ip: "localhost",
    port: 7890,
  };

  try {
    const response = await axios.get(
      `http://${ip}:${port}/api/license/check-statement-limit`
    );

    if (response.status === 200) {
      const { limitReached, remaining } = response.data;
      log.info(`Limit reached: ${limitReached}, Remaining: ${remaining}`);
      return {
        success: true,
        data: {
          limitReached,
          remaining,
        },
      };
    } else {
      log.error("Unexpected response status:", response.statusText);
      throw new Error("Unexpected response status");
    }
  } catch (err) {
    log.error("Error contacting license server:", err.message);
    throw new Error("Error contacting license server");
  }
}

async function useStatement() {
  log.info("Requesting to use a statement...");

  const { ip, port } = licenseManager.getLicenseInfo() || {
    ip: "localhost",
    port: 7890,
  };

  try {
    const response = await axios.post(
      `http://${ip}:${port}/api/license/use-statement`
    );

    if (response.status === 200) {
      const { success, message, remaining, used } = response.data;
      log.info(
        `Statement used successfully. Remaining: ${remaining}, Used: ${used}`
      );
      return {
        success: true,
        data: {
          message,
          remaining,
          used,
        },
      };
    } else {
      log.error("Unexpected response status:", response.statusText);
      throw new Error("Unexpected response status");
    }
  } catch (err) {
    if (err.response && err.response.data) {
      const { error, remaining, used } = err.response.data;
      log.warn(
        `Failed to use statement: ${error}. Remaining: ${remaining}, Used: ${used}`
      );
      return {
        success: false,
        error,
        data: {
          remaining,
          used,
        },
      };
    } else {
      log.error("Error contacting license server:", err.message);
      throw new Error("Error contacting license server");
    }
  }
}

function generateReportIpc(tmpdir_path) {
  db = databaseManager.getInstance().getDatabase();

  const baseUrl = getBaseUrl();
  const generateReportEndpoint = `${baseUrl}/analyze-statements/`;
  const editPdfEndpoint = `${baseUrl}/column-rectify-add-pdf/`;

  ipcMain.handle(
    "generate-report",
    async (event, receivedResult, caseName, source = "generate-report") => {
      try {
        const { success, data } = await checkStatementLimit();
        if (!success) {
          throw new Error("Failed to check statement limit.");
        }
        if (data.limitReached) {
          throw new Error("Statement limit reached. Please contact support.");
        }
        log.info("Remaining statements:", data.remaining);
      } catch (error) {
        log.error("Error checking statement limit:", error.message);
        throw new Error("Something went wrong.");
      }

      log.info("Received result:", receivedResult);
      log.info("Received caseName:", caseName);
      const caseId = await getOrCreateCase(caseName);
      // Track file status
      const successfulFiles = new Set();
      const failedFiles = new Set();
      const allProcessedFiles = new Set();
      const uploadedFiles = new Map();
      try {
        log.info("IPC handler invoked for generate-report", caseName);

        if (!receivedResult?.files?.length) {
          throw new Error("Invalid or empty files array received");
        }

        // Ensure a dedicated directory for storing all PDFs (before processing)
        const caseFolder = path.join(tmpdir_path, "failed_pdfs", caseName);
        fs.mkdirSync(caseFolder, { recursive: true });
        log.info("Case Folder for PDFs:", caseFolder);

        // Step 1: Save all uploaded files in the case folder
        const fileDetails = receivedResult.files.map((fileDetail, index) => {
          if (!fileDetail.pdf_paths || !fileDetail.bankName) {
            throw new Error(
              `Missing required fields for file at index ${index}`
            );
          }

          const originalFilename = fileDetail.pdf_paths;
          let tempFilename;
          if (source !== "add-pdf") {
            tempFilename = `${Date.now()}-${path.basename(originalFilename)}`;
          } else {
            tempFilename = path.basename(originalFilename);
          }
          const filePath = path.join(caseFolder, tempFilename);

          allProcessedFiles.add(filePath);
          uploadedFiles.set(filePath, {
            originalName: originalFilename,
            bankName: fileDetail.bankName,
          });

          console.log(`Saving file to ${filePath}`);

          try {
            const fileContent = fs.readFileSync(fileDetail.pdf_paths, "binary");
            fs.writeFileSync(filePath, fileContent, "binary");
            successfulFiles.add(filePath);
          } catch (error) {
            log.error(
              `Failed to read or write file: ${fileDetail.pdf_paths}`,
              error
            );
            failedFiles.add(filePath);
          }

          return {
            ...fileDetail,
            pdf_paths: filePath,
            start_date: fileDetail.start_date || "",
            end_date: fileDetail.end_date || "",
          };
        });

        let whole_transaction_sheet = null;
        let transactionsForCase = null;
        log.info({ aqsource: source });
        if (source === "add-pdf") {
          try {
            transactionsForCase = await db
              .select({
                id: transactions.id,
                Date: transactions.date,
                Description: transactions.description,
                Type: transactions.type,
                Amount: transactions.amount,
                Balance: transactions.balance,
                Category: transactions.category,
              })
              .from(transactions)
              .innerJoin(
                statements,
                eq(transactions.statementId, statements.id)
              )
              .innerJoin(cases, eq(statements.caseId, cases.id))
              .where(eq(cases.id, caseId));
          } catch (err) {
            log.error("Error fetching transactions for case:", err);
          }
          log.info(
            "Count of transactions for case:",
            transactionsForCase.length
          );

          const updatedTransactions = transactionsForCase.map(
            (transaction, index) => {
              const { id, Date, Amount, Type, ...requiredFields } = transaction;

              return {
                "Value Date": formatDate(Date),
                ...requiredFields,
                Debit: Type === "debit" ? Amount : 0,
                Credit: Type === "credit" ? Amount : 0,
              };
            }
          );
          log.info(
            "Updated transactions example whole transaction ka :",
            updatedTransactions[1]
          );

          whole_transaction_sheet = updatedTransactions || null;
        }

        // Step 2: Send API request
        const payload = {
          bank_names: fileDetails.map((d) => d.bankName),
          pdf_paths: fileDetails.map((d) => d.pdf_paths),
          passwords: fileDetails.map((d) => d.passwords || ""),
          start_date: fileDetails.map((d) => d.start_date || ""),
          end_date: fileDetails.map((d) => d.end_date || ""),
          ca_id: caseName || "DEFAULT_CASE",
          whole_transaction_sheet,
          is_ocr: fileDetails.map((d) => d.is_ocr || false),
        };

        log.info("Sending API request with payload:", payload);

        const response = await axios.post(generateReportEndpoint, payload, {
          headers: { "Content-Type": "application/json" },
          // timeout: 300000,
          validateStatus: (status) => status === 200,
        });

        if (response.data.status == "failed") {
          log.info("API response failed:", response.data);
          return {
            success: false,
            data: {
              caseId: caseId,
              processed: null,
              warning:
                [response.data.message] || [response?.message] ||
                "Unknown error",
              processing_times: response.data?.processing_times || [],
            },
          };
        }

        log.info("API response received:", response.data);
        log.info("missing month list", response.data?.["missing_months_list"]);
        log.info(
          "pdf_paths_not_extracted",
          response.data?.["pdf_paths_not_extracted"]
        );
        log.info("time taken to process", response.data?.["processing_times"]);

        // Step 3: Handle failed extractions
        if (response.data?.["pdf_paths_not_extracted"]?.paths?.length > 0) {
          const failedPdfPaths =
            response.data["pdf_paths_not_extracted"].paths || [];

          // Store failed statements in database
          await db.insert(failedStatements).values({
            caseId: caseId,
            data: JSON.stringify(response.data["pdf_paths_not_extracted"]),
          });

          for (const failedPath of failedPdfPaths) {
            const fullPath = fileDetails.find((detail) =>
              detail.pdf_paths.includes(path.basename(failedPath))
            )?.pdf_paths;

            if (fullPath) {
              log.info("Added failedFiles aq 1");
              failedFiles.add(fullPath);
              successfulFiles.delete(fullPath);
            }
          }

          log.warn(
            "Some PDF paths were not extracted",
            Array.from(failedFiles)
          );
        }
        log.info("success page ", response.data?.["success_page_number"]);

        // Step 4: Process transactions
        const parsedData = JSON.parse(sanitizeJSONString(response.data.data));

        if (parsedData == null) {
          log.info("Parsed data is null, Statement Failed");
          await updateCaseStatus(caseId, "Failed");
          const failedPDFsDir = path.join(tmpdir_path, "failed_pdfs", caseName);
          fs.mkdirSync(failedPDFsDir, { recursive: true });
          return {
            success: true,
            data: {
              caseId: caseId,
              processed: null,
              totalTransactions: 0,
              eodProcessed: false,
              summaryProcessed: false,
              failedStatements:
                response.data["pdf_paths_not_extracted"] || null,
              failedFiles: Array.from(failedFiles),
              successfulFiles: Array.from(successfulFiles),
              nerResults: response.data?.ner_results || {
                Name: [],
                "Acc Number": [],
              },
              processing_times: response.data?.processing_times || [],
              warning:
                response.data?.["pdf_paths_not_extracted"][
                  "respective_reasons_for_error"
                ] || null,
            },
          };
        }

        const transactions_temp = (parsedData.Transactions || []).filter(
          (transaction) => {
            if (
              typeof transaction.Credit === "number" &&
              isNaN(transaction.Credit)
            )
              transaction.Credit = null;
            if (
              typeof transaction.Debit === "number" &&
              isNaN(transaction.Debit)
            )
              transaction.Debit = null;
            if (
              typeof transaction.Balance === "number" &&
              isNaN(transaction.Balance)
            )
              transaction.Balance = 0;

            return (
              (transaction.Credit !== null && !isNaN(transaction.Credit)) ||
              (transaction.Debit !== null && !isNaN(transaction.Debit))
            );
          }
        );

        console.log("transactions_temp", transactions_temp.length, {
          example: transactions_temp[1],
        });

        // Step 5: Process each file
        const processedData = [];
        // log.info({ exampleFileDetails: fileDetails });

        for (const fileDetail of fileDetails) {
          console.log({ fileDetail });
          try {
            const result = await processStatementAndEOD(
              fileDetail,
              transactions_temp,
              parsedData.EOD,
              caseName,
              response.data?.ner_results || { Name: [], "Acc Number": [] },
              fileDetails.indexOf(fileDetail),
              response.data?.success_page_number
            );
            processedData.push(result);

            if (!failedFiles.has(fileDetail.pdf_paths)) {
              successfulFiles.add(fileDetail.pdf_paths);
            }
          } catch (error) {
            log.info("Added failedFiles aq 2");

            failedFiles.add(fileDetail.pdf_paths);
            successfulFiles.delete(fileDetail.pdf_paths);
            log.error(
              `Error processing file detail for ${fileDetail.bankName}:`,
              error
            );
          }
        }

        // Step 6: Process summary and earnings
        // print the parsedData keys
        log.info("Parsed Data Keys: ", Object.keys(parsedData));
        try {
          await processSummaryData(
            {
              Particulars: parsedData["Particulars"] || [],
              "Income Receipts": parsedData["Income Receipts"] || [],
              "Important Expenses": parsedData["Important Expenses"] || [],
              "Other Expenses": parsedData["Other Expenses"] || [],
              "Contra Debit": parsedData["Contra Debit"] || [],
              "Contra Credit": parsedData["Contra Credit"] || [],
            },
            caseName
          );
        } catch (error) {
          log.error("Error processing summary data:", error);
          throw error;
        }

        try {
          await processOpportunityToEarnData(
            parsedData["Opportunity to Earn"] || [],
            payload.ca_id
          );
        } catch (error) {
          log.error("Error processing opportunity to earn data:", error);
          throw error;
        }

        // Step 7: Update case status
        await updateCaseStatus(
          caseId,
          failedFiles.size === 0 ? "Success" : "Failed"
        );

        // Step 8: Handle file cleanup
        // for (const filePath of allProcessedFiles) {
        //   try {
        //     if (fs.existsSync(filePath)) {
        //       if (failedFiles.has(filePath)) {
        //         log.info(`Failed PDF retained: ${filePath}`);
        //       } else if (successfulFiles.has(filePath)) {
        //         fs.unlinkSync(filePath);
        //         log.info(`Successfully deleted processed file: ${filePath}`);
        //       }
        //     }
        //   } catch (error) {
        //     log.error(`Error handling file ${filePath}:`, error);
        //   }
        // }

        log.info("missingMonthsList", response.data?.["missing_months_list"]);

        try {
          const result = await useStatement();
          if (result.success) {
            const { message, remaining, used } = result.data;
            log.info(`✅ ${message}\nRemaining: ${remaining}, Used: ${used}`);
          } else {
            const { error, remaining, used } = result;
            log.error(`❌ ${error}\nRemaining: ${remaining}, Used: ${used}`);
          }
        } catch (err) {
          log.error("Error using statement:", err.message);
        }

        return {
          success: true,
          data: {
            caseId: caseId,
            processed: processedData,
            totalTransactions: processedData.reduce(
              (sum, d) => sum + d.transactionCount,
              0
            ),
            eodProcessed: true,
            summaryProcessed: true,
            failedStatements: response.data["pdf_paths_not_extracted"] || null,
            failedFiles: Array.from(failedFiles),
            successfulFiles: Array.from(successfulFiles),
            nerResults: response.data?.ner_results || {
              Name: [],
              "Acc Number": [],
            },
            missingMonthsList: response.data?.["missing_months_list"] || [],
            warning:
              response.data?.["pdf_paths_not_extracted"][
                "respective_reasons_for_error"
              ] || null,
            processing_times: response.data?.processing_times || [],
          },
        };
      } catch (error) {
        log.error("Error in report generation:", {
          message: error.message,
          stack: error.stack,
        });

        await updateCaseStatus(caseId, "Failed");

        throw {
          message: error.message || "Failed to generate report",
          code: 500,
          details: error.toString(),
          timestamp: new Date().toISOString(),
          failedFiles: Array.from(failedFiles || []),
          successfulFiles: Array.from(successfulFiles || []),
          nerResults: {},
          missingMonthsList: [],
        };
      }
    }
  );

  ipcMain.handle("edit-pdf", async (event, result, caseName) => {
    log.info("IPC handler invoked for edit-pdf", caseName);
    const tempDir = tmpdir_path;
    log.info("Temp Directory : ", tempDir);
    let caseId = result[0].caseId;
    let statementId = result[0]?.id;
    console.log("CaseName backend edit pdf: ", caseName);
    console.log("Result backend edit pdf: ", result);

    // delete the statement and transaction of this rerun statement id

    try {
      await db.transaction(async (trx) => {
        // Step 1: Delete all related transactions
        await trx
          .delete(transactions)
          .where(eq(transactions.statementId, statementId));

        // Step 2: Delete the statement itself
        await trx.delete(statements).where(eq(statements.id, statementId));
      });

      console.log(
        `Statement ${statementId} and its related transactions deleted successfully`
      );
    } catch (error) {
      log.error("Error deleting statement:", error);
    }
    // Track successfully processed files to avoid deleting them
    const successfulFiles = [];
    const failedFiles = [];

    console.log("Result: ", result);
    try {
      transactionsForCase = await db
        .select({
          id: transactions.id,
          Date: transactions.date,
          Description: transactions.description,
          Type: transactions.type,
          Amount: transactions.amount,
          Balance: transactions.balance,
          Category: transactions.category,
        })
        .from(transactions)
        .innerJoin(statements, eq(transactions.statementId, statements.id))
        .innerJoin(cases, eq(statements.caseId, cases.id))
        .where(eq(cases.id, caseId));

      log.info("Count of transactions for case:", transactionsForCase.length);

      const updatedTransactions = transactionsForCase.map(
        (transaction, index) => {
          const { id, Date, Amount, Type, ...requiredFields } = transaction;

          return {
            "Value Date": formatDate(Date),
            ...requiredFields,
            Debit: Type === "debit" ? Amount : 0,
            Credit: Type === "credit" ? Amount : 0,
          };
        }
      );
      log.info(
        "Updated transactions example whole transaction ka :",
        updatedTransactions[1]
      );

      whole_transaction_sheet = updatedTransactions || null;
      // log.info("Whole Transaction Sheet: ",whole_transaction_sheet.length);
      const isOcrCandidate = (reason = "") => {
        const r = reason.toLowerCase();
        return (
          r.includes("image-only") ||
          r.includes("scanned") ||
          r.includes("non-text") ||
          r.includes("encoded")
        );
      };
      const payload = {
        bank_names: result.map((d) => d.bankName),
        pdf_paths: result.map((d) => d.path),
        passwords: result.map((d) => d.passwords || ""),
        start_date: result.map((d) => d.startDate || ""),
        end_date: result.map((d) => d.endDate || ""),
        ca_id: caseId || "DEFAULT_CASE",
        aiyazs_array_of_array: result.map((d) => d.rectifiedColumns || ""),
        whole_transaction_sheet: whole_transaction_sheet,
        is_ocr: result.map((d) => isOcrCandidate(d.respectiveReasonsForError)),
        // whole_transaction_sheet:result.map((d) => d.whole_transaction_sheet || ""),
      };

      console.log({ rectifyPayload: payload });

      const finalPayload = preprocessPayload(payload);

      log.info("finalPayload: ", finalPayload);
      const response = await axios.post(generateReportEndpoint, finalPayload, {
        headers: { "Content-Type": "application/json" },
        // timeout: 300000,
        validateStatus: (status) => status === 200,
      });

      if (response.data.status == "failed") {
        log.info("API response failed:", response.data);
        return {
          success: false,
          data: {
            caseId: caseId,
            processed: null,
            warning:
              [response.data.message] || [response?.message] || "Unknown error",
            processing_times: response.data?.processing_times || [],
          },
        };
      }

      log.info("Response from fastapi: ", response.data);

      let failedPdfPaths = [];

      // Check if there are any PDF paths not extracted
      if (response.data?.["pdf_paths_not_extracted"]?.paths?.length > 0) {
        await updateCaseStatus(caseId, "Failed");
        // Get the case ID
        const validCaseId = await getOrCreateCase(caseName);

        log.info({ validCaseId });

        // // Store failed statements in the database
        // await db.insert(failedStatements).values({
        //   caseId: validCaseId,
        //   data: JSON.stringify(modifiedData),
        // });

        // // Track failed PDF paths
        // failedPdfPaths = modifiedData.paths || [];
        log.warn("Some PDF paths were not extracted", failedPdfPaths);
      }

      // Continue processing if data exists
      if (!response.data) {
        throw new Error(
          "Empty or invalid response received from analysis server"
        );
      }

      let parsedData;
      try {
        const sanitizedJsonString = sanitizeJSONString(response.data.data);
        parsedData = JSON.parse(sanitizedJsonString);
        if (parsedData == null) {
          await updateCaseStatus(caseId, "Failed");
          const failedPDFsDir = path.join(tmpdir_path, "failed_pdfs", caseName);
          fs.mkdirSync(failedPDFsDir, { recursive: true });
          return {
            success: true,
            data: {
              caseId: caseId,
              processed: null,
              totalTransactions: 0,
              eodProcessed: false,
              summaryProcessed: false,
              failedStatements:
                response.data["pdf_paths_not_extracted"] || null,
              failedFiles: Array.from(failedFiles),
              successfulFiles: Array.from(successfulFiles),
              nerResults: response.data?.ner_results || {
                Name: [],
                "Acc Number": [],
              },
              warning:
                response.data?.["pdf_paths_not_extracted"][
                  "respective_reasons_for_error"
                ] || null,
              processing_times: response.data?.processing_times || [],
            },
          };
        }
      } catch (error) {
        log.error("JSON parsing error:", error);
        throw error;
      }

      // log.info("Parsed Data aq : ", parsedData);

      const transactions_temp = (parsedData.Transactions || []).filter(
        (transaction_temp) => {
          if (
            typeof transaction_temp.Credit === "number" &&
            isNaN(transaction_temp.Credit)
          ) {
            transaction.Credit = null;
          }
          if (
            typeof transaction_temp.Debit === "number" &&
            isNaN(transaction_temp.Debit)
          ) {
            transaction.Debit = null;
          }
          if (
            typeof transaction_temp.Balance === "number" &&
            isNaN(transaction_temp.Balance)
          ) {
            transaction_temp.Balance = 0;
          }

          return (
            (transaction_temp.Credit !== null &&
              !isNaN(transaction_temp.Credit)) ||
            (transaction_temp.Debit !== null && !isNaN(transaction_temp.Debit))
          );
        }
      );

      log.info("transactions_temp ", transactions_temp.length);

      const processedData = [];

      // create filedetails from result but remove rectifiedColumns

      const fileDetails = result.map((fileDetail, index) => {
        // remove rectifiedColumns
        return {
          end_date: fileDetail.endDate || "",
          start_date: fileDetail.startDate || "",
          pdf_paths: fileDetail.path,
          bankName: fileDetail.bankName.replace(/\d/g, ""),
          passwords: fileDetail.password || "",
        };
      });

      log.info({ exampleTrnsaction: transactions_temp[0] });
      log.info({ exampleFileDetails: fileDetails });

      for (const fileDetail of fileDetails) {
        try {
          const result = await processStatementAndEOD(
            fileDetail,
            transactions_temp,
            parsedData.EOD,
            caseName,
            response.data?.ner_results || { Name: [], "Acc Number": [] },
            fileDetails.indexOf(fileDetail)
          );
          processedData.push(result);
          // Track successfully processed files
          successfulFiles.push(fileDetail.pdf_paths);
        } catch (error) {
          // Track failed files
          failedFiles.push(fileDetail.pdf_paths);
          log.error(
            `Error processing file detail for ${fileDetail.bankName}:`,
            error
          );
          throw error;
        }
      }

      // Process Summary Data
      try {
        await processSummaryData(
          {
            Particulars: parsedData["Particulars"] || [],
            "Income Receipts": parsedData["Income Receipts"] || [],
            "Important Expenses": parsedData["Important Expenses"] || [],
            "Other Expenses": parsedData["Other Expenses"] || [],
            "Contra Credit": parsedData["Contra Credit"] || [],
            "Contra Debit": parsedData["Contra Debit"] || [],
          },
          caseName
        );
      } catch (error) {
        log.error("Error processing summary data:", error);
        throw error;
      }
      log.info(
        "Opportunity to Earn data: 1",
        parsedData["Opportunity to Earn"] || "not data"
      );
      // Process Opportunity to Earn Data
      try {
        await processOpportunityToEarnData(
          parsedData["Opportunity to Earn"] || [],
          caseName
        );
      } catch (error) {
        log.error("Error processing opportunity to earn data:", error);
        throw error;
      }

      // Cleanup
      // fileDetails.forEach((detail) => {
      //   try {
      //     if (fs.existsSync(detail.pdf_paths)) {
      //       fs.unlinkSync(detail.pdf_paths);
      //     }
      //   } catch (error) {
      //     log.warn(`Failed to cleanup temp file: ${detail.pdf_paths}`, error);
      //   }
      // });
      await updateCaseStatus(caseId, "Success");

      return {
        success: true,
        data: {
          caseId: caseId,
          processed: processedData,
          totalTransactions: processedData.reduce(
            (sum, d) => sum + d.transactionCount,
            0
          ),
          eodProcessed: true,
          summaryProcessed: true,
          failedStatements: response.data["pdf_paths_not_extracted"] || null,
          failedFiles: failedFiles,
          successfulFiles: successfulFiles,
          processing_times: response.data?.processing_times || [],
          warning:
            response.data?.["pdf_paths_not_extracted"][
              "respective_reasons_for_error"
            ] || null,
        },
      };
    } catch (error) {
      // if (caseId) {
      //   await updateCaseStatus(caseId, 'Failed');
      // }
      console.error(
        "Validation error detail:",
        JSON.stringify(error.response?.data?.detail, null, 2)
      );

      log.error("Error in Edit pdf:", {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
      });

      // If there's a specific PDF paths not extracted data, store it
      if (error.response?.data?.["pdf_paths_not_extracted"]) {
        try {
          const validCaseId = await getOrCreateCase(caseName);

          await db.insert(failedStatements).values({
            caseId: validCaseId,
            data: JSON.stringify(
              error.response.data["pdf_paths_not_extracted"]
            ),
          });

          // Track failed PDF paths
          const failedPdfPaths =
            error.response.data["pdf_paths_not_extracted"].paths || [];
          failedFiles.push(...failedPdfPaths);
        } catch (dbError) {
          log.error("Failed to store failed statements:", dbError);
        }
      }

      throw {
        message: error.message || "Failed to generate report",
        code: error.response?.status || 500,
        details: error.response?.data || error.toString(),
        timestamp: new Date().toISOString(),
        failedFiles: failedFiles,
      };
    }
  });
}

module.exports = { generateReportIpc, updateCaseStatus };
