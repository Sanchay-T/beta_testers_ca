const { ipcMain, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const log = require("electron-log");
const axios = require("axios");
const databaseManager = require('../db/db');
const db = databaseManager.getDatabase();
const { transactions } = require("../db/schema/Transactions");
const { statements } = require("../db/schema/Statement");
const { cases } = require("../db/schema/Cases");
const { eod } = require("../db/schema/Eod");
const { summary } = require("../db/schema/Summary");
const { failedStatements } = require("../db/schema/FailedStatements");
const { eq, and, inArray } = require("drizzle-orm");
const { opportunityToEarn } = require("../db/schema/OpportunityToEarn");

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
  if (!transaction["Value Date"] || !transaction.Description) {
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
    throw new Error(Invalid date format: ${transaction["Value Date"]});
  }

  let amount = 0;
  if (transaction.Credit !== null && !isNaN(transaction.Credit)) {
    amount = Math.abs(transaction.Credit);
  } else if (transaction.Debit !== null && !isNaN(transaction.Debit)) {
    amount = Math.abs(transaction.Debit);
  }

  let balance = 0;
  if (transaction.Balance !== null && !isNaN(transaction.Balance)) {
    balance = parseFloat(transaction.Balance);
  }

  const type =
    transaction.Credit !== null && !isNaN(transaction.Credit)
      ? "credit"
      : "debit";

  return {
    statementId,
    date: date,
    description: transaction.Description,
    amount: amount,
    category: transaction.Category || "uncategorized",
    type: type,
    balance: balance,
    bank: transaction.Bank || "unknown",
    entity: transaction.Entity || "unknown",
  };
};

const isDuplicateTransaction = async (transaction, statementId) => {
  const existing = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.statementId, statementId),
        eq(transactions.date, transaction.date),
        eq(transactions.amount, transaction.amount),
        eq(transactions.description, transaction.description)
      )
    );
  return existing.length > 0;
};

const storeTransactionsBatch = async (transformedTransactions) => {
  try {
    if (transformedTransactions.length === 0) return;

    const uniqueTransactions = [];
    for (const t of transformedTransactions) {
      const isDuplicate = await isDuplicateTransaction(t, t.statementId);
      if (!isDuplicate) {
        uniqueTransactions.push({
          statementId: t.statementId.toString(),
          date: t.date,
          description: t.description,
          amount: t.amount,
          category: t.category,
          type: t.type,
          balance: t.balance,
          bank: t.bank,
          entity: t.entity,
        });
      } else {
        log.info(
          Skipping duplicate transaction: ${t.description} on ${t.date}
        );
      }
    }

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
        Statement ${uniqueTransactions[0].statementId} not found
      );
    }

    const chunkSize = 50;
    console.log("Unique Transactions : ", uniqueTransactions.length);
    for (let i = 0; i < uniqueTransactions.length; i += chunkSize) {
      const chunk = uniqueTransactions.slice(i, i + chunkSize);
      await db.insert(transactions).values(chunk);
      log.info(
        Stored transactions batch ${i / chunkSize + 1}, size: ${chunk.length}
      );
    }

    return true;
  } catch (error) {
    log.error("Error storing transactions batch:", error);
    throw error;
  }
};

const getOrCreateCase = async (caseName, userId = 1) => {
  try {
    // First try to find existing case with exact match on name
    const existingCase = await db
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.name, caseName)
          // eq(cases.userId, userId),
          // eq(cases.status, "active")
        )
      )
      .limit(1);

    if (existingCase.length > 0) {
      log.info(
        Found existing case with ID: ${(existingCase[0].id, caseName)}
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
      log.info(Created new case with ID: ${(newCase[0].id, caseName)});
      log.info(Case id: ${newCase[0].id});
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
//       log.info(Found existing case with ID: ${existingCase[0].id});
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
//       log.info(Created new case with ID: ${newCase[0].id});
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
  transactions_temp, // renamed cuz we had a schema as transactions
  eodData,
  caseName,
  nerResults,
  fileIndex
) => {
  try {
    const validCaseId = await getOrCreateCase(caseName);
    let statementId = null;
    let processedTransactions = 0;

    // Get NER results for this file using passed fileIndex
    const customerName = nerResults?.Name?.[fileIndex] || "UNKNOWN";
    const accountNumber = nerResults?.["Acc Number"]?.[fileIndex] || "UNKNOWN";

    // First validate all transactions before creating the statement
    const statementTransactions = transactions_temp
      .filter((t) => t.Bank === fileDetail.bankName)
      .map((transaction) => {
        try {
          return validateAndTransformTransaction(transaction, null); // Pass null for statementId initially
        } catch (error) {
          log.warn(
            Invalid transaction found during validation: ${error.message},
            transaction
          );
          return null;
        }
      })
      .filter(Boolean);

    // If no valid transactions found, throw error
    if (statementTransactions.length === 0) {
      throw new Error("No valid transactions found for statement");
    }

    // Process Statement and Transactions
    try {
      const statementData = {
        caseId: validCaseId,
        accountNumber: accountNumber,
        customerName: customerName,
        ifscCode: fileDetail.ifscCode || null,
        bankName: fileDetail.bankName,
        filePath: fileDetail.pdf_paths,
        createdAt: new Date(),
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
      // Now update transactions with the new statementId and store them
      const finalTransactions = statementTransactions.map((transaction) => ({
        ...transaction,
        statementId,
      }));
      await storeTransactionsBatch(finalTransactions);
      processedTransactions = finalTransactions.length;
    } catch (error) {
      log.error("Error processing statement and transactions:", error);
      throw error;
    }

    // Process EOD data if available
    if (eodData && Array.isArray(eodData)) {
      try {
        // Check if EOD data already exists for this case
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
  try {
    const validCaseId = await getOrCreateCase(caseName);

    log.info({ parsedDataFromProcessSummary: parsedData });

    // Validate the summary data
    if (
      !parsedData ||
      typeof parsedData !== "object" ||
      // !parsedData["Particulars"] ||
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
      // log.info(Updated Data:,summaryData);
    } else {
      // Insert new summary record
      await db.insert(summary).values({
        caseId: validCaseId,
        data: JSON.stringify(summaryData),
        createdAt: new Date(),
      });
    }

    log.info(Summary data processed for case ${validCaseId});
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

    log.info(Updated case ${caseId} status to ${status});
  } catch (error) {
    log.error(Failed to update case ${caseId} status to ${status}:, error);
    throw error;
  }
};

const processOpportunityToEarnData = async (
  opportunityToEarnData,
  caseName
) => {
  log.info("Processing opportunity to earn data for case:", caseName);
  try {
    console.log(
      "Full Opportunity to Earn Data:",
      JSON.stringify(opportunityToEarnData)
    );

    // Extract the array from the object
    const opportunityToEarnArray = Array.isArray(opportunityToEarnData)
      ? opportunityToEarnData
      : opportunityToEarnData["Opportunity to Earn"];

    if (!opportunityToEarnArray || opportunityToEarnArray.length === 0) {
      log.warn("No Opportunity to Earn data found");
      return false;
    }

    // Get the case ID for this specific report
    const validCaseId = await getOrCreateCase(caseName);

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

    log.info(New opportunity to earn data appended for case ${validCaseId});
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
            // rename type -> column_type; default to null if it's missing
            column_type: col.type ?? null,
            // remove the old type field if needed
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
          // rename type -> transaction_type
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

  // 4) Ensure ca_id is a string if that’s what FastAPI expects
  if (payload.ca_id != null) {
    payload.ca_id = String(payload.ca_id);
  }

  return payload;
}

function generateReportIpc(tmpdir_path) {
  const baseUrl = http://localhost:7500;
  const generateReportEndpoint = ${baseUrl}/analyze-statements/;
  const editPdfEndpoint = ${baseUrl}/column-rectify-add-pdf/;
  // const client = axios.create({ socketPath: udsPath, baseURL: 'http://unix' });
  // const payload = {
  //   bank_names: ["ICICI", "HDFC"],
  //   pdf_paths: ['/home/Downloads/ICICI.pdf', '/home/Downloads/HDFC.pdf'],
  //   passwords: ["1234", "1234"],
  //   start_date: ["2023-01-01", "2023-01-01"],
  //   end_date: ["2023-12-31", "2023-12-31"],
  //   ca_id: "DEFAULT_CASE",
  // };
  // const client = new axios.Axios({ socketPath: unix://${udsPath}, baseURL: 'http://localhost' });
  // console.log("Client : ", client);
  // client.post("/", 'test', {
  //   headers: { "Content-Type": "application/json" },
  //   timeout: 300000,
  // }).then((res) => {
  //   console.log(res.status);
  //   console.log(res.data);
  // }).catch((err) => {
  //   console.error(err.response.data);
  //   console.error(err.message);
  //   console.error(err.response.data.detail[0].loc);
  // });
  ipcMain.handle("generate-report", async (event, receivedResult, caseName, source) => {

    const caseId = await getOrCreateCase(caseName);
    // Track file status
    const successfulFiles = new Set();
    const failedFiles = new Set();
    const allProcessedFiles = new Set();
    const uploadedFiles = new Map();
    let whole_transaction_sheet = null

    try {

      if (source == "add-pdf") {
        const allStatements = await db
          .select()
          .from(statements)
          .where(eq(statements.caseId, caseId));
        if (allStatements.length === 0) {
          log.info("No statements found for case:", caseId);
        }

        const allTransactions = await db
          .select()
          .from(transactions)
          .where(
            inArray(
              transactions.statementId,
              allStatements.map((stmt) => stmt.id.toString()) // Convert integer ID to string
            )
          );

        whole_transaction_sheet = allTransactions
      }

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
          throw new Error(Missing required fields for file at index ${index});
        }

        const originalFilename = fileDetail.pdf_paths;
        const tempFilename = ${Date.now()}-${path.basename(originalFilename)};
        const filePath = path.join(caseFolder, tempFilename);

        allProcessedFiles.add(filePath);
        uploadedFiles.set(filePath, {
          originalName: originalFilename,
          bankName: fileDetail.bankName,
        });

        console.log(Saving file to ${filePath});

        if (fileDetail.fileContent) {
          fs.writeFileSync(filePath, fileDetail.fileContent, "binary");
          successfulFiles.add(filePath); // Initially assume success
        } else {
          log.warn(No file content for ${fileDetail.bankName});
          failedFiles.add(filePath);
        }

        return {
          ...fileDetail,
          pdf_paths: filePath,
          start_date: fileDetail.start_date || "",
          end_date: fileDetail.end_date || "",
        };
      });

      // Step 2: Send API request
      const payload = {
        bank_names: fileDetails.map((d) => d.bankName),
        pdf_paths: fileDetails.map((d) => d.pdf_paths),
        passwords: fileDetails.map((d) => d.passwords || ""),
        start_date: fileDetails.map((d) => d.start_date || ""),
        end_date: fileDetails.map((d) => d.end_date || ""),
        ca_id: caseName || "DEFAULT_CASE",
        whole_transaction_sheet: whole_transaction_sheet,
      };

      log.info("Sending API request with payload:", payload);

      const response = await axios.post(generateReportEndpoint, payload, {
        headers: { "Content-Type": "application/json" },
        // timeout: 300000,
        validateStatus: (status) => status === 200,
      });

      log.info("API response received:", response.data);


      // Step 3: Handle failed extractions
      if (response.data?.["pdf_paths_not_extracted"]) {
        const failedPdfPaths =
          response.data["pdf_paths_not_extracted"].paths || [];

        log.info({ caseId, failedPdfPaths })

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
            failedFiles.add(fullPath);
            successfulFiles.delete(fullPath);
          }
        }

        log.warn("Some PDF paths were not extracted", Array.from(failedFiles));
      }

      // Step 4: Process transactions
      const parsedData = JSON.parse(sanitizeJSONString(response.data.data));
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
            failedStatements: response.data["pdf_paths_not_extracted"] || null,
            failedFiles: Array.from(failedFiles),
            successfulFiles: Array.from(successfulFiles),
            nerResults: response.data?.ner_results || {
              Name: [],
              "Acc Number": [],
            },
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
          if (typeof transaction.Debit === "number" && isNaN(transaction.Debit))
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

      // Step 5: Process each file
      const processedData = [];
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

          if (!failedFiles.has(fileDetail.pdf_paths)) {
            successfulFiles.add(fileDetail.pdf_paths);
          }
        } catch (error) {
          failedFiles.add(fileDetail.pdf_paths);
          successfulFiles.delete(fileDetail.pdf_paths);
          log.error(
            Error processing file detail for ${fileDetail.bankName}:,
            error
          );
        }
      }

      // Step 6: Process summary and earnings
      try {
        await processSummaryData(
          {
            Particulars: parsedData["Particulars"] || [],
            "Income Receipts": parsedData["Income Receipts"] || [],
            "Important Expenses": parsedData["Important Expenses"] || [],
            "Other Expenses": parsedData["Other Expenses"] || [],
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
      for (const filePath of allProcessedFiles) {
        try {
          if (fs.existsSync(filePath)) {
            if (failedFiles.has(filePath)) {
              log.info(Failed PDF retained: ${filePath});
            } else if (successfulFiles.has(filePath)) {
              fs.unlinkSync(filePath);
              log.info(Successfully deleted processed file: ${filePath});
            }
          }
        } catch (error) {
          log.error(Error handling file ${filePath}:, error);
        }
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
      };
    }
  });

  ipcMain.handle("edit-pdf", async (event, result, caseName) => {
    log.info("IPC handler invoked for edit-pdf", caseName);
    const tempDir = tmpdir_path;
    log.info("Temp Directory : ", tempDir);
    let caseId = null;
    console.log("CaseName backend edit pdf: ", caseName);
    console.log("Result backend edit pdf: ", result);

    // Track successfully processed files to avoid deleting them
    const successfulFiles = [];
    const failedFiles = [];

    console.log("Result: ", result);
    try {
      caseId = await getOrCreateCase(caseName);

      const allStatements = await db
        .select()
        .from(statements)
        .where(eq(statements.caseId, caseId));
      if (allStatements.length === 0) {
        log.info("No statements found for case:", caseId);
      }

      const allTransactions = await db
        .select()
        .from(transactions)
        .where(
          inArray(
            transactions.statementId,
            allStatements.map((stmt) => stmt.id.toString()) // Convert integer ID to string
          )
        );

      const whole_transaction_sheet = allTransactions || null;
      // log.info("Whole Transaction Sheet: ",whole_transaction_sheet.length);

      const payload = {
        bank_names: result.map((d) => d.bankName),
        pdf_paths: result.map((d) => d.path),
        passwords: result.map((d) => d.passwords || ""),
        start_dates: result.map((d) => d.startDate || ""),
        end_dates: result.map((d) => d.endDate || ""),
        ca_id: caseId || "DEFAULT_CASE",
        aiyazs_array_of_array: result.map((d) => d.rectifiedColumns || ""),
        whole_transaction_sheet: whole_transaction_sheet,
        // whole_transaction_sheet:result.map((d) => d.whole_transaction_sheet || ""),
      };

      const finalPayload = preprocessPayload(payload);

      log.info("finalPayload: ", finalPayload);
      log.info("editPdfEndpoint: ", editPdfEndpoint);
      const response = await axios.post(editPdfEndpoint, finalPayload, {
        headers: { "Content-Type": "application/json" },
        // timeout: 300000,
        validateStatus: (status) => status === 200,
      });

      log.info("Response from fastapi: ", response.data);

      let failedPdfPaths = [];

      // Check if there are any PDF paths not extracted
      if (response.data?.["pdf_paths_not_extracted"]?.paths?.length > 0) {
        await updateCaseStatus(caseId, "Failed");
        // Get the case ID
        const validCaseId = await getOrCreateCase(caseName);

        // Store failed statements in the database
        await db.insert(failedStatements).values({
          caseId: validCaseId,
          data: JSON.stringify(response.data["pdf_paths_not_extracted"]),
        });

        // Track failed PDF paths
        failedPdfPaths = response.data["pdf_paths_not_extracted"].paths || [];
        log.warn("Some PDF paths were not extracted", failedPdfPaths);
      }

      // Continue processing if data exists
      if (!response.data || !response.data.data) {
        throw new Error(
          "Empty or invalid response received from analysis server"
        );
      }

      let parsedData;
      try {
        const sanitizedJsonString = sanitizeJSONString(response.data.data);
        parsedData = JSON.parse(sanitizedJsonString);
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

      log.info("transactions_temp ", transactions_temp.length)

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

      log.info({ exampleTrnsaction: transactions_temp[0] })
      log.info({ exampleFileDetails: fileDetails })

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
            Error processing file detail for ${fileDetail.bankName}:,
            error
          );
          throw error;
        }
      }

      // Process Summary Data
      try {
        await processSummaryData(
          {
            "Income Receipts": parsedData["Income Receipts"] || [],
            "Important Expenses": parsedData["Important Expenses"] || [],
            "Other Expenses": parsedData["Other Expenses"] || [],
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
      fileDetails.forEach((detail) => {
        try {
          if (fs.existsSync(detail.pdf_paths)) {
            fs.unlinkSync(detail.pdf_paths);
          }
        } catch (error) {
          log.warn(Failed to cleanup temp file: ${detail.pdf_paths}, error);
        }
      });
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