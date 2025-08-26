import os
import uvicorn
import logging
from fastapi import FastAPI, HTTPException,Request
from pydantic import BaseModel
from typing import List,Dict,Any, Optional
from fastapi.responses import HTMLResponse
from fastapi import Body
import pandas as pd
# import matplotlib
# matplotlib.use('Agg')
# from findaddy.exceptions import ExtractionError
from backend.utils import get_saved_pdf_dir
TEMP_SAVED_PDF_DIR = get_saved_pdf_dir()
from pydantic import Field
# If you have other custom imports:
from backend.tax_professional.banks.CA_Statement_Analyzer import start_extraction_add_pdf, refresh_category_all_sheets, save_to_excel,individual_summary,process_extraction_add_edit
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from backend.account_number_ifsc_extraction import extract_accno_ifsc
from backend.pdf_to_name import extract_entities
import time
from backend.common_functions import Bl_eligibility_bankwise,get_latest_month_emis,build_home_capacity_base,build_Lap_capacity_base,eod,calculate_fixed_day_average
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Bank Statement Analyzer API")
logger.info(f"Temp directory python : {TEMP_SAVED_PDF_DIR}")



class Transaction(BaseModel):
    id: int
    statementId:  Optional[str] = None
    date:  Optional[str] = None
    description:  Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    transaction_type: Optional[str] = None     
    balance: Optional[float] = None
    bank: Optional[str] = None
    entity: Optional[str] = None

class Bounds(BaseModel):
    start: float
    end: float

class ColumnData(BaseModel):
    index: int
    bounds: Bounds
    column_type:  Optional[str] = Field(None, alias="type")

class OdDateLimitData(BaseModel):
    start_date:str
    limit:  str

class DodDetails(BaseModel):
    frequency:str
    amount:str
    percentage:str
    limit_dod:str
    loan_commencement_date:str
    is_incremental:bool
    current_limit:str


class pdfData(BaseModel):
    pdf_path: str
    file_counter: int
    aiyaz_q_array_of_array: Optional[List[ColumnData]] = None

class AccountData(BaseModel):
    bank_name :Optional[str] = "Other"
    password: Optional[str] = None
    account_number: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    pdfs: List[pdfData]
    od_start_dates_and_limits: List[OdDateLimitData] = None
    dod_details: DodDetails = None

class BankStatementRequest(BaseModel):
    accounts: dict[str, AccountData]
    ca_id: int
    whole_transaction_sheet: Optional[List[dict]] = None
    categoryMasterData: List[dict]

class EditPdfRequest(BaseModel):
    bank_names: List[str]
    pdf_paths: List[str]
    passwords: Optional[List[str]] = []  # Optional field, defaults to empty list
    start_dates: List[str]
    end_dates: List[str]
    aiyazs_array_of_array: List[List[ColumnData]]
    whole_transaction_sheet: Optional[List[Transaction]] = None
    ca_id: str

class BankStatementRequestOld(BaseModel):
    bank_name: List[str]
    pdf_paths: List[str]
    passwords: Optional[List[str]] = []  # Optional field, defaults to empty list
    start_date: List[str]
    end_date: List[str]
    account_type: List[int]
    account_number: List[str]
    ca_id: str
    whole_transaction_sheet: Optional[List[dict]] = None
    aiyazs_array_of_array: Optional[List[List[ColumnData]]]=None
    categoryMasterData: List[dict]
    
class EditCategoryRequest(BaseModel):
    transaction_data: List[dict]
    new_categories: List[dict]
    eod_data: List[dict]
    categoryMasterData: List[dict]


class ExcelDownloadRequest(BaseModel):
    transaction_data: List[dict]
    name_n_num: List[dict]
    case_name: str

class DummyRequest(BaseModel):
    data: str

class InvididualSummaryRequest(BaseModel):
    transactions_data:  List[dict]
    categoryMasterData: List[dict]


class EligibilityRequest(BaseModel):
    trans: List[Dict[str, Any]]
    emiList: List[Dict[str, Any]]
    eligibilityMaster: List[Dict[str, Any]]
    # eodData: List[Dict[str, Any]]

class IndividualDWABRequest(BaseModel):
    trans: List[Dict[str, Any]]
    # eodData: List[Dict[str, Any]]


class EmiRequest(BaseModel):
    emiList : List[Dict[str, Any]]

# class Transaction(BaseModel):
#     id: int
#     statementId: str
#     date: str
#     description: str
#     amount: float
#     category: str
#     type: str
#     balance: float
#     bank: str
#     entity: str
#     voucher_type: str
#     createdAt: str

# class EligibilityRequest(BaseModel):
#     emi_list: List[EmiItem]
#     bl_eligibility_master: List[BLEligibilityMasterItem]
#     eod_data: List[Dict[str, Any]]
#     transactions: List[Dict[str, Any]]

@app.get("/", response_class=HTMLResponse)
async def root():
    return "<h1>Yes, I am alive!</h1>"

@app.post("/")
async def root(data: str = Body(...)):
    print("Received data in root : ", data)
    return {"message": "Bank Statement Analyzer API"}

@app.post("/analyze-statements/")
async def analyze_bank_statements(request: BankStatementRequest):
    try:
        start_total = time.time()
        logger.info(f"Received request with banks: {request.accounts}")

        # Create a progress tracking function
        def progress_tracker(current: int, total: int, info: str) -> None:
            logger.info(f"{info} ({current}/{total})")

        progress_data = {
            "progress_func": progress_tracker,
            "current_progress": 10,
            "total_progress": 100,
        }

        logger.info("Initializing CABankStatement")
        # Pass empty list if no passwords


        accounts_input = request.accounts
        raw_accounts = { name: acct.dict() for name, acct in accounts_input.items() }
        logger.info("raw_accounts  aq  -  = %s",raw_accounts )
        pdf_paths = [pdf.pdf_path for account in accounts_input.values() for pdf in account.pdfs]

        CA_ID = request.ca_id
        progress_data = progress_data
        category_master_data = request.categoryMasterData
        category_master_data_df = pd.DataFrame(category_master_data)
        category_master_data_df.columns = [col.capitalize() for col in category_master_data_df.columns]
        category_master_data_df.rename(columns={"Debit_credit": "Debit / Credit"}, inplace=True)
        print("category_master_data", category_master_data_df.head())


        ner_results = {
                "Name": [],
                "Acc Number": []
            }

        # Process PDFs with NER
        start_ner = time.time()
        person_count = 0
        for pdf in pdf_paths:
            person_count+=1
            # result = pdf_to_name_and_accno(pdf)
            fetched_name = None
            fetched_acc_num = None

            name_entities = extract_entities(pdf)
            acc_number_ifsc = extract_accno_ifsc(pdf)

            print("name_entities:- ",name_entities)

            fetched_acc_num=acc_number_ifsc["acc"]

            if name_entities:
                for entity in name_entities:
                    if fetched_name==None:
                        fetched_name=entity

            if fetched_name:
                ner_results["Name"].append(fetched_name)
            else:
                ner_results["Name"].append(f"Statement {person_count}")
                
            if fetched_acc_num:
                ner_results["Acc Number"].append(fetched_acc_num)
            else:
                ner_results["Acc Number"].append("XXXXXXXXXXX")
        print("Ner results", ner_results)
        end_ner = time.time()
        print("Time taken to process NER", end_ner-start_ner)
        

        start_extraction = time.time()
        logger.info("Starting extraction")
        whole_transaction_sheet = request.whole_transaction_sheet or None

        if whole_transaction_sheet is not None:
            logger.info("whole_transaction_sheet is not None")
            whole_transaction_sheet = pd.DataFrame(whole_transaction_sheet)
            print("whole_transaction_sheet", whole_transaction_sheet.head())
            whole_transaction_sheet["Value Date"] = pd.to_datetime(whole_transaction_sheet["Value Date"], format="%d-%m-%Y")


        logger.info("1111111")
        result = process_extraction_add_edit(raw_accounts , CA_ID, progress_data,category_master_data_df, whole_transaction_sheet)        
        logger.info("2222222222")
        
        end_extraction = time.time()
        end_total = time.time()
        total_time = end_total - start_total

        print("Time taken for extraction:", end_extraction-start_extraction, "seconds")

        print("RESULT GENERATED")
        logger.info("Extraction completed successfully")
        # logger.info("Result = ", result)
        return {
            "status": "success",
            "message": "Bank statements analyzed successfully",
            "data": result["sheets_in_json"],
            "pdf_paths_not_extracted": result["pdf_paths_not_extracted"],
            "ner_results": ner_results, 
            "success_page_number": result["success_page_number"],
            "missing_months_list":result["missing_months_list"],
            "processing_times": {
                "ner_processing": end_ner - start_ner,
                "extraction": end_extraction - start_extraction,
                "total": total_time
            }
        }
    

    except Exception as e:
        print(e)
        logger.error(f"Error processing bank statements: {str(e)}")
        return {
            "status": "failed",
            "message": str(e),
        }
        # raise HTTPException(
        #     status_code=500, detail=f"Error processing bank statements: {str(e)}"
        # )
    


@app.post("/refresh/")
async def refresh(request: BankStatementRequest):
    pass


@app.post("/add-pdf/")
async def add_pdf(request: BankStatementRequest):
    pass


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/edit-category/")
async def edit_category(request: EditCategoryRequest):
    try:
        transaction_data = request.transaction_data
        new_categories = request.new_categories
        eod_data = request.eod_data
        category_master_data = request.categoryMasterData
        category_master_data_df = pd.DataFrame(category_master_data)
        category_master_data_df.columns = [col.capitalize() for col in category_master_data_df.columns]
        category_master_data_df.rename(columns={"Debit_credit": "Debit / Credit"}, inplace=True)


        print("New Categories : ", new_categories)
        print("Transaction Data : ", transaction_data)
        print("EOD Data : ", eod_data)
        logger.info(f"Received request with new categories: {new_categories}")
        logger.info(f"Received request with transaction data: {transaction_data[0]}")
        logger.info(f"Received request with eod data: {eod_data}")

        # convert transaction_data to df
        transaction_df = pd.DataFrame(transaction_data)
        print("Transactions : ", transaction_df.head())
        transaction_df["Value Date"] = pd.to_datetime(transaction_df["Value Date"], format="%d-%m-%Y")
        eod_df = pd.DataFrame(eod_data)
        print("Transactions : ", transaction_df.head())
        # print(eod_df.head())
        print("new categories : ", new_categories)

        data = refresh_category_all_sheets(transaction_df, eod_df, new_categories,category_master_data_df)
        # print(data)

        return data

    except Exception as e:
        logger.error(f"Error processing bank statements: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing bank statements: {str(e)}"
        )



@app.post("/excel-download/")
async def excel_download(request: ExcelDownloadRequest):
    try:
        transaction_data = request.transaction_data
        case_name = request.case_name
        name_n_num_data = request.name_n_num
        logger.info(f"Received request with transaction data: {transaction_data[0]}")
        logger.info(f"Received request with case name: {case_name}")

        # convert transaction_data to df
        transaction_df = pd.DataFrame(transaction_data)
        name_n_num_df = pd.DataFrame(name_n_num_data)
        
        print("Transactions : \n", transaction_df.head())
        print("Name and Number : \n", name_n_num_df.head())

        file_path = save_to_excel(transaction_df, name_n_num_df, case_name)
        print("Python data : ", file_path)

        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404, detail="Something went wrong while generating the file"
            )
    
        return file_path
    except Exception as e:
        logger.error(f"Error processing bank statements: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"{str(e)}"
        )

@app.post("/individual-summary/")
async def individual_summary_api(request: InvididualSummaryRequest):
    try:
        logger.info(f"Received request with data: {request.transactions_data}")
        print("category master data : ", request.categoryMasterData)

        transaction_df = pd.DataFrame(request.transactions_data)
        transaction_df["Value Date"] = pd.to_datetime(transaction_df["Value Date"], format="%d-%m-%Y")
        category_master_data = request.categoryMasterData
        category_master_data_df = pd.DataFrame(category_master_data)
        category_master_data_df.columns = [col.capitalize() for col in category_master_data_df.columns]
        category_master_data_df.rename(columns={"Debit_credit": "Debit / Credit"}, inplace=True)


        print(transaction_df.head(10))
        data = individual_summary(transaction_df,category_master_data_df)
        print(data)

        return data

    except Exception as e:
        print(e)
        logger.error(f"Error processing bank statements: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing bank statements: {str(e)}"
        )
    
@app.post("/get-latest-emis")
async def get_latest_emis(request: EmiRequest):
    try:
        emiList  = request.emiList or []

        print("emiList ",emiList)

        if not emiList:
           return {
               "status":  "success",
               "message": "No EMI data available",
               "data":    [],
           }
        emi_df = pd.DataFrame(emiList)
        emi_df['Value Date'] = pd.to_datetime(emi_df['Value Date'], utc=True, errors='coerce')

        print("Emi Data : ", emi_df.head())

        result = get_latest_month_emis(emi_df)
        print("Latest Emi Data : ", result.head())
        # data = emi_df.groupby(["Bank", "Entity"]).agg({"Value Date": "max"}).reset_index()
        # print("Latest Emi Data : ", data.head())

        return {
            "status": "success",
            "message": "Latest EMIs fetched successfully",
            "data": result.to_dict(orient="records"),  # Convert to JSON string
        }


    except Exception as e:
        logger.error(f"Error processing bank statements: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing bank statements: {str(e)}"
        )


@app.post("/all-eligibility/")
async def calculate_all_eligibility(request: EligibilityRequest):
    try:
        logger.info("Received Eligibility calculation request")
        
        # Extract data from request
        trans = request.trans
        emi_data = request.emiList
        eligibility_master = request.eligibilityMaster

        trans_df = pd.DataFrame(trans)
        emi_data_df = pd.DataFrame(emi_data)
        eligibility_master_df = pd.DataFrame(eligibility_master)
     
        
        print(f"Transactions data: ",trans_df.head())
        print(f"EMI data:", emi_data_df.head())
        print(f"Eligibility data:",eligibility_master_df.head())
  

        bl_master = eligibility_master_df[eligibility_master_df["productType"] == "bl"]
        hl_master = eligibility_master_df[eligibility_master_df["productType"] == "hl"]
        lap_master = eligibility_master_df[eligibility_master_df["productType"] == "lap"]
                
        # Call the existing function to process the data
        bl_result = Bl_eligibility_bankwise(trans_df, emi_data_df, bl_master)
        print("bl_result ", bl_result.head())
        hl_result = build_home_capacity_base(emi_data_df,hl_master,trans_df)
        print("hl_result ", hl_result.head())

        lap_result = build_Lap_capacity_base(emi_data_df,lap_master,trans_df)
        print("lap_result ", lap_result.head())
        
            # convert to plain lists
        bl_list  = bl_result.to_dict(orient="records")
        hl_list  = hl_result.to_dict(orient="records")
        lap_list = lap_result.to_dict(orient="records")
        

        
        logger.info("BL Eligibility calculation completed successfully")

        
        return {
            "status": "success",
            "message": "BL Eligibility calculated successfully",
            "data": json.dumps({
                        "bl":  bl_list,
                        "hl":  hl_list,
                        "lap": lap_list,
                    }        , default=str)
            }
    
    except Exception as e:
        logger.info(e)
        logger.error(f"Error calculating BL Eligibility: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error calculating BL Eligibility: {e}"
        )
    
@app.post("/individual-daily-average-balance/")
async def individual_daily_average_balance(request: IndividualDWABRequest):
    try:
        logger.info("Received Individual Daily Average Balance calculation request")
        
        # Extract data from request
        trans = request.trans
        trans_df = pd.DataFrame(trans)

        eod_df = eod(trans_df)
        print("EOD Data : ", eod_df.head())
        date_wise_avg_balance = calculate_fixed_day_average(eod_df)
        print("Date wise average balance : ", date_wise_avg_balance.head())

        return {
            "status": "success",
            "message": "Individual Daily Average Balance calculated successfully",
            "data": date_wise_avg_balance.to_dict(orient="records"),  # Convert to JSON string
        }
    

    except Exception as e:
        logger.info(e)
        logger.error(f"Error calculating Individual Daily Average Balance: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error calculating Individual Daily Average Balance: {e}"
        )   
    

     

if __name__ == "__main__":
    # Optionally use environment variables for host/port. Falls back to "127.0.0.1" and 7500 if none provided.
    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "7500"))

    # uds_path = "/tmp/bank_statement_analyzer.sock"

    # Clean up any old socket
    # if os.path.exists(uds_path):
        # os.remove(uds_path)

    # Start the FastAPI server on the Unix socket
    # uvicorn.run("main:app", uds=uds_path, log_level="info", reload=False)


    # IMPORTANT: reload=False for production usage
    # import time
    # time.sleep(8)
    uvicorn.run(app, host=host, port=port, reload=False)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("Validation Error:", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )
