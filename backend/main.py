import sys
import io
import os
import logging

logger = logging.getLogger(__name__)

# Respect the PYTHONIOENCODING env if set, or fallback to utf-8
preferred_encoding = os.environ.get("PYTHONIOENCODING", "utf-8")
# Force stdout/stderr to use UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding=preferred_encoding)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding=preferred_encoding)


import uvicorn
import logging
from fastapi import FastAPI, HTTPException,Request
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import HTMLResponse
from fastapi import Body
import pandas as pd
# import matplotlib
# matplotlib.use('Agg')
# from findaddy.exceptions import ExtractionError
from backend.utils import get_saved_pdf_dir, cleanup_temp_files
TEMP_SAVED_PDF_DIR = get_saved_pdf_dir()
from pydantic import Field
# If you have other custom imports:
from backend.tax_professional.banks.CA_Statement_Analyzer import start_extraction_add_pdf, refresh_category_all_sheets, save_to_excel,individual_summary
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
# from backend.account_number_ifsc_extraction import extract_accno_ifsc
# from backend.pdf_to_name import extract_entities
import time
import platform
import psutil

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Bank Statement Analyzer API")
logger.info(f"Temp directory python : {TEMP_SAVED_PDF_DIR}")


logger.info(f"Encoding In Python: {sys.stdout.encoding}")
logger.info(f"stderr encoding: {sys.stderr.encoding}")


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
    


class EditPdfRequest(BaseModel):
    bank_names: List[str]
    pdf_paths: List[str]
    passwords: Optional[List[str]] = []  # Optional field, defaults to empty list
    start_dates: List[str]
    end_dates: List[str]
    aiyazs_array_of_array: List[List[ColumnData]]
    whole_transaction_sheet: Optional[List[Transaction]] = None
    ca_id: str

class BankStatementRequest(BaseModel):
    bank_names: List[str]
    pdf_paths: List[str]
    passwords: Optional[List[str]] = []  # Optional field, defaults to empty list
    start_date: List[str]
    end_date: List[str]
    ca_id: str
    whole_transaction_sheet: Optional[List[dict]] = None
    aiyazs_array_of_array: Optional[List[List[ColumnData]]]=None
    is_ocr: List[bool]
    categoryMasterData: Optional[List[dict]] = None

    
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


@app.get("/", response_class=HTMLResponse)
async def root():
    return "<h1>Yes, I am alive!</h1>"

@app.post("/")
async def root(data: str = Body(...)):
    logger.info(f"Received data in root : {data}")
    return {"message": "Bank Statement Analyzer API"}

from fastapi import UploadFile, File, Form
from typing import Annotated
import shutil
import json

@app.post("/analyze-statements-pdf/")
async def analyze_bank_statements_pdf(
    bank_names: Annotated[List[str], Form()],
    passwords: Annotated[Optional[List[str]], Form()] = [],
    start_date: Annotated[List[str], Form()] = [],
    end_date: Annotated[List[str], Form()] = [],
    ca_id: Annotated[str, Form()] = "",
    is_ocr: Annotated[List[str], Form()] = [],
    files: List[UploadFile] = File(...),
    whole_transaction_sheet: Annotated[Optional[str], Form()] = None,
    aiyazs_array_of_array: Annotated[Optional[str], Form()] = None,
    categoryMasterData: Annotated[Optional[str], Form()] = None
):
    
    pdf_paths = []
    try:
        for pdf_file in files:
            file_path = os.path.join(TEMP_SAVED_PDF_DIR, pdf_file.filename)
            logger.info(f"file_path: {file_path}")
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(pdf_file.file, buffer)
            pdf_paths.append(file_path)

        is_ocr_bool = [val.lower() == 'true' for val in is_ocr]

        whole_transaction_sheet_data = None
        if whole_transaction_sheet:
            whole_transaction_sheet_data = json.loads(whole_transaction_sheet)
            
        aiyazs_array_of_array_data = None
        if aiyazs_array_of_array:
            aiyazs_array_of_array_data = json.loads(aiyazs_array_of_array)

        categoryMasterData_data = None
        if categoryMasterData:
            categoryMasterData_data = json.loads(categoryMasterData)

        request_data = {
            "bank_names": bank_names,
            "pdf_paths": pdf_paths,
            "passwords": passwords,
            "start_date": start_date,
            "end_date": end_date,
            "ca_id": ca_id,
            "is_ocr": is_ocr_bool,
            "whole_transaction_sheet": whole_transaction_sheet_data,
            "aiyazs_array_of_array": aiyazs_array_of_array_data,
            "categoryMasterData": categoryMasterData_data
        }
        
        request = BankStatementRequest(**request_data)
        return await analyze_bank_statements(request)
    finally:
        # Clean up the saved PDF files
        for path in pdf_paths:
            try:
                os.remove(path)
                logger.info(f"Successfully deleted temporary file: {path}")
            except OSError as e:
                logger.error(f"Error deleting file {path}: {e.strerror}")
        
        # Clean up all temporary files for this ca_id
        cleanup_temp_files(ca_id)

@app.post("/analyze-statements/")
async def analyze_bank_statements(request: BankStatementRequest):
    try:

        start_total = time.time()

        logger.info(f"Received request with banks: {request.bank_names}")
        logger.info(f"Start Date : {request.start_date}")
        logger.info(f"End Date : {request.end_date}")
        logger.info(f"PDF Paths : {request.pdf_paths}")

        # Create a progress tracking function
        def progress_tracker(current: int, total: int, info: str) -> None:
            logger.info(f"{info} ({current}/{total})")

        progress_data = {
            "progress_func": progress_tracker,
            "current_progress": 10,
            "total_progress": 100,
        }

        # Validate passwords length if provided
        if request.passwords and len(request.passwords) != len(request.pdf_paths):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Number of passwords ({len(request.passwords)}) "
                    f"must match number of PDFs ({len(request.pdf_paths)})"
                ),
            )

        logger.info("Initializing CABankStatement")
        # Pass empty list if no passwords

        bank_names = request.bank_names 
        pdf_paths = request.pdf_paths
        passwords =  request.passwords if request.passwords else []
        start_date = request.start_date if request.start_date else []
        end_date = request.end_date if request.end_date else []
        CA_ID = request.ca_id
        progress_data = progress_data
        
        category_master_data = request.categoryMasterData
        category_master_data_df = pd.DataFrame(category_master_data)
        category_master_data_df.columns = [col.capitalize() for col in category_master_data_df.columns]
        category_master_data_df.rename(columns={"Debit_credit": "Debit / Credit"}, inplace=True)
        logger.info(f"category_master_data: {category_master_data_df.head()}")

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

            # name_entities = extract_entities(pdf)
            # acc_number_ifsc = extract_accno_ifsc(pdf)

            # logger.info(f"name_entities:- {name_entities}")

            # fetched_acc_num=acc_number_ifsc["acc"]

            # if name_entities:
            #     for entity in name_entities:
            #         if fetched_name==None:
            #             fetched_name=entity

            # if fetched_name:
            #     ner_results["Name"].append(fetched_name)
            # else:
            ner_results["Name"].append(f"Statement {person_count}")
                
            # if fetched_acc_num:
            #     ner_results["Acc Number"].append(fetched_acc_num)
            # else:
            ner_results["Acc Number"].append("XXXXXXXXXXX")
            
        logger.info(f"Ner results: {ner_results}")
        end_ner = time.time()
        logger.info(f"Time taken to process NER: {end_ner-start_ner}")
        

        start_extraction = time.time()

        logger.info("Starting extraction")
        whole_transaction_sheet = request.whole_transaction_sheet or None
        temp_aiyaz_array_of_array = []

        if(request.aiyazs_array_of_array):
            logger.info("aiyazs_array_of_array is not None")
            for statement in request.aiyazs_array_of_array:
                temp_aiyaz_array = []
                for col in statement:
                    temp_aiyaz_array.append(col.model_dump())
                temp_aiyaz_array_of_array.append(temp_aiyaz_array)

        if whole_transaction_sheet is not None:
            logger.info("whole_transaction_sheet is not None")
            whole_transaction_sheet = pd.DataFrame(whole_transaction_sheet)
            logger.info(f"whole_transaction_sheet: {whole_transaction_sheet.head()}")
            whole_transaction_sheet["Value Date"] = pd.to_datetime(whole_transaction_sheet["Value Date"], format="%d-%m-%Y")
        else:
            logger.info("whole_transaction_sheet is None")
            whole_transaction_sheet = None
            
        is_ocr = request.is_ocr
        result = start_extraction_add_pdf(bank_names, pdf_paths, passwords, start_date, end_date, CA_ID,category_master_data_df, progress_data,is_ocr,whole_transaction_sheet=whole_transaction_sheet,aiyazs_array_of_array=temp_aiyaz_array_of_array)
        
        end_extraction = time.time()
        end_total = time.time()
        total_time = end_total - start_total

        logger.info(f"Time taken for extraction: {end_extraction-start_extraction} seconds")

        logger.info("RESULT GENERATED")
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
        logger.error(e)
        logger.error(f"Error processing bank statements: {str(e)}")
        return {
            "status": "failed",
            "message": str(e),
        }
        # raise HTTPException(
        #     status_code=500, detail=f"Error processing bank statements: {str(e)}"
        # )
    


# @app.post("/column-rectify-add-pdf/")
# async def column_rectify_add_pdf(request:EditPdfRequest):
#     logger.info(f"Received request data: {request}")
#     try:

#         # # Create a progress tracking function
#         def progress_tracker(current: int, total: int, info: str) -> None:
#             logger.info(f"{info} ({current}/{total})")

#         progress_data = {
#         "progress_func": progress_tracker,
#         "current_progress": 10,
#         "total_progress": 100,
#         }

#         # Validate passwords length if provided
#         if request.passwords and len(request.passwords) != len(request.pdf_paths):
#             raise HTTPException(
#                 status_code=400,
#                 detail=(
#                     f"Number of passwords ({len(request.passwords)}) "
#                     f"must match number of PDFs ({len(request.pdf_paths)})"
#                 ),
#             )
        
#         temp_aiyaz_array_of_array = []
#         for statement in request.aiyazs_array_of_array:
#             temp_aiyaz_array = []
#             for col in statement:
#                 temp_aiyaz_array.append(col.model_dump())
#             temp_aiyaz_array_of_array.append(temp_aiyaz_array)


        
#         bank_names = request.bank_names 
#         pdf_paths = request.pdf_paths
#         passwords =  request.passwords if request.passwords else []
#         start_date = request.start_dates if request.start_dates else []
#         end_date = request.end_dates if request.end_dates else []
#         CA_ID = request.ca_id
#         progress_data = progress_data
#         aiyazs_array_of_array = temp_aiyaz_array_of_array
#         whole_transaction_sheet = request.whole_transaction_sheet


#         ner_results = {
#                 "Name": [],
#                 "Acc Number": []
#             }

#         # Process PDFs with NER
#         start_ner = time.time()
#         person_count = 0
#         for pdf in pdf_paths:
#             person_count+=1
#             # result = pdf_to_name_and_accno(pdf)
#             fetched_name = None
#             fetched_acc_num = None

#             name_entities = extract_entities(pdf)
#             acc_number_ifsc = extract_accno_ifsc(pdf)

#             logger.info(f"name_entities:- {name_entities}")

#             fetched_acc_num=acc_number_ifsc["acc"]

#             if name_entities:
#                 for entity in name_entities:
#                     if fetched_name==None:
#                         fetched_name=entity

#             if fetched_name:
#                 ner_results["Name"].append(fetched_name)
#             else:
#                 ner_results["Name"].append(f"Statement {person_count}")
                
#             if fetched_acc_num:
#                 ner_results["Acc Number"].append(fetched_acc_num)
#             else:
#                 ner_results["Acc Number"].append("XXXXXXXXXXX")
#         logger.info(f"Ner results: {ner_results}")
#         end_ner = time.time()
#         logger.info(f"Time taken to process NER: {end_ner-start_ner}")



#         logger.info("Starting extraction")
#         result = start_extraction_edit_pdf(bank_names=bank_names,pdf_paths= pdf_paths,passwords= passwords,start_dates= start_date,end_dates= end_date,CA_ID= CA_ID, progress_data=progress_data,aiyazs_array_of_array=aiyazs_array_of_array,whole_transaction_sheet=whole_transaction_sheet)

#         logger.info(f"RESULT GENERATED")
#         logger.info(f"Result = {result["sheets_in_json"]}")
#         logger.info(f"Result pdf_paths_not_extracted= {result["pdf_paths_not_extracted"]}")
#         logger.info("Extraction completed successfully")
#         return {
#             "status": "success",
#             "message": "Bank statements analyzed successfully",
#             "data": result["sheets_in_json"],
#             "pdf_paths_not_extracted": result["pdf_paths_not_extracted"],
#             "ner_results": ner_results, 
#         }

#     except Exception as e:

#         logger.error(e)
#         logger.error(f"Error processing bank statements: {str(e)}")
#         raise HTTPException(
#             status_code=500, detail=f"Error processing bank statements: {str(e)}"
#         )


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
        
        
        logger.info(f"New Categories : {new_categories}")
        logger.info(f"Transaction Data : {transaction_data}")
        logger.info(f"EOD Data : {eod_data}")
        logger.info(f"Received request with new categories: {new_categories}")
        logger.info(f"Received request with transaction data: {transaction_data[0]}")
        logger.info(f"Received request with eod data: {eod_data}")

        # convert transaction_data to df
        transaction_df = pd.DataFrame(transaction_data)
        logger.info(f"Transactions : {transaction_df.head()}")
        transaction_df["Value Date"] = pd.to_datetime(transaction_df["Value Date"], format="%d-%m-%Y")
        eod_df = pd.DataFrame(eod_data)
        logger.info(f"Transactions : {transaction_df.head()}")
        # logger.info(f"eod_df.head()
        logger.info(f"new categories : {new_categories}")

        data = refresh_category_all_sheets(transaction_df, eod_df, new_categories,category_master_data_df)
        logger.info(data)

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
        
        logger.info(f"Transactions : \n{transaction_df.head()}")
        logger.info(f"Name and Number : \n{name_n_num_df.head()}")

        file_path = save_to_excel(transaction_df, name_n_num_df, case_name)
        logger.info(f"Python data : {file_path}")

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

        transaction_df = pd.DataFrame(request.transactions_data)
        transaction_df["Value Date"] = pd.to_datetime(transaction_df["Value Date"], format="%d-%m-%Y")
        logger.info(transaction_df.head(10))
        
        category_master_data = request.categoryMasterData
        category_master_data_df = pd.DataFrame(category_master_data)
        category_master_data_df.columns = [col.capitalize() for col in category_master_data_df.columns]
        category_master_data_df.rename(columns={"Debit_credit": "Debit / Credit"}, inplace=True)


        data = individual_summary(transaction_df,category_master_data_df)
        logger.info(data)

        return data

    except Exception as e:
        logger.error(e)
        logger.error(f"Error processing bank statements: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing bank statements: {str(e)}"
        )


# ===== SYSTEM COMPATIBILITY CHECKER ENDPOINTS =====

class CompatibilityCheckRequest(BaseModel):
    pdf_paths: List[str] = Field(default=[], description="List of PDF paths to test (optional)")
    passwords: Optional[List[str]] = Field(default=[], description="List of passwords for PDFs (optional)")
    quick_check: bool = Field(default=True, description="Perform quick compatibility check without processing files")


@app.post("/compatibility-check/")
async def check_system_compatibility(request: CompatibilityCheckRequest):
    """
    Comprehensive system compatibility check for CypherEdge backend.
    Tests all critical dependencies, ML models, and processing capabilities.
    """
    try:
        logger.info("Starting comprehensive system compatibility check")
        
        # Initialize compatibility results
        compatibility_results = {
            "status": "compatible",
            "timestamp": time.time(),
            "checks": {
                "dependencies": {"status": "unknown", "details": {}},
                "ml_models": {"status": "unknown", "details": {}},
                "temp_directories": {"status": "unknown", "details": {}},
                "pdf_processing": {"status": "unknown", "details": {}}
            },
            "warnings": [],
            "errors": [],
            "system_info": {}
        }
        
        # 1. Check Python dependencies
        dependency_result = await check_python_dependencies()
        compatibility_results["checks"]["dependencies"] = dependency_result
        if dependency_result["status"] == "error":
            compatibility_results["errors"].extend(dependency_result.get("errors", []))
        elif dependency_result["status"] == "warning":
            compatibility_results["warnings"].extend(dependency_result.get("warnings", []))
        
        # 2. Check ML models availability
        ml_result = await check_ml_models()
        compatibility_results["checks"]["ml_models"] = ml_result
        if ml_result["status"] == "error":
            compatibility_results["errors"].extend(ml_result.get("errors", []))
        elif ml_result["status"] == "warning":
            compatibility_results["warnings"].extend(ml_result.get("warnings", []))
        
        # 3. Check temp directories and file access
        temp_result = await check_temp_directories()
        compatibility_results["checks"]["temp_directories"] = temp_result
        if temp_result["status"] == "error":
            compatibility_results["errors"].extend(temp_result.get("errors", []))
        elif temp_result["status"] == "warning":
            compatibility_results["warnings"].extend(temp_result.get("warnings", []))
        
        # 4. Test PDF processing capabilities (if requested and PDFs provided)
        if not request.quick_check and request.pdf_paths:
            pdf_result = await check_pdf_processing(request.pdf_paths, request.passwords)
            compatibility_results["checks"]["pdf_processing"] = pdf_result
            if pdf_result["status"] == "error":
                compatibility_results["errors"].extend(pdf_result.get("errors", []))
            elif pdf_result["status"] == "warning":
                compatibility_results["warnings"].extend(pdf_result.get("warnings", []))
        else:
            compatibility_results["checks"]["pdf_processing"] = {
                "status": "skipped",
                "details": {"reason": "Quick check mode or no PDFs provided"}
            }
        
        # 5. Collect system information
        compatibility_results["system_info"] = get_system_info()
        
        # Determine overall compatibility status
        if compatibility_results["errors"]:
            compatibility_results["status"] = "incompatible"
        elif compatibility_results["warnings"]:
            compatibility_results["status"] = "compatible_with_warnings"
        else:
            compatibility_results["status"] = "compatible"
        
        logger.info(f"Compatibility check completed with status: {compatibility_results['status']}")
        return compatibility_results
        
    except Exception as e:
        logger.error(f"Compatibility check failed: {str(e)}")
        return {
            "status": "error",
            "timestamp": time.time(),
            "error": str(e),
            "checks": {},
            "system_info": {}
        }


async def check_python_dependencies():
    """Check if all required Python dependencies are available"""
    try:
        missing_deps = []
        available_deps = []
        
        # Critical dependencies for CypherEdge
        critical_deps = [
            ("pandas", "Data processing"),
            ("fastapi", "Web API framework"),
            ("uvicorn", "ASGI server"),
            ("pydantic", "Data validation")
        ]
        
        # ML and PDF dependencies
        ml_deps = [
            ("torch", "PyTorch ML framework"),
            ("transformers", "Hugging Face transformers"),
            ("spacy", "NLP library"),
            ("fitz", "PyMuPDF for PDF processing"),
            ("pdfplumber", "PDF text extraction")
        ]
        
        all_deps = critical_deps + ml_deps
        
        for dep_name, description in all_deps:
            try:
                __import__(dep_name)
                available_deps.append({"name": dep_name, "description": description, "status": "available"})
            except ImportError:
                missing_deps.append({"name": dep_name, "description": description, "status": "missing"})
        
        if missing_deps:
            return {
                "status": "error" if any(dep["name"] in [d[0] for d in critical_deps] for dep in missing_deps) else "warning",
                "details": {
                    "available": available_deps,
                    "missing": missing_deps,
                    "total_checked": len(all_deps)
                },
                "errors": [f"Missing critical dependency: {dep['name']}" for dep in missing_deps if dep["name"] in [d[0] for d in critical_deps]],
                "warnings": [f"Missing optional dependency: {dep['name']}" for dep in missing_deps if dep["name"] not in [d[0] for d in critical_deps]]
            }
        
        return {
            "status": "success",
            "details": {
                "available": available_deps,
                "missing": [],
                "total_checked": len(all_deps)
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "details": {"error": str(e)},
            "errors": [f"Dependency check failed: {str(e)}"]
        }


async def check_ml_models():
    """Check if ML models can be loaded"""
    try:
        model_results = []
        
        # Test spaCy model loading
        try:
            import spacy
            # Try to load the English model that CypherEdge uses
            nlp = spacy.load("en_core_web_sm")
            model_results.append({
                "name": "spaCy en_core_web_sm",
                "status": "loaded",
                "size": "small",
                "capabilities": ["tokenization", "NER", "POS tagging"]
            })
        except Exception as spacy_error:
            model_results.append({
                "name": "spaCy en_core_web_sm",
                "status": "error",
                "error": str(spacy_error)
            })
        
        # Test basic PyTorch availability
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model_results.append({
                "name": "PyTorch",
                "status": "available",
                "device": device,
                "version": torch.__version__
            })
        except Exception as torch_error:
            model_results.append({
                "name": "PyTorch",
                "status": "error",
                "error": str(torch_error)
            })
        
        # Check for errors
        errors = [result for result in model_results if result["status"] == "error"]
        
        if errors:
            return {
                "status": "error" if len(errors) == len(model_results) else "warning",
                "details": {
                    "models": model_results,
                    "loaded_count": len([r for r in model_results if r["status"] in ["loaded", "available"]]),
                    "error_count": len(errors)
                },
                "errors": [f"ML model error: {error['name']} - {error['error']}" for error in errors]
            }
        
        return {
            "status": "success",
            "details": {
                "models": model_results,
                "loaded_count": len(model_results),
                "error_count": 0
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "details": {"error": str(e)},
            "errors": [f"ML model check failed: {str(e)}"]
        }


async def check_temp_directories():
    """Check temporary directory access and permissions"""
    try:
        import tempfile
        
        temp_results = []
        
        # Test system temp directory
        try:
            with tempfile.NamedTemporaryFile(mode='w', delete=True, suffix='.cypher_test') as temp_file:
                temp_file.write("CypherEdge compatibility test")
                temp_file.flush()
                
                # Test read access
                temp_file.seek(0)
                
            temp_results.append({
                "location": tempfile.gettempdir(),
                "type": "system_temp",
                "status": "accessible",
                "permissions": "read_write"
            })
        except Exception as temp_error:
            temp_results.append({
                "location": tempfile.gettempdir(),
                "type": "system_temp", 
                "status": "error",
                "error": str(temp_error)
            })
        
        # Test CypherEdge temp directory
        try:
            cypher_temp = TEMP_SAVED_PDF_DIR
            if not os.path.exists(cypher_temp):
                os.makedirs(cypher_temp, exist_ok=True)
            
            test_file = os.path.join(cypher_temp, "cypher_compatibility_test.tmp")
            with open(test_file, 'w') as f:
                f.write("test")
            
            # Clean up
            os.remove(test_file)
            
            temp_results.append({
                "location": cypher_temp,
                "type": "cypher_temp",
                "status": "accessible",
                "permissions": "read_write"
            })
        except Exception as cypher_error:
            temp_results.append({
                "location": cypher_temp if 'cypher_temp' in locals() else "unknown",
                "type": "cypher_temp",
                "status": "error", 
                "error": str(cypher_error)
            })
        
        # Check for errors
        errors = [result for result in temp_results if result["status"] == "error"]
        
        if errors:
            return {
                "status": "error",
                "details": {
                    "directories": temp_results,
                    "accessible_count": len([r for r in temp_results if r["status"] == "accessible"]),
                    "error_count": len(errors)
                },
                "errors": [f"Temp directory error: {error['location']} - {error['error']}" for error in errors]
            }
        
        return {
            "status": "success",
            "details": {
                "directories": temp_results,
                "accessible_count": len(temp_results),
                "error_count": 0
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "details": {"error": str(e)},
            "errors": [f"Temp directory check failed: {str(e)}"]
        }


async def check_pdf_processing(pdf_paths: List[str], passwords: Optional[List[str]] = None):
    """Test PDF processing capabilities with provided files"""
    try:
        if not pdf_paths:
            return {
                "status": "skipped",
                "details": {"reason": "No PDF paths provided"}
            }
        
        processing_results = []
        passwords = passwords or []
        
        for i, pdf_path in enumerate(pdf_paths[:3]):  # Limit to 3 PDFs for performance
            try:
                if not os.path.exists(pdf_path):
                    processing_results.append({
                        "pdf_path": pdf_path,
                        "status": "error",
                        "error": "File not found"
                    })
                    continue
                
                password = passwords[i] if i < len(passwords) else ""
                
                # Test basic PDF reading with PyMuPDF
                import fitz
                doc = fitz.open(pdf_path)
                
                if doc.needs_pass and not password:
                    processing_results.append({
                        "pdf_path": pdf_path,
                        "status": "warning",
                        "warning": "PDF requires password but none provided"
                    })
                    doc.close()
                    continue
                
                if password and doc.needs_pass:
                    doc.authenticate(password)
                
                # Test basic text extraction
                text_sample = ""
                if doc.page_count > 0:
                    page = doc[0]
                    text_sample = page.get_text()[:200]  # First 200 characters
                
                doc.close()
                
                processing_results.append({
                    "pdf_path": pdf_path,
                    "status": "success",
                    "pages": doc.page_count,
                    "text_sample_length": len(text_sample),
                    "has_text": len(text_sample.strip()) > 0
                })
                
            except Exception as pdf_error:
                processing_results.append({
                    "pdf_path": pdf_path,
                    "status": "error",
                    "error": str(pdf_error)
                })
        
        # Check results
        errors = [r for r in processing_results if r["status"] == "error"]
        warnings = [r for r in processing_results if r["status"] == "warning"]
        
        if errors:
            return {
                "status": "error" if len(errors) == len(processing_results) else "warning",
                "details": {
                    "results": processing_results,
                    "processed_count": len([r for r in processing_results if r["status"] == "success"]),
                    "error_count": len(errors),
                    "warning_count": len(warnings)
                },
                "errors": [f"PDF processing error: {error['pdf_path']} - {error['error']}" for error in errors],
                "warnings": [f"PDF processing warning: {warning['pdf_path']} - {warning['warning']}" for warning in warnings]
            }
        elif warnings:
            return {
                "status": "warning",
                "details": {
                    "results": processing_results,
                    "processed_count": len([r for r in processing_results if r["status"] == "success"]),
                    "error_count": 0,
                    "warning_count": len(warnings)
                },
                "warnings": [f"PDF processing warning: {warning['pdf_path']} - {warning['warning']}" for warning in warnings]
            }
        
        return {
            "status": "success",
            "details": {
                "results": processing_results,
                "processed_count": len(processing_results),
                "error_count": 0,
                "warning_count": 0
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "details": {"error": str(e)},
            "errors": [f"PDF processing check failed: {str(e)}"]
        }


def get_system_info():
    """Collect system information for compatibility reporting"""
    try:
        return {
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "machine": platform.machine(),
                "processor": platform.processor()
            },
            "python": {
                "version": platform.python_version(),
                "implementation": platform.python_implementation()
            },
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage('/').total if os.name != 'nt' else psutil.disk_usage('C:\\').total,
                "free": psutil.disk_usage('/').free if os.name != 'nt' else psutil.disk_usage('C:\\').free
            },
            "temp_directory": TEMP_SAVED_PDF_DIR,
            "backend_version": "2.0.1"  # Update this to match your version
        }
    except Exception as e:
        return {
            "error": f"Could not collect system info: {str(e)}",
            "temp_directory": TEMP_SAVED_PDF_DIR,
            "backend_version": "2.0.1"
        }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("Validation Error:", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
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
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )