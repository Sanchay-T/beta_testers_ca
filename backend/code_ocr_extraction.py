import pandas as pd
import numpy as np
import io
from PyPDF2 import PdfReader, PdfWriter
from PyPDF2 import PdfReader, PdfWriter, Transformation
from PyPDF2.generic import NameObject, NumberObject, RectangleObject
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import black
from datetime import datetime, timedelta
import torch
from PIL import Image
import fitz  # PyMuPDF
from PIL import Image

import pdfplumber
from torchvision import transforms
from huggingface_hub import hf_hub_download
import cv2
# import matplotlib
# matplotlib.use("Agg")
# from matplotlib.patches import Patch
from PIL import ImageDraw
from PIL import Image
from transformers import TableTransformerForObjectDetection
# from tqdm.auto import tqdm
# import matplotlib.pyplot as plt
# import matplotlib.patches as patches
import os
import fitz  # PyMuPDF
from io import BytesIO
import re
import uuid
# from findaddy.exceptions import ExtractionError
import logging
from .utils import get_base_dir

from paddleocr import PaddleOCR, TextDetection, TextRecognition


logger = logging.getLogger(__name__)
BASE_DIR = get_base_dir()
logger.info("Base Dir : ", BASE_DIR)

from .utils import get_saved_pdf_dir
TEMP_SAVED_PDF_DIR = get_saved_pdf_dir()

# # 1. Paths to Your Model Folders and Sample Image
# # ─────────────────────────────────────────────────────────────────────────────\

# DETDIR_server = os.path.join(BASE_DIR,"models", "PP-OCRv5_server_det_infer")
DETDIR_mobile = os.path.join(BASE_DIR,"models", "PP-OCRv5_mobile_det_infer")
# RECDIR_server = os.path.join(BASE_DIR,"models", "PP-OCRv5_server_rec_infer")
RECDIR_mobile = os.path.join(BASE_DIR,"models", "PP-OCRv5_mobile_rec_infer")

# det_model = TextDetection(model_name="PP-OCRv5_server_det", model_dir= DETDIR_server)
det_model_mobile = TextDetection(model_name="PP-OCRv5_mobile_det", model_dir=DETDIR_mobile)
# rec_model = TextRecognition(model_name="PP-OCRv5_server_rec", model_dir=RECDIR_server)
rec_model_mobile = TextRecognition(model_name="PP-OCRv5_mobile_rec", model_dir=RECDIR_mobile)
# # ─────────────────────────────────────────────────────────────────────────────


def add_start_n_end_date_v2(df, start_date, end_date, bank):

    def _missing(s):
        return s is None or str(s).strip().lower() in {"", "null", "none"}

    df = df.copy()

    # 1. Coerce numeric columns ------------------------------------------------
    for col in ["Balance", "Debit", "Credit"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # 2. Parse the Value Date column once -------------------------------------
    df["Value Date"] = pd.to_datetime(
        df["Value Date"],
        format="%d-%m-%Y",
        errors="coerce",
    )

    period_start, period_end = df["Value Date"].iloc[[0, -1]]

    # ── Scenario A: no dates supplied ────────────────────────────────────────
    if _missing(start_date) and _missing(end_date):
        return _wrap(df, bank, open_date=start_date, close_date=end_date)            # synthetic rows get real first/last dates

    # ── Scenario B: dates supplied ───────────────────────────────────────────
    sd = datetime.strptime(start_date, "%d-%m-%Y")
    ed = datetime.strptime(end_date,   "%d-%m-%Y")

    # 3. Range check (±1 day tolerance, matches original behaviour) ----------
    # if [sd, ed] sits entirely before or after [period_start, period_end]:
    if ed < period_start or sd > period_end:
        raise Exception(
            f"Error: The period for Bank: {bank} "
            f"({period_start:%d-%m-%Y} to {period_end:%d-%m-%Y}), "
            f"does not overlap with the user‐provided dates "
            f"({sd:%d-%m-%Y} to {ed:%d-%m-%Y})."
        )

    # 4. Slice from first ≥ start_date to last ≤ end_date ---------------------
    idx_start = df.index[df["Value Date"] >= pd.Timestamp(sd)].min()
    idx_end   = df.index[df["Value Date"] <= pd.Timestamp(ed)].max()

    trimmed = df.loc[idx_start:idx_end].reset_index(drop=True)

    # 5. Build final frame with user‑supplied open/close dates ---------------
    return _wrap(trimmed, bank, open_date=start_date, close_date=end_date)

def _wrap(slice_df, bank, open_date, close_date):
    first, last = slice_df.iloc[0], slice_df.iloc[-1]

    opening_bal = (
        first["Balance"] - first["Credit"]
        if first["Credit"] > 0
        else first["Balance"] + first["Debit"]
    )
    closing_bal = last["Balance"]

    # default dates if not overridden
    open_dt  = pd.to_datetime(open_date,  format="%d-%m-%Y") if open_date  else first["Value Date"]
    close_dt = pd.to_datetime(close_date, format="%d-%m-%Y") if close_date else last["Value Date"]

    rows = [
        {
            "Value Date": open_dt,
            "Description": "Opening Balance",
            "Debit": 0.0,
            "Credit": 0.0,
            "Balance": opening_bal,
        },
        *slice_df.to_dict("records"),
        {
            "Value Date": close_dt,
            "Description": "Closing Balance",
            "Debit": 0.0,
            "Credit": 0.0,
            "Balance": closing_bal,
        },
    ]
    out = pd.DataFrame(rows)
    out["Value Date"] = pd.to_datetime(out["Value Date"]).dt.strftime("%d-%m-%Y")
    out["Bank"] = bank
    return out

# Function to extract account number and IFSC code from text
def extract_info(raw_text):
    acc = "XXXXXXXXXXXXXX"
    # Regular expressions to capture Customer ID and ECS No
    customer_id_pattern = r"(?i)\bCust(?:omer)?\s*ID[:\s]*\d{10}\b"
    ecs_no_pattern = r"(?i)ECS\s*No[:\s]*\d{10,18}\b"  # Match ECS No followed by digits
    cif_no_pattern = r"CIF\sNo\.?\s*[:\-]?\s*(\d+)"

    # Remove Customer ID and ECS No from the raw text
    if re.search(customer_id_pattern, raw_text):
        raw_text = re.sub(customer_id_pattern, "", raw_text)
    if re.search(ecs_no_pattern, raw_text):
        raw_text = re.sub(ecs_no_pattern, "", raw_text)
    if re.search(cif_no_pattern, raw_text):
        raw_text = re.sub(cif_no_pattern, "", raw_text)

    # Patterns specifically targeting the numeric part for account numbers
    account_number_patterns = [
        r"\b(?!18002026161\b)(?!9\d{9}\b)(?!91\d{10}\b)\d{10,18}\b",
        r"(?!CIF No\.?:?\s*\d+\s*)Account No\.?\s*[:#]?\s*(\d+\/?[A-Z]*\/?\d+)",
        r"(?i)CUSTOMER\s*ID[:\s]*\d{10}\b",
        r"(?!Phone No. :?\s?)\d(10)",
        r"Account No\s*[:#]?\s*(\d+)",
        r"Account\s*No\s*[:#]?\s*(\d+)",
        r"Account\sNo.\s:\s(\d+\/[A-Z]+\/\d+)",
        r"Account\sNo\.?\s*[:#]?\s*(\d+\/[A-Z]+\/\d+)",
        r"Account\s*number\s*[:#]?\s*(\d+)",
        r"account\s*number\s*[:#]?\s*(\d+)",
        r"Account\s*Number\s*[:#]?\s*(\d+)",
        r"Account Number\s*:\s*(\d+)",
        r"Account Number\s*(\d+)",
        r"A/C NO[:#]?\s*(\d+)",
        r"STATEMENT PERIOD\s*(\d+)",
        r"Account number[:#]?\s*(\d+)",
        r"Account\s*[:#]?\s*(\d+)",
        r"\b\d{15}\b",
        r"Account #\s*(\d+)",
        r"\b\d{3}-\d{6}-\d{3}\b",
        r"A/c X{10}\d{4}",
        r"\b\d{8}\b",
    ]

    ifsc_pattern = r"\b[A-Z]{4}0[A-Z0-9]{6}\b"  # IFSC code pattern

    if not raw_text:  # If raw_text is None or empty, return None values
        return acc

    # Search for account number using specific patterns
    for pattern in account_number_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)

        if match:
            try:
                # Try accessing group 1 if it exists
                acc = match.group(1).strip()  # Extracted number only
            except IndexError:
                # If group 1 does not exist, return the whole match
                acc = match.group(0).strip()  # Whole match
        else:
            acc = None  # No match found

        if match:
            return acc


    # Return None if no pattern matches
    return acc

def extract_account_details(text):

    try:
        # Combined pattern to match account holder names for different banks
        name_patterns = [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"Customer Details\s*:\s*(.*?)\s*\n",
                r"Name\s*:\s*([^\n]+)",
                r"Account Holders? Name\s*:\s*([^\n]+)",
                r"(?:MR\.?|M/S\.?|MS\.?|MRS\.?)\s*([^\n]+)",
                r"Name:\s*(.*)",
                r"date ofstatement\s*\n(.*)",
                r"(.*)\s*Period",
                r"Customer Name\s*:\s*(.*)",
                r"INR\s*\n(.*)",
                r"CUSTOMER NAME (.*)",
                r"Customer\s*Details\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])\s*",
                r"Account\s*Holder\s*Name\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])\s*",
                r"(?:MR\.?|MRS\.?|MS\.?|M/S\.?)\s*([A-Z][a-zA-Z\s]*[A-Z])",
                r"Customer\s*Name\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])\s*",
                r"Name\s*of\s*Customer\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])\s*",
                r"Name\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])\s*",
                r"Accountholder\s*Name\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])\s*",
                r"Account\s*Title\s*[:\-]?\s*([A-Z][A-Z\s]+[A-Z])",
                r"CUSTOMER\s*NAME\s*[:\-]?\s*([A-Z][a-zA-Z\s]+[A-Z])",
                r"To\s*,?\s*([A-Z][a-zA-Z\s]+[A-Z])",
                r"TO\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])",
                r"Account\s*Title\s*:\s*([A-Z][a-zA-Z\s]+[A-Z])",
                r"Name\s+([A-Z][A-Z\s]+[A-Z])",
                r"Account Holders? Name\s*([A-Z][A-Z\s]+[A-Z])(?:\s*\n)?",
            ]
        ]

        names = []
        for pattern in name_patterns:
            matches = pattern.findall(text)
            if matches:
                names.extend(matches)
        # Fallback for joint holder text specific to AXIS_BANK
        joint_holder_text = "Joint Holder :"
        if joint_holder_text in text:
            parts = text.split(joint_holder_text, 1)
            names.extend(parts[0].strip().split("\n"))

        names = [
            name.strip() for name in names if name.strip()
        ]  # Clean up names list

        # Combined pattern to match account numbers for different banks
        account_numbers = extract_info(text)

        details = [
            names[0] if names else "_____",
            account_numbers,
        ]

        return details

    except Exception as e:
        print(
            f"An error occurred while extracting names and account numbers: {str(e)}"
        )
        return ["_", "XXXXXXXXXX"]



def __init__(bank_name, pdf_path, pdf_password, CA_ID):
    writer = None
    bank_names = bank_name
    pdf_paths = pdf_path
    pdf_passwords = pdf_password
    account_number = ""
    file_name = None
    CA_ID = CA_ID
    # customer = CustomStatement(bank_name, pdf_path, pdf_password, CA_ID)

def load_new_first_page_function(pdf_document):
    """
    Trims the first page of the PDF from the point where 'date' and 'balance' keywords
    are found together downwards. If not found on the first page, checks the second and third pages,
    then terminates if not found. Keeps some distance above the line containing the keywords.
    """
    date_pattern = re.compile(r'\b(date|value date|value|transaction date)\b', re.IGNORECASE)
    balance_pattern = re.compile(r'\b(balance|total amount|bal)\b', re.IGNORECASE)

    for page_num in range(min(11, len(pdf_document))):  # Check up to the first three pages
        page = pdf_document[page_num]  # Load the page
        text_blocks = page.get_text("blocks")  # Extract text blocks

        date_coords = []
        balance_coords = []

        # Collect coordinates for 'date' and 'balance' keywords
        for block in text_blocks:
            y0 = block[1]
            text = block[4].strip()

            if date_pattern.search(text):
                date_coords.append((y0, block))
            if balance_pattern.search(text):
                balance_coords.append((y0, block))

        crop_y = None

        # Find the y-coordinate where both 'date' and 'balance' keywords are on the same row
        for date_y, date_block in date_coords:
            for balance_y, balance_block in balance_coords:
                if abs(date_y - balance_y) < 11:  # Small tolerance for alignment
                    crop_y = min(date_y, balance_y)
                    break
            if crop_y is not None:
                break

        if crop_y is not None:
            # Adjust crop_y to include some distance above the keywords
            buffer_distance = 9  # Points to keep above the line
            crop_y = max(page.mediabox.y0, crop_y - buffer_distance)

            # Define the cropping rectangle
            crop_rect = fitz.Rect(
                page.mediabox.x0,  # Left boundary
                crop_y,  # Top boundary (crop above this point with buffer)
                page.mediabox.x1,  # Right boundary
                page.mediabox.y1  # Bottom boundary
            )

            # Create a new document for the cropped page
            cropped_doc = fitz.open()
            cropped_doc.insert_pdf(pdf_document, from_page=page_num, to_page=page_num)
            cropped_page = cropped_doc[0]
            cropped_page.set_cropbox(crop_rect)

            return cropped_doc

    return None  # Terminate if keywords are not found on the first three pages

def load_first_page_into_memory(pdf_path):
    ca_id = "1234_temp"
    # Compile regex patterns for date and balance keywords for fast searching
    # date_pattern = re.compile(r'\b(date|value date|value)\b', re.IGNORECASE)
    # balance_pattern = re.compile(r'\b(balance|total amount)\b', re.IGNORECASE)

    try:
        # Open the PDF and determine which pages to check
        with fitz.open(pdf_path) as pdf_doc:
            # pages_to_check = [1, 0] if pdf_doc.page_count > 1 else [0]

            # Initialize variables for cropping decision
            crop_y = None
            # selected_page_num = 0  # Default to the first page
            #
            # # Iterate over the pages to check for keywords
            # for page_num in pages_to_check:
            #     page = pdf_doc[page_num]
            #     text_blocks = page.get_text("blocks")
            #
            #     # Collect coordinates of text blocks containing date or balance keywords
            #     date_coords = []
            #     balance_coords = []
            #     for block in text_blocks:
            #         y0 = block[1]
            #         text = block[4].strip()
            #
            #         if date_pattern.search(text):
            #             date_coords.append((y0, block))
            #         if balance_pattern.search(text):
            #             balance_coords.append((y0, block))
            #
            #     # Find the block that contains both date and balance keywords on the same x-axis
            #     for date_y, date_block in date_coords:
            #         for balance_y, balance_block in balance_coords:
            #             if abs(date_y - balance_y) < 5:  # Assuming a small tolerance to consider same row
            #                 crop_y = min(date_y, balance_y)
            #                 selected_page_num = page_num
            #                 break
            #         if crop_y is not None:
            #             break
            #
            #     # If no row with both date and balance keywords found, check for balance keywords first
            #     # if crop_y is None and balance_coords:
            #     #     crop_y = min(balance_coords, key=lambda x: x[0])[0]
            #     #     selected_page_num = page_num
            #
            #     # If a suitable crop_y is found, stop checking further pages
            #     if crop_y is not None:
            #         break

            # If no keywords were found, use the full height of the first page
            if crop_y is None:
                selected_page_num = 0
                page = pdf_doc[selected_page_num]
                crop_y = page.mediabox.y0  # Use the entire page without cropping

            # Define the cropping rectangle (or use the full page if no cropping is needed)
            crop_rect = fitz.Rect(
                page.mediabox.x0,  # Left boundary
                max(page.mediabox.y0, crop_y),  # Crop above this Y
                page.mediabox.x1,  # Right boundary
                page.mediabox.y1  # Top boundary
            )

            # Define output path for the cropped page
            output_page_path = os.path.join(
                os.path.dirname(pdf_path),
                f"{ca_id}_{selected_page_num + 1}_crop_{uuid.uuid4().hex}.pdf"
            )

            # Save only the selected page as a new PDF
            with fitz.open() as single_page_pdf:
                single_page_pdf.insert_pdf(pdf_doc, from_page=selected_page_num, to_page=selected_page_num)
                cropped_page = single_page_pdf[0]
                # Apply the crop to the saved page using the defined crop rectangle
                cropped_page.set_cropbox(crop_rect)
                single_page_pdf.save(output_page_path)

            return output_page_path

    except Exception as e:
        print(f"An error occurred: {e}")
        return None

def flatten_page_rotation(page):
    """
    - Read /Rotate from the page (90, 180, or 270).
    - Physically re-rotate (flatten) the page's content stream so
      we can set /Rotate=0 without changing the visual appearance.
    - Update page.mediabox so the rotated content is fully visible.
    """
    # Safely fetch the /Rotate entry (as a PdfObject).
    rotate_obj = page.get(NameObject("/Rotate"), NumberObject(0))
    rotation = int(rotate_obj)  # Convert to plain int

    if rotation == 0:
        return  # No rotation to flatten

    # Current page width/height
    w = float(page.mediabox.width)
    h = float(page.mediabox.height)

    transform = None

    if rotation == 90:
        # Flatten +90 by applying +270
        transform = Transformation().rotate(270).translate(tx=0, ty=w)
        # After rotation by +270°, the "width" and "height" swap
        # So the new page width should be old 'h', new page height old 'w'
        new_box = RectangleObject([0, 0, h, w])

    elif rotation == 180:
        # Flatten +180 by applying +180
        transform = Transformation().rotate(180).translate(tx=w, ty=h)
        # Rotating 180 doesn't swap width/height
        new_box = RectangleObject([0, 0, w, h])

    elif rotation == 270:
        # Flatten +270 by applying +90
        transform = Transformation().rotate(90).translate(tx=0, ty=h)
        # Rotation by +90 also swaps width/height
        new_box = RectangleObject([0, 0, h, w])

    # 1) Physically transform the page content
    page.add_transformation(transform)

    # 2) Update the MediaBox so the reoriented content isn't clipped
    page.mediabox = new_box

    # 3) Finally, set /Rotate to 0 so the viewer doesn't rotate the page
    page[NameObject("/Rotate")] = NumberObject(0)

def flatten_pdf_rotation(input_pdf_path, output_pdf_path):

    reader = PdfReader(input_pdf_path)
    writer = PdfWriter()

    for page in reader.pages:
        flatten_page_rotation(page)
        writer.add_page(page)

    with open(output_pdf_path, "wb") as f:
        writer.write(f)

    return output_pdf_path

def unlock_and_add_margins_to_pdf(pdf_path, pdf_password, timestamp, CA_ID):
    os.makedirs(TEMP_SAVED_PDF_DIR, exist_ok=True)

    try:
        # Open the PDF using fitz (PyMuPDF)
        pdf_document = fitz.open(pdf_path)

        # If the PDF is encrypted, try to unlock it
        if pdf_document.is_encrypted:
            if not pdf_document.authenticate(pdf_password):
                raise ValueError("Incorrect password. Unable to unlock the PDF.")

        # Define the output path for the unlocked PDF
        unlocked_pdf_filename = f"{timestamp}-{CA_ID}_{uuid.uuid4().hex}.pdf"
        unlocked_pdf_path = os.path.join(TEMP_SAVED_PDF_DIR, unlocked_pdf_filename)

        # Save the modified PDF (unlocked and with margins)
        pdf_document.save(unlocked_pdf_path)
        pdf_document.close()

        return unlocked_pdf_path

    except Exception as e:
        raise ValueError(f"Error: {e}")

    finally:
        if os.path.exists("combined_temp.pdf"):
            os.remove("combined_temp.pdf")

def get_table_column_coordinates(pdf_path):
    page_num = 0
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num]

        table_settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            # "edge_min_length": 20,
        }

        # Get table structure exactly like debug_tablefinder()
        table_finder = page.debug_tablefinder(table_settings)
        # print(table_finder.tables)

        if not table_finder.tables:
            return []

        # Extract ALL vertical edges (before filtering)
        column_all_coords = sorted(set(edge["x0"] for edge in table_finder.edges if edge["orientation"] == "v"))

        # Find the largest table based on area (width × height)
        largest_table = max(
            table_finder.tables,
            key=lambda t: (t.bbox[2] - t.bbox[0]) * (t.bbox[3] - t.bbox[1])
        )

        # Extract vertical edges within the largest table's bounding box with a tolerance
        table_xmin, table_ymin, table_xmax, table_ymax = largest_table.bbox
        tolerance = 5  # Allow a small tolerance for alignment issues

        column_x_coords = sorted(set(
            edge["x0"] for edge in table_finder.edges
            if edge["orientation"] == "v" and
            (table_xmin - tolerance) <= edge["x0"] <= (table_xmax + tolerance) and
            "top" in edge and "bottom" in edge and
            (table_ymin - tolerance) <= edge["top"] <= (table_ymax + tolerance) and
            (table_ymin - tolerance) <= edge["bottom"] <= (table_ymax + tolerance) and
            (edge["bottom"] - edge["top"]) > 0.5 * (table_ymax - table_ymin)  # Ensure significant edge length
        ))

        if not column_x_coords and len(table_finder.tables) == 1:
            return column_all_coords

        if len(column_x_coords) < 4:
            return column_all_coords

        return column_x_coords

def get_ocr_column_coordinates(pdf_path, page_num: int = 0):
    """
    Treat the whole page as a grid and return the X-coordinates
    of all significant vertical lines on that page.
    """
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num]

        # Ask pdfplumber to find *line* objects, but ignore its table output
        table_settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "intersection_x_tolerance": 200,
        }
        tf = page.debug_tablefinder(table_settings)

        page_height = page.height
        min_length = 0.50 * page_height        # keep only long-ish lines
        tolerance  = 1                         # how strict a “vertical” check is

        column_x_coords = sorted(
            {
                edge["x0"]
                for edge in tf.edges
                if edge["orientation"] == "v"
                   and "top" in edge and "bottom" in edge
                   and (edge["bottom"] - edge["top"]) >= min_length
                   and abs(edge["x0"] - edge["x1"]) <= tolerance
            }
        )

        return column_x_coords

def get_table_column_coordinates_by_text(pdf_path):
    page_num = 0
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num]

        table_settings = {
            "vertical_strategy": "text",
            "horizontal_strategy": "lines",
            "edge_min_length": 10,
        }

        # Get table structure exactly like debug_tablefinder()
        table_finder = page.debug_tablefinder(table_settings)

        if not table_finder.tables:
            return []

        # Extract ALL vertical edges (before filtering)
        column_all_coords = sorted(set(edge["x0"] for edge in table_finder.edges if edge["orientation"] == "v"))

        # Find the largest table based on area (width × height)
        largest_table = max(
            table_finder.tables,
            key=lambda t: (t.bbox[2] - t.bbox[0]) * (t.bbox[3] - t.bbox[1])
        )

        # Extract vertical edges within the largest table's bounding box with a tolerance
        table_xmin, table_ymin, table_xmax, table_ymax = largest_table.bbox
        tolerance = 1  # Allow a small tolerance for alignment issues

        column_x_coords = sorted(set(
            edge["x0"] for edge in table_finder.edges
            if edge["orientation"] == "v" and
            (table_xmin - tolerance) <= edge["x0"] <= (table_xmax + tolerance) and
            "top" in edge and "bottom" in edge and
            (table_ymin - tolerance) <= edge["top"] <= (table_ymax + tolerance) and
            (table_ymin - tolerance) <= edge["bottom"] <= (table_ymax + tolerance) and
            (edge["bottom"] - edge["top"]) > 0.5 * (table_ymax - table_ymin)  # Ensure significant edge length
        ))

        if not column_x_coords and len(table_finder.tables) == 1:
            return column_all_coords

        if len(column_x_coords) < 4:
            return column_all_coords

        return column_x_coords

##____________AFTER EXTRACTION (cleaning)_________________
def parse_date(date_string):
    date_string = date_string.strip()
    formats_to_try = [
        "%d/%m /%Y",
        "%d/%m/ %Y",
        "%d-%m-%Y",
        "%d-%m- %Y",
        "%d-%m -%Y",
        "%d/%b/%Y",
        "%d/%b/ %Y",
        "%d/%b /%Y",
        "%d %b %Y",
        "%Y-%m-%d",
        # "%y-%m-%d",
        "%d %B %Y",
        "%d/%m/%Y",
        "%d-%b-%Y",
        "%d-%b-%y",
        "%B %d %Y",
        "%b %d %Y",
        "%d-%B-%Y",
        "%m/%d/%Y",
        "%d %b %y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d-%b- %Y",
        "%d/%b/%Y",
        "%d %b, %Y",
        "%d %b, %Y %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%d %b %Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%d %B %Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d-%b-%Y %H:%M:%S",
        "%d-%b-%y %H:%M:%S",
        "%B %d, %Y %H:%M:%S",
        "%d-%B-%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%d %b %y %H:%M:%S",
        "%d/%m/%y %H:%M:%S",
        "%d-%m-%y %H:%M:%S",
        "%d-%b- %Y %H:%M:%S",
        "%d/%b/%Y %H:%M:%S",
        "%y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%y-%m-%d",
    ]

    for date_format in formats_to_try:
        try:
            return datetime.strptime(date_string, date_format).date()
        except ValueError:
            pass
    return None

def extract_date_col_from_df(df):
    date_col = []
    for column in df.columns:
        for index, value in df[column].head(200).items():
            parsed_date = parse_date(str(value))
            if parsed_date:
                date_col.append(column)
    d_col = list(set(date_col))
    if not d_col:
        df = df.applymap(lambda x: str(x).lower())
        # Iterate over each column number
        for column in df.columns:
            if any(df.iloc[:, column].str.contains("value date")):
                d_col.append(column)
    return d_col

def find_desc_column(df, date_cols):
    # Convert all entries in the DataFrame to lowercase strings
    df = df.applymap(lambda x: str(x).lower())
    desc = []
    keywords = [
        "description", "escription", "scription", "descr", "descrip",
        "narration", "arration", "rration", "narrati", "narrat",
        "particular", "articular", "rticular", "particul",
        "detail", "remark", "remar", "emark", "naration",
        "transaction reference", "transaction ref", "references"
    ]

    # Iterate over each row
    for index, row in df.head(90).iterrows():
        # Iterate over each column in the row
        for column_number, cell in enumerate(row):
            if column_number in date_cols:
                continue
            if any(keyword in cell for keyword in keywords):
                desc.append(column_number)
                break  # Move to the next row after finding a match

    return list(desc)

def find_debit_column(df, desc_col, date_col, bal_column):
    # Convert all entries in the DataFrame to lowercase strings
    df = df.applymap(lambda x: str(x).lower())
    deb = []
    keywords = ["withdraw", "debit", "dr amount", "withdr", "dr", "withdrawal"]

    # Iterate over each row
    for index, row in df.head(90).iterrows():
        # Iterate over each column in the row
        for column_number, cell in enumerate(row):
            if column_number in desc_col or column_number in date_col or column_number in bal_column:
                continue
            if any(keyword in cell for keyword in keywords):
                deb.append(column_number)
                break  # Move to the next row after finding a match

    # Return unique column indices
    return deb

def find_credit_column(df, desc_col, date_col, bal_column):
    # Convert all entries in the DataFrame to lowercase strings
    df = df.applymap(lambda x: str(x).lower())
    df = df.applymap(lambda x: re.sub(r'\bscroll\b', '', str(x), flags=re.IGNORECASE))
    cred = []
    keywords = ["deposit", "credit", "cr amount", "depo", "cr"]

    # Iterate over each row
    for index, row in df.head(90).iterrows():
        # Iterate over each column in the row
        for column_number, cell in enumerate(row):
            if column_number in desc_col or column_number in date_col or column_number in bal_column:
                continue
            if any(keyword in cell for keyword in keywords):
                cred.append(column_number)
                break  # Move to the next row after finding a match

    # Return unique column indices
    return cred

def find_balance_column(df, desc_col, date_col):
    # Convert all entries in the DataFrame to lowercase strings
    desc_col = [desc_col[0]]
    df = df.applymap(lambda x: str(x).lower())
    bal = []
    keywords = ["balance", "total amount", "ance", "bal", "bala"]

    # Iterate over each row
    for index, row in df.head(90).iterrows():
        # Iterate over each column in the row
        for column_number, cell in enumerate(row):
            if column_number in desc_col or column_number in date_col:
                continue
            if any(keyword in cell for keyword in keywords):
                bal.append(column_number)
                break  # Move to the next row after finding a match

    # Return unique column indices
    return bal

def check_date(df):
    df.dropna(subset=["Value Date"], inplace=True)
    if pd.to_datetime(df["Value Date"].iloc[-1], dayfirst=True) < pd.to_datetime(
            df["Value Date"].iloc[0], dayfirst=True
    ):
        new_df = df[::-1].reset_index(drop=True)
        print("found in reverse")
    else:
        new_df = df.copy()  # No reversal required
    return new_df

def cleaning(new_df):

    def try_parsing_date(text):
        text = str(text).strip()
        formats_to_try = [
            "%d/%m /%Y",
            "%d/%m/ %Y",
            "%d-%m-%Y",
            "%d-%m- %Y",
            "%d-%m -%Y",
            "%d/%b/%Y",
            "%d/%b/ %Y",
            "%d/%b /%Y",
            "%d %b %Y",
            "%Y-%m-%d",
            # "%y-%m-%d",
            "%d %B %Y",
            "%d/%m/%Y",
            "%d-%b-%Y",
            "%d-%b-%y",
            "%B %d %Y",
            "%b %d %Y",
            "%d-%B-%Y",
            "%m/%d/%Y",
            "%d %b %y",
            "%d/%m/%y",
            "%d-%m-%y",
            "%d-%b- %Y",
            "%d/%b/%Y",
            "%d %b, %Y",
            "%d %b, %Y %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%d %b %Y %H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%d %B %Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%d-%b-%Y %H:%M:%S",
            "%d-%b-%y %H:%M:%S",
            "%B %d, %Y %H:%M:%S",
            "%d-%B-%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%d %b %y %H:%M:%S",
            "%d/%m/%y %H:%M:%S",
            "%d-%m-%y %H:%M:%S",
            "%d-%b- %Y %H:%M:%S",
            "%d/%b/%Y %H:%M:%S",
            "%y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%y-%m-%d",
        ]

        for fmt in formats_to_try:
            try:
                return pd.to_datetime(text, format=fmt)
            except ValueError:
                continue
        # try:
        #     return parser.parse(text)
        # except Exception as e:
        #     return pd.NaT

    df = new_df.reset_index(drop=True)
    # if 2 value dates eg : 02-Apr-23 (02-Apr-2023)
    df["Value Date"] = df["Value Date"].apply(
        lambda x: x.split("(")[0].strip() if isinstance(x, str) and "(" in x else x
    )
    df["Debit"] = df["Debit"].astype(str)
    df["Credit"] = df["Credit"].astype(str)
    df["Balance"] = df["Balance"].astype(str)

    df["Value Date"] = df["Value Date"].apply(try_parsing_date)
    df["Value Date"] = df["Value Date"].dt.strftime("%d-%m-%Y")
    df["Balance"] = df["Balance"].str.replace(r"Cr.|Dr.", "", regex=True)

    df["Balance"] = df["Balance"].str.replace(r"[^\d.-]+", "", regex=True)
    df["Debit"] = df["Debit"].str.replace(r"[^\d.-]+", "", regex=True)
    df["Credit"] = df["Credit"].str.replace(r"[^\d.-]+", "", regex=True)

    # # ── NEW BLOCK ────────────────────────────────────────────────────────────────
    # # If a majority of rows in either Debit or Credit still have a '+' or '-' sign,
    # # strip all '+' and '-' from both columns so we end up with absolute values.
    # total_rows = len(df)
    # debit_signs  = df["Debit"].str.contains(r"[+-]", regex=True).sum()
    # credit_signs = df["Credit"].str.contains(r"[+-]", regex=True).sum()
    #
    # if debit_signs  > total_rows / 2 or credit_signs > total_rows / 2:
    #     df["Debit"]  = df["Debit"].str.replace(r"[+-]", "", regex=True)
    #     df["Credit"] = df["Credit"].str.replace(r"[+-]", "", regex=True)
    # # ─────────────────────────────────────────────────────────────────────────────

    df["Debit"] = pd.to_numeric(df["Debit"], errors="coerce")
    df["Credit"] = pd.to_numeric(df["Credit"], errors="coerce")
    df["Balance"] = pd.to_numeric(df["Balance"], errors="coerce")
    df['Description'] = df['Description'].astype(str)

    # this is the code to merge lines that have been cut by separators
    # Iterate through the DataFrame and combine descriptions
    last_valid_row = None
    for i in range(len(df)):
        if pd.notna(df.loc[i, 'Value Date']):
            last_valid_row = i
        elif last_valid_row is not None:
            current_description = df.loc[i, 'Description'] if pd.notna(df.loc[i, 'Description']) else ''
            df.at[last_valid_row, 'Description'] += ' ' + current_description

    # Drop the rows where 'Value Date' is NaN (these rows are now redundant)
    # df_cleaned = df.dropna(subset=['Value Date']).reset_index(drop=True)
    # df = df_cleaned.drop_duplicates(subset="new_column").reset_index(drop=True)

    df = check_date(df)
    df = df[df['Balance'].notna() & (df['Balance'] != "")]
    
    df = df[~(
        ((df["Debit"].fillna(0) == 0) & (df["Credit"].fillna(0) == 0)) |
        ((df["Debit"].fillna(0) > 0) & (df["Credit"].fillna(0) > 0)) |
        ((df["Debit"].fillna(0) < 0) & (df["Credit"].fillna(0) < 0))
    )]

    if (df["Debit"].dropna() < 0).all(): ###ONLY FOR A PARTICULAR KOTAK STATEMENT
        print("All non-null Debit values are negative. Converting to positive.")
        df["Debit"] = df["Debit"].abs()

    df = df[["Value Date", "Description", "Debit", "Credit", "Balance"]]
    # df = df.drop_duplicates()
    idf = df.reset_index(drop=True)

    return idf

def credit_debit(df, description_column, date_column, bal_column, same_column):
    def classify_column(column):
        case1_count = 0
        case2_count = 0

        # Vectorized processing: Convert entire column to uppercase and check for patterns
        values = df[column][2:].str.strip().str.upper()

        # Case 1: Count occurrences where the value is only "CR", "DR", "CR.", or "DR."
        case1_count = values.isin(
            ["CR", "DR", "CR.", "DR.", "Credit", "Debit", "cr", "dr", "Cr", "Dr", "C", "D", "C.", "D.", "credit",
             "debit"]).sum()

        # Case 2: Count occurrences where the value contains both a number and "CR" or "DR"

        case2_count = values.str.contains(r'^[+-]?\d+.*(CR|DR|Credit|Debit|C|D)?', regex=True).sum()
        # print(case2_count)

        # Return the case based on counts
        if case1_count >= 5:
            return "case1"
        elif case2_count >= 5:
            return "case2"
        else:
            return "no_case"

    # Function to find the column with the keyword 'amount' (case-insensitive)
    def find_amount_column(df, desc_col, date_col, bal_column):
        df = df.applymap(lambda x: str(x).lower())
        amount_col = []
        keywords = ["amount"]

        # Iterate over each row
        for index, row in df.head(30).iterrows():
            # Iterate over each column in the row
            for column_number, cell in enumerate(row):
                if column_number in desc_col or column_number in date_col or column_number in bal_column:
                    continue
                if any(keyword in cell for keyword in keywords):
                    amount_col.append(column_number)
                    break
                    # Efficient search with list comprehension
        amount_columns = amount_col[0]
        return amount_columns

    # Since cred_column and deb_column are the same, we only need to classify the single column
    column_case = classify_column(same_column)

    if column_case == "case1":
        print("5 or more occurrences of case 1 found")

        # Find the column containing the keyword 'amount'
        amount_column = find_amount_column(df, description_column, date_column, bal_column)

        if amount_column:
            print(f"Found 'amount' column: {amount_column}")
            # Call the crdr_to_credit_debit_columns function with the found amount column
            new_df = crdr_to_credit_debit_columns(df, description_column, date_column, bal_column, amount_column,
                                                       same_column)
            return new_df
        else:
            print("No 'amount' column found")
            return None

    elif column_case == "case2":
        print("5 or more occurrences of case 2 found")

        # Vectorized split of numeric part and "CR/DR" part using regex
        df['A'] = df[same_column].str.extract(r'([\d,]+\.?\d*)')[0].str.replace(',', '')
        df['A'] = pd.to_numeric(df['A'], errors='coerce')  # Convert to float, ignoring errors
        df['B'] = df[same_column].str.extract(r'(CR|DR|Credit|Debit|C|D|\+|\-)', flags=re.IGNORECASE)[0].str.upper()
        # Now call the crdr_to_credit_debit_columns function with new columns 'A' and 'B'
        new_df = crdr_to_credit_debit_columns(df, description_column, date_column, bal_column, 'A', 'B')
        return new_df

    else:
        print("Fewer than 5 occurrences of either case")
        return None

def crdr_to_credit_debit_columns(df, description_column, date_column, bal_column, amount_column, keyword_column):
    # Vectorized assignment of Debit and Credit columns|\+|\-
    debit_keywords = r'(?i)^(DR|DR.|Debit|dr|dr.|debit|D|\-|D\.)$'
    credit_keywords = r'(?i)^(CR|CR.|Credit|cr|cr.|credit|C|\+|C\.)$'

    # Update the Debit and Credit columns
    df['Debit'] = np.where(df[keyword_column].str.contains(debit_keywords, regex=True, na=False), df[amount_column], 0)
    df['Credit'] = np.where(df[keyword_column].str.contains(credit_keywords, regex=True, na=False), df[amount_column],
                            0)

    # Construct the final DataFrame efficiently
    final_df = df[[date_column[0], description_column[0], 'Debit', 'Credit', bal_column[0]]].copy()
    # Rename all columns in order
    final_df.columns = ["Value Date", "Description", "Debit", "Credit", "Balance"]

    return final_df

def extract_text_from_pdf_ocr(unlocked_file_path):
    with pdfplumber.open(unlocked_file_path) as pdf:
        first_page = pdf.pages[0]
        text = first_page.extract_text()
        return text.strip() if text else None

##____________AFTER EXTRACTION (cleaning)_________________

##--------------------------------------------------------------------------------------------------------------------##


# def add_horizontal_lines_to_page(page, horizontal_lines, scale, line_width = 0.8, line_opacity = 1.0):

#   # Add horizontal lines
#   for x_px, y_px, w_px, h_px in horizontal_lines:
#       x  = x_px * scale
#       y  = y_px * scale
#       L  = w_px * scale
#       t  = h_px * scale  # thickness

#       left  = page.rect.x0
#       right = page.rect.x1

#       page.draw_line(
#           fitz.Point(left, y),
#           fitz.Point(right, y),
#           color=(0, 0, 1),
#           width=t
#       )

#   return page

# --- THIS IS THE FUNCTION I HAVE CHANGED ---
def add_horizontal_lines_to_page(page, y_coords_px, image_rect, img_height):
    """
    Draws full-width horizontal lines using a robust scaling method that accounts
    for the image's specific position and size on the page.

    Parameters:
    page (fitz.Page): The page object from PyMuPDF.
    y_coords_px (list): List of y-coordinates from the image (in pixels).
    image_rect (fitz.Rect): The rectangle where the image is placed on the page.
    img_height (int): The height of the original image in pixels.
    """
    # --- THE DEFINITIVE FIX ---
    # 1. Calculate the vertical scale based on the image's height on the page.
    scale_y = image_rect.height / img_height
    
    # 2. Get the top offset of where the image was inserted.
    image_top_offset = image_rect.y0

    # Get page boundaries for drawing lines
    left = page.rect.x0
    right = page.rect.x1
    line_width = 0.5

    for y_px in y_coords_px:
        # 3. Calculate the final y-position on the page.
        # This is the image's top offset + the scaled pixel position.
        y_pt = image_top_offset + (y_px * scale_y)

        # Draw the line at the correct, calculated position
        page.draw_line(
            fitz.Point(left, y_pt),
            fitz.Point(right, y_pt),
            color=(0, 0, 1),
            width=line_width
        )
    return page
def add_vertical_lines_to_page(page, vertical_lines, scale, line_width = 0.8, line_opacity = 1.0):

  # Add vertical lines
  for x_px, y_px, w_px, h_px in vertical_lines:
      x  = x_px * scale
      y  = y_px * scale
      H  = h_px * scale
      t  = w_px * scale  # thickness

      up  = page.rect.y0
      down = page.rect.y1

      page.draw_line(
          fitz.Point(x, up),
          fitz.Point(x, down),
          color=(0, 0, 1),
          width=t
      )

  return page


##--------------------------------------------------------------------------------------------------------------------##


##____________COLUMN SEPARATORS_______________________
def pdf_to_images(pdf_path):
    pdf_document = fitz.open(pdf_path)
    images = []

    for page_num in range(len(pdf_document)):
        page = pdf_document.load_page(page_num)
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)

    return images

def outputs_to_objects(outputs, img_size, id2label):
    m = outputs.logits.softmax(-1).max(-1)
    pred_labels = list(m.indices.detach().cpu().numpy())[0]
    pred_scores = list(m.values.detach().cpu().numpy())[0]
    pred_bboxes = outputs['pred_boxes'].detach().cpu()[0]

    # Convert bounding boxes from cxcywh to xyxy
    x_c, y_c, w, h = pred_bboxes.unbind(-1)
    pred_bboxes = torch.stack([
        x_c - 0.5 * w,
        y_c - 0.5 * h,
        x_c + 0.5 * w,
        y_c + 0.5 * h
    ], dim=-1)

    # Rescale bounding boxes to the image size
    scale_factors = torch.tensor([img_size[0], img_size[1], img_size[0], img_size[1]], dtype=torch.float32)
    pred_bboxes = pred_bboxes * scale_factors

    objects = []
    for label, score, bbox in zip(pred_labels, pred_scores, pred_bboxes):
        class_label = id2label[int(label)]
        if class_label != 'no object':
            objects.append({
                'label': class_label,
                'score': float(score),
                'bbox': bbox.tolist()
            })

    return objects

def detect_table_columns(image):
    structure_model = TableTransformerForObjectDetection.from_pretrained(os.path.join(BASE_DIR,"models", "local_model"))
    # structure_model = TableTransformerForObjectDetection.from_pretrained("./local_model")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    structure_model.to(device)

    structure_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    img_size = image.size
    pixel_values = structure_transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = structure_model(pixel_values)

    structure_id2label = structure_model.config.id2label
    structure_id2label[len(structure_id2label)] = "no object"

    objects = outputs_to_objects(outputs, img_size, structure_id2label)
    columns = [obj for obj in objects if obj['label'] == "table column"]

    return columns

def annotate_pdf(pdf_document, columns):
    rightmost_column = None
    rightmost_xmax = float('-inf')

    # First pass: Identify the rightmost column in one go
    for column in columns:
        bbox = column['bbox']
        xmax = bbox[2]  # Extract xmax

        # Identify the rightmost column
        if xmax > rightmost_xmax:
            rightmost_xmax = xmax
            rightmost_column = column  # Update the rightmost column

    # Cache the coordinates for the rightmost column
    if rightmost_column:
        rightmost_bbox = rightmost_column['bbox']
        xmin_rightmost = rightmost_bbox[0]  # xmin of the rightmost column
        xmax_rightmost = rightmost_bbox[2]  # xmax of the rightmost column

    # Process all pages
    list_of = []
    for page_num in range(len(pdf_document)):
        page = pdf_document.load_page(page_num)
        page_height = page.rect.height  # Cache the page height

        # Second pass: Draw the lines for all columns
        for column in columns:
            bbox = column['bbox']
            xmin = bbox[0]  # Extract xmin

            # Draw the left side line (xmin) for each column
            list_of.append(xmin)            
            page.draw_line((xmin, 0), (xmin, page_height), color=(1, 0, 0), width=1)

        # Draw the bounding box for the rightmost column
        if rightmost_column:
            # Draw the left side (xmin) of the rightmost column
            page.draw_line((xmin_rightmost, 0), (xmin_rightmost, page_height), color=(1, 0, 0), width=1)
            # Draw the right side (xmax) of the rightmost column in blue
            list_of.append(xmax_rightmost)
            page.draw_line((xmax_rightmost, 0), (xmax_rightmost, page_height), color=(0, 0, 1), width=1)

    lines = [x - 20 for x in list_of]
    return lines

def process_pdf_and_annotate(pdf_path, output_pdf):

    images = pdf_to_images(pdf_path)
    img_path = images[0]  # Use the first image for column detection

    pdf_document = fitz.open(pdf_path)

    # Detect table columns only on the first page
    first_page_columns = detect_table_columns(img_path)

    # Display the first page with detected table columns
    # plot_results(images[0], first_page_columns)

    # Annotate all pages with the same table column coordinates
    llama = annotate_pdf(pdf_document, first_page_columns)
    print("llama", llama)

    # Save the annotated PDF
    pdf_document.save(output_pdf)

    return output_pdf, first_page_columns, llama

##____________COLUMN SEPARATORS_______________________

def clean_table(table):
    # Find the first row containing both 'date' and 'balance'/'total amount' or just 'balance'/'total amount'
    start_index = table.apply(lambda row: (row.astype(str).str.contains("date", case=False).any() and
                                           row.astype(str).str.contains("balance|total amount",
                                                                        case=False).any()) or
                                          row.astype(str).str.contains("balance|total amount", case=False).any(),
                              axis=1).idxmax()

    df = table.loc[start_index:] if start_index is not None else pd.DataFrame()
    # Remove columns where all values are empty strings or whitespace
    cleaned_table = df.loc[:, ~(df.iloc[1:].apply(lambda col: (col.astype(str) == "None").all()))]
    cleaned_table.columns = range(cleaned_table.shape[1])
    return cleaned_table

# Functions for handling test cases and transformations
def extract_dataframe_from_pdf_ocr(page_path, table_settings):
    pdf = pdfplumber.open(page_path)
    df_total = pd.DataFrame()
    # text = extract_text_from_pdf(unlocked_pdf_path)

    for i in range(len(pdf.pages)):
        p0 = pdf.pages[i]
        table = p0.extract_table(table_settings)
        # new_table = clean_table(pd.DataFrame(table))
        df_total = df_total._append(table, ignore_index=True)
        df_total.replace({r"\n": " "}, regex=True, inplace=True)
        print(f"on page:{i}/{len(pdf.pages)}")
    w = df_total.copy()
    # rage_path = pdf_path.split(".")[0]
    # w.to_excel(f"raw_dataframe_{rage_path}.xlsx")
    df = cut_the_datframe_from_headers(w)
    return df

def extract_dataframe_from_full_pdf(pdf_path):
    pdf = pdfplumber.open(pdf_path)
    df_total = pd.DataFrame()
    # text = extract_text_from_pdf(unlocked_pdf_path)

    for i in range(len(pdf.pages)):
        p0 = pdf.pages[i]
        table = p0.extract_table()
        df_total = df_total._append(table, ignore_index=True)
        df_total.replace({r"\n": " "}, regex=True, inplace=True)
    w = df_total.drop_duplicates()

    return w

def cut_the_datframe_from_headers(df):
    date_pattern = re.compile(r'\b(date|value date|value)\b', re.IGNORECASE)
    balance_pattern = re.compile(r'\b(balance|total amount)\b', re.IGNORECASE)

    crop_index = None

    # Iterate over the rows to check for keywords
    for index, row in df.iterrows():
        text = str(row).strip()
        if date_pattern.search(text) and balance_pattern.search(text):
            crop_index = index
            break

    # If no row with both date and balance keywords found, check for balance keywords first
    # if crop_index is None:
    #     for index, row in df.iterrows():
    #         text = str(row).strip()
    #         if balance_pattern.search(text):
    #             crop_index = index
    #             break

    # If a suitable crop_index is found, remove rows above it
    if crop_index is not None:
        df = df.loc[crop_index:].reset_index(drop=True)

    return df


def validate_bank_statement_returns_error_message_ocr(df, tolerance=2, raise_error=True):
    """
    Validates a bank statement by checking that each row's balance matches
    the previous balance +/- credit/debit. It unconditionally ignores any
    mismatch found on the final row.

    Args:
        df (pd.DataFrame): DataFrame with columns 'Date', 'Credit', 'Debit', 'Balance'.
        tolerance (float, optional): Maximum allowed difference for a balance to be considered a match. Defaults to 2.
        raise_error (bool, optional): Whether to generate an error message string on mismatch. Defaults to True.

    Returns:
        str: An error message if a mismatch is found on any row BEFORE the last.
             Returns an empty string if the statement is valid or if the only
             mismatch occurs on the final row.
    """
    validated_df = df.copy()
    error_message = ""

    # --- Data Cleaning ---
    for col in ['Credit', 'Debit', 'Balance']:
        if validated_df[col].dtype == 'object':
            validated_df[col] = validated_df[col].astype(str).str.replace('[$£€,]', '', regex=True).str.strip()
            validated_df[col] = pd.to_numeric(validated_df[col], errors='coerce').fillna(0)

    # --- Initialization ---
    validated_df['Expected_Balance'] = 0.0
    validated_df['Match'] = False
    validated_df['Sign_Error'] = False
    validated_df['Difference'] = 0.0

    if len(validated_df) == 0:
        return ""

    validated_df.loc[0, 'Expected_Balance'] = validated_df.loc[0, 'Balance']
    validated_df.loc[0, 'Match'] = True
    true_expected_balance = validated_df.loc[0, 'Balance']

    # --- Validation Loop ---
    for i in range(1, len(validated_df)):
        credit = validated_df.loc[i, 'Credit']
        debit = validated_df.loc[i, 'Debit']
        actual_balance = validated_df.loc[i, 'Balance']
        description = validated_df.loc[i, 'Description'] if 'Description' in validated_df.columns else 'N/A'
        date = validated_df.loc[i, 'Value Date'] if 'Value Date' in validated_df.columns else validated_df.loc[i, 'Date']

        true_expected_balance = round((true_expected_balance + credit - debit), 2)
        actual_balance = round(actual_balance, 2)
        
        validated_df.loc[i, 'Expected_Balance'] = true_expected_balance
        difference = abs(true_expected_balance - actual_balance)
        validated_df.loc[i, 'Difference'] = difference

        is_last_row = (i == len(validated_df) - 1)

        # --- Validation Logic ---
        if difference <= tolerance:
            validated_df.loc[i, 'Match'] = True
        elif is_last_row:
            # Unconditionally treat the last row as a match, ignoring any difference.
            validated_df.loc[i, 'Match'] = True
            validated_df.loc[i, 'Sign_Error'] = False
        elif abs(abs(true_expected_balance) - abs(actual_balance)) <= tolerance and true_expected_balance * actual_balance <= 0:
            validated_df.loc[i, 'Match'] = False
            validated_df.loc[i, 'Sign_Error'] = True
        else:
            # It's a genuine mismatch on a row before the end.
            validated_df.loc[i, 'Match'] = False
            if raise_error and not error_message: # Only capture the *first* error found
                error_message = (f"Balance mismatch at row {i} (Date: {date}): "
                                 f"for Description '{description}'; "
                                 f"Expected balance {true_expected_balance}, "
                                 f"Actual balance {actual_balance}. "
                                 f"Difference: {difference:.2f}")

    return error_message


def model_for_pdf_ocr(df):
    # Simulate cleaning or processing the dataframe
    # print(f"Modeling dataframe: {df}")
    print("Modeling dataframe with the new mode for PDF extraction...")
    df = cut_the_datframe_from_headers(df)
    print(df.head(10))
    date_column = [extract_date_col_from_df(df)[0]]

    print("Date Column is:", date_column)
    # numeric_columns_list = extract_numeric_col_from_df(df)
    # print(numeric_columns_list)
    description_column = find_desc_column(df, [f"{date_column}"])
    description_column = [description_column[0]]
    # description_column = [3]
    print("Description Column is:", description_column)

    bal_column = find_balance_column(df, description_column, date_column)
    bal_column = [bal_column[0]]
    # bal_column = [7]
    print("Balance Column is:", bal_column)

    deb_column = find_debit_column(df, description_column, date_column, bal_column)
    # deb_column = [4]
    print("Debit Column is:", deb_column)
    cred_column = find_credit_column(df, description_column, date_column, bal_column)
    # cred_column = [6]
    print("Credit Column is:", cred_column)

    lists = [date_column, description_column, deb_column, cred_column, bal_column]

    # Check and remove common element from "Credit Column" and "Debit Column"
    if len(lists[2]) == 2 and len(lists[3]) == 2:
        common_element = set(lists[2]).intersection(lists[3])
        if common_element:
            common_element = common_element.pop()
            lists[2].remove(common_element)
            lists[3].remove(common_element)

    new_lists = [
        list(dict.fromkeys(col)) if isinstance(col, list) else col for col in lists
    ]

    # Column names
    new_columns = ["Value Date", "Description", "Debit", "Credit", "Balance"]
    # Create new_df from new_lists
    selected_columns = [df.iloc[:, col[0]] for col in new_lists]
    new_df = pd.DataFrame(
        {new_columns[i]: selected_columns[i] for i in range(len(new_columns))}
    )

    if deb_column[0] == cred_column[0]:
        print("Credit and Debit are in the same column.")
        result = credit_debit(df, description_column, date_column, bal_column, deb_column[0])
        final_df = cleaning(result)
    else:
        final_df = cleaning(new_df)

    if final_df.empty:
        raise ValueError(
            "Empty DF returned from extraction"
        )

    print(final_df.head(10))

    return final_df, lists

def new_mode_for_pdf(df, lists):
    print(df.head(20))
    # Check and remove common element from "Credit Column" and "Debit Column"
    if len(lists[2]) == 2 and len(lists[3]) == 2:
        common_element = set(lists[2]).intersection(lists[3])
        if common_element:
            common_element = common_element.pop()
            lists[2].remove(common_element)
            lists[3].remove(common_element)

    new_lists = [
        list(dict.fromkeys(col)) if isinstance(col, list) else col for col in lists
    ]

    # Column names
    new_columns = ["Value Date", "Description", "Debit", "Credit", "Balance"]
    # Create new_df from new_lists
    selected_columns = [df.iloc[:, col[0]] for col in new_lists]
    new_df = pd.DataFrame(
        {new_columns[i]: selected_columns[i] for i in range(len(new_columns))}
    )

    if lists[2][0] == lists[3][0]:
        print("Credit and Debit are in the same column.")
        result = credit_debit(df, lists[1], lists[0], lists[4], lists[2][0])
        final_df = cleaning(result)
    else:
        final_df = cleaning(new_df)
    print("Extraction is Over !!!!!!!!!!!")
    return final_df

def old_bank_extraction(page_path):
    # Simulate old bank extraction process with the PDF page path
    print(f"Performing old bank extraction on {page_path}")
    pass

# Function to add column separators (optimized to avoid file I/O)
def add_column_separators_in_memory(page):
    CA_ID = "1234_temp"
    # Simulate adding column separators to the in-memory page
    output_pdf, coordinates, llama = process_pdf_and_annotate(page, os.path.join(TEMP_SAVED_PDF_DIR,
                                                                                      f"{CA_ID}_only_columns_add_{uuid.uuid4().hex}.pdf"))
    return output_pdf, coordinates, llama  # Return the modified page and coordinates

def add_column_separators_with_coordinates(pdf_path, coordinates):
    CA_ID = "1234_temp"
    pdf_document = fitz.open(pdf_path)
    llama_2 = annotate_pdf(pdf_document, coordinates)
    processed_pdf_path = os.path.join(TEMP_SAVED_PDF_DIR,
                                      f"{CA_ID}_columns_adding_with_coordinates_{uuid.uuid4().hex}.pdf")
    pdf_document.save(processed_pdf_path)
    return processed_pdf_path, llama_2

# Optimized test case A
def run_test_case_A(page, explicit_lines):
    print("Running Test Case A with explicit lines:", explicit_lines)
    print("Page content:", page)

    try:
        if not explicit_lines:
            df = extract_dataframe_from_pdf_ocr(page, table_settings={
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "edge_min_length": 20,
            })
            model_df, lists = model_for_pdf_ocr(df)  # Process the DataFrame
            # model_df = validate_bank_statement(model_df)
            return model_df, lists  # No coordinates for Test Case A
        else:
            df = extract_dataframe_from_pdf_ocr(page, table_settings={
                "vertical_strategy": "explicit",
                "explicit_vertical_lines": explicit_lines,
                "horizontal_strategy": "lines",
                "intersection_x_tolerance": 200,
            })
            model_df, lists = model_for_pdf_ocr(df)
            # model_df = validate_bank_statement(model_df)# Process the DataFrame
            return model_df, lists  # No coordinates for Test Case A

    except Exception as e:
        print(f"Test Case A failed: {e}")
        return None, None

# Optimized test case B
def run_test_case_B(page_with_rows_added, explicit_lines):
    try:
        if not explicit_lines:
            df = extract_dataframe_from_pdf_ocr(page_with_rows_added, table_settings={
                "vertical_strategy": "lines",
                "horizontal_strategy": "text",
                "edge_min_length": 20,
                "intersection_x_tolerance": 200
            })
            print(df.head(20))
            model_df, lists = model_for_pdf_ocr(df)  # Process the DataFrame
            # model_df = validate_bank_statement(model_df)
            return model_df, lists  # No coordinates for Test Case A
        else:
            df = extract_dataframe_from_pdf_ocr(page_with_rows_added, table_settings={
                "vertical_strategy": "explicit",
                "explicit_vertical_lines": explicit_lines,
                "horizontal_strategy": "text",
                "intersection_x_tolerance": 200
            })
            print(df.head(20))
            model_df, lists = model_for_pdf_ocr(df)
            # model_df = validate_bank_statement(model_df)
            return model_df, lists  # No coordinates for Test Case B
    except Exception as e:
        print(f"Test Case B failed: {e}")
        return None, None

# Optimized test case C
def run_test_case_C(page_with_columns_added, explicit_lines):
    try:
        df = extract_dataframe_from_pdf_ocr(page_with_columns_added, table_settings={
            "vertical_strategy": "explicit",
            "explicit_vertical_lines": explicit_lines,
            "horizontal_strategy": "lines",
            "intersection_x_tolerance": 200
        })
        model_df, lists = model_for_pdf_ocr(df)
        # model_df = validate_bank_statement(model_df)
        return model_df, lists  # Return coordinates for Test Case C
    except Exception as e:
        print(f"Test Case C failed: {e}")
        return None, None

# Optimized test case D
def run_test_case_D(page_with_rows_n_columns_added, explicit_lines):
    try:
        df = extract_dataframe_from_pdf_ocr(page_with_rows_n_columns_added, table_settings={
            "vertical_strategy": "explicit",
            "explicit_vertical_lines": explicit_lines,
            "horizontal_strategy": "text",
            "intersection_x_tolerance": 200,
        })
        model_df, lists = model_for_pdf_ocr(df)
        # model_df = validate_bank_statement(model_df)
        return model_df, lists  # Return coordinates for Test Case C
    except Exception as e:
        print(e)
        print(f"Test Case D failed: {e}")
        return None, None

def run_test_case_E(bank, pdf_path, timestamp, CA_ID):
    lists = 0
    df = pd.DataFrame()
    # df = customer.custom_extraction(bank, pdf_path, 0, timestamp)
    return df, lists

def image_with_ocr_to_pdf_dynamic_font(
    image_path: str,
    ocr_boxes: list[dict],
    horizontal_lines: list,
    vertical_lines: list,
    doc=None,
    fontname: str = "helv",
    font_scale: float = 1.0,
    min_fontsize: float = 1.0,
    image_quality: int = 90,
    dpi: int = 300,
    force_a4: bool = True,
):
    """
    Force-fit the image into A4 (or use dpi-based size), *without* distortion,
    and overlay the OCR boxes in exactly the right spots.
    """
    img = Image.open(image_path)
    w_px, h_px = img.size

    if force_a4:
        target_w_pt, target_h_pt = 595.0, 842.0
        scale = min(target_w_pt / w_px, target_h_pt / h_px)
        offset_x = (target_w_pt - w_px * scale) / 2
        offset_y = (target_h_pt - h_px * scale) / 2
        page_w, page_h = target_w_pt, target_h_pt
    else:
        scale = 72.0 / dpi
        offset_x = offset_y = 0
        page_w, page_h = w_px * scale, h_px * scale

    if doc is None:
        doc = fitz.open()
    page = doc.new_page(width=page_w, height=page_h)

    # insert image stretched *uniformly*
    pix = fitz.Pixmap(image_path)
    img_rect = fitz.Rect(offset_x, offset_y,
                         offset_x + w_px*scale,
                         offset_y + h_px*scale)
    page.insert_image(img_rect, pixmap=pix, overlay=False)

    # lines must also use (x*scale+offset_x, y*scale+offset_y)
    if horizontal_lines:
        page = add_horizontal_lines_to_page(page, horizontal_lines, img_rect, h_px)
    if vertical_lines:
        page = add_vertical_lines_to_page(page, vertical_lines, scale, offset_x)

    page.wrap_contents()

    for box in ocr_boxes:
        x0 = box["x"] * scale + offset_x
        y0 = box["y"] * scale + offset_y
        x1 = (box["x"] + box["w"]) * scale + offset_x
        y1 = (box["y"] + box["h"]) * scale + offset_y
        rect = fitz.Rect(x0, y0, x1, y1)

        # debug rectangle
        annot = page.add_rect_annot(rect)
        annot.set_colors(stroke=(1, 0, 0))
        annot.set_border(width=0.5)
        annot.update()

        fontsize = (box["h"] * scale) * font_scale
        while fontsize >= min_fontsize:
            rc = page.insert_textbox(
                rect,
                box["text"],
                fontsize=fontsize,
                fontname=fontname,
                align=fitz.TEXT_ALIGN_CENTER,
                render_mode=3,
                overlay=True
            )
            if rc >= 0:
                break
            fontsize -= 0.5

        if rc < 0:
            print(f"Warning: box didn’t fit: {box}")

    return doc

def vertical_lines_detection(image_path, min_line_height_ratio=0.20, line_width_range=(1, 5)):
    """
    Enhanced vertical line detection optimized for bank statements and grids

    Parameters:
    image_path (str): Path to the input image file
    min_line_height_ratio (float): Minimum height ratio compared to image height (default 0.20)
    line_width_range (tuple): Min and max width for vertical lines in pixels

    Returns:
    list: List of vertical lines as (x, y, w, h)
    """
    # Read the image
    image = cv2.imread(image_path)
    img_height = image.shape[0]

    if image is None:
        raise ValueError(f"Could not read image: {image_path}")
    
    print(f"Processing image for vertical line detection: {image_path}")

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Image dimensions
    img_height, img_width = image.shape[:2]

    # Create a binary image optimized for vertical lines
    binary_v = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                    cv2.THRESH_BINARY_INV, 15, 2)

    # Create multiple vertical kernels for better line detection with more variety
    v_kernel_sizes = [
        int(img_height * 0.03),  # 3% of image height (for short lines)
        int(img_height * 0.07),  # 7% of image height
        int(img_height * 0.10),  # 10% of image height (original value)
        int(img_height * 0.15)   # 15% of image height (for longer lines)
    ]

    # Process with multiple kernel sizes and combine results
    vertical_binary_results = []

    for kernel_size in v_kernel_sizes:
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_size))

        # Process with morphological operations - use more iterations for thinner lines
        temp_v = cv2.erode(binary_v, vertical_kernel, iterations=1)

        # Use different dilation iterations based on kernel size
        iteration_count = 1
        if kernel_size <= int(img_height * 0.05):  # For smaller kernels
            iteration_count = 2  # More aggressive dilation to capture thin/broken lines

        v_result = cv2.dilate(temp_v, vertical_kernel, iterations=iteration_count)

        # Clean up with a small opening
        small_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3))
        v_result = cv2.morphologyEx(v_result, cv2.MORPH_OPEN, small_kernel)

        vertical_binary_results.append(v_result)

    # Combine all vertical detection results
    vertical_lines_img = vertical_binary_results[0]
    for res in vertical_binary_results[1:]:
        vertical_lines_img = cv2.bitwise_or(vertical_lines_img, res)

    # Additional morphological operations to connect nearby line segments
    connect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 10))
    vertical_lines_img = cv2.morphologyEx(vertical_lines_img, cv2.MORPH_CLOSE, connect_kernel)

    # Find contours of vertical lines
    contours, _ = cv2.findContours(
        vertical_lines_img,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    # Filter and process vertical lines with more relaxed criteria
    min_height = img_height * min_line_height_ratio
    min_width, max_width = line_width_range

    # Collect all potential vertical lines
    potential_v_lines = []

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)

        # More relaxed width criteria
        if min_width <= w <= max_width * 3:  # Tripled max width to catch merged lines
            # More relaxed height range
            if h >= min_height * 0.6:  # Even more reduced height requirement - catches shorter lines
                # Calculate confidence based on height and pixel density
                roi = vertical_lines_img[y:y+h, x:x+w]
                pixel_density = cv2.countNonZero(roi) / (w * h)

                # Height relative to image height
                height_ratio = h / img_height

                # Calculate confidence (higher is better)
                # Weight pixel density more - this helps with faint lines
                confidence = (pixel_density * 0.7) + (height_ratio * 0.3)

                potential_v_lines.append((x, y, w, h, confidence))

    # Sort by x-coordinate to process from left to right
    potential_v_lines.sort(key=lambda x: x[0])

    # Process lines with smarter duplicate detection
    last_x = -100  # Initialize with a value that won't match any line
    vertical_lines = []

    for x, y, w, h, conf in potential_v_lines:
        # Check if this line is too close to the last added line
        if x - last_x > w * 2:  # Slightly reduced separation requirement
            # Accept lower confidence threshold to catch more lines
            if conf > 0.2 or x - last_x > 15:
                vertical_lines.append((x, y, w, h))
                last_x = x

    adjusted_vertical_lines = [(x, 0, w, img_height) for (x, y, w, h) in vertical_lines]
    return adjusted_vertical_lines


# def horizontal_lines_detection(image_path, min_line_width_ratio=0.3, line_height_range=(1, 5)):
#     """
#     Enhanced horizontal line detection optimized for bank statements and grids

#     Parameters:
#     image_path (str): Path to the input image file
#     min_line_width_ratio (float): Minimum width ratio compared to image width (default 0.3)
#     line_height_range (tuple): Min and max height for horizontal lines in pixels

#     Returns:
#     list: List of horizontal lines as (x, y, w, h)
#     """
#     # Read the image
#     image = cv2.imread(image_path)
#     if image is None:
#         raise ValueError(f"Could not read image: {image_path}")

#     # Convert to grayscale
#     gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

#     # Image dimensions
#     img_height, img_width = image.shape[:2]

#     # Apply adaptive thresholding to get a binary image
#     binary_h = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
#                                     cv2.THRESH_BINARY_INV, 15, 2)

#     # Create multiple horizontal kernels for better line detection
#     h_kernel_sizes = [
#         int(img_width * 0.05),  # 5% of image width
#         int(img_width * 0.1),   # 10% of image width
#         int(img_width * 0.15)   # 15% of image width
#     ]

#     # Process with multiple kernel sizes and combine results
#     horizontal_binary_results = []

#     for kernel_size in h_kernel_sizes:
#         horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, 1))

#         # Process with morphological operations
#         temp_h = cv2.erode(binary_h, horizontal_kernel, iterations=1)
#         h_result = cv2.dilate(temp_h, horizontal_kernel, iterations=1)

#         # Clean up with a small opening
#         small_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 1))
#         h_result = cv2.morphologyEx(h_result, cv2.MORPH_OPEN, small_kernel)

#         horizontal_binary_results.append(h_result)

#     # Combine all horizontal detection results
#     horizontal_lines_img = horizontal_binary_results[0]
#     for res in horizontal_binary_results[1:]:
#         horizontal_lines_img = cv2.bitwise_or(horizontal_lines_img, res)

#     # Find contours
#     contours, _ = cv2.findContours(
#         horizontal_lines_img,
#         cv2.RETR_EXTERNAL,
#         cv2.CHAIN_APPROX_SIMPLE
#     )

#     # Filter and process horizontal lines
#     min_width = img_width * min_line_width_ratio
#     min_height, max_height = line_height_range

#     # Collect all potential horizontal lines
#     potential_h_lines = []

#     for cnt in contours:
#         x, y, w, h = cv2.boundingRect(cnt)

#         # More relaxed width criteria
#         if w > min_width * 0.5:  # Reduced from original
#             # More relaxed height range
#             if min_height <= h <= max_height * 2:  # Double the max height
#                 # Calculate confidence
#                 roi = horizontal_lines_img[y:y+h, x:x+w]
#                 pixel_density = cv2.countNonZero(roi) / (w * h)

#                 # Width relative to image width
#                 width_ratio = w / img_width

#                 # Calculate confidence (higher is better)
#                 confidence = pixel_density * width_ratio

#                 potential_h_lines.append((x, y, w, h, confidence))

#     # Sort by y-coordinate to process from top to bottom
#     potential_h_lines.sort(key=lambda x: x[1])

#     # Process lines with smarter duplicate detection
#     last_y = -100  # Initialize with a value that won't match any line
#     horizontal_lines = []

#     for x, y, w, h, conf in potential_h_lines:
#         # Check if this line is too close to the last added line
#         if y - last_y > h * 2:  # Ensure minimum vertical separation
#             # Only consider high confidence or sufficiently separated lines
#             if conf > 0.3 or y - last_y > 20:
#                 horizontal_lines.append((x, y, w, h))
#                 last_y = y

#     return horizontal_lines

def horizontal_lines_detection(image_path, min_line_width_ratio=0.4, y_grouping_threshold=5):
    """
    Detects horizontal lines using morphological operations and finds their precise
    center using centroids for accurate alignment.

    Parameters:
    image_path (str): Path to the input image file.
    min_line_width_ratio (float): Minimum width of a line as a ratio of image width.
    y_grouping_threshold (int): Pixel distance to group nearby horizontal lines.

    Returns:
    list: A list of unique y-coordinates for the detected horizontal lines.
    """
    # Read the image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    # Convert to grayscale and invert for morphological operations
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    img_height, img_width = gray.shape
    
    # Use a binary threshold. This can be more stable than adaptive for some backgrounds.
    # We are looking for dark lines on a light background.
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)

    # --- MORPHOLOGICAL OPERATIONS TO ISOLATE HORIZONTAL LINES ---
    # Create a long horizontal kernel
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (int(img_width * 0.1), 1))
    
    # Use MORPH_OPEN to remove noise and isolate horizontal line shapes
    detected_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)

    # Find contours of the resulting line shapes
    contours, _ = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return []

    # --- CALCULATE CENTROIDS AND GROUP LINES ---
    detected_y_coords = []
    min_width = img_width * min_line_width_ratio

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        # Filter out contours that are not wide enough
        if w > min_width:
            # Calculate moments to find the centroid
            M = cv2.moments(cnt)
            # Ensure the contour has area to avoid division by zero
            if M["m00"] != 0:
                # Calculate the y-coordinate of the centroid (the true center)
                cY = int(M["m01"] / M["m00"])
                detected_y_coords.append(cY)

    if not detected_y_coords:
        return []

    # Group very close y-coordinates to merge duplicate detections of the same line
    detected_y_coords.sort()
    
    unique_lines_y = []
    current_group = [detected_y_coords[0]]

    for y in detected_y_coords[1:]:
        if abs(y - current_group[-1]) < y_grouping_threshold:
            current_group.append(y)
        else:
            unique_lines_y.append(np.mean(current_group))
            current_group = [y]
    
    if current_group:
        unique_lines_y.append(np.mean(current_group))

    return unique_lines_y

def new_enhance_image_contrast(image,
                              clip_limit: float = 9.0,
                              tile_grid_size: tuple = (4, 4),
                              jpeg_quality: int = 90,
                              dpi: int = 250):
    """
    Combine CLAHE-based contrast enhancement with JPEG compression
    to both sharpen faint text (even under watermarks) and
    attenuate remaining watermark artifacts.

    Args:
        image (np.ndarray): Input BGR image (as from cv2.imread).
        clip_limit (float): CLAHE clip limit. Higher => more contrast. Default=5.0.
        tile_grid_size (tuple): CLAHE tile grid size. Default=(4,4).
        jpeg_quality (int): Pillow JPEG quality (1-100). Lower => more artifacting.
        dpi (int): DPI metadata for the JPEG (doesn't affect pixel data).

    Returns:
        np.ndarray: Enhanced BGR image suitable for OCR.
    """
    # 1. Convert to grayscale and apply CLAHE
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=clip_limit,
                            tileGridSize=tile_grid_size)
    enhanced = clahe.apply(gray)  # boosts local contrast :contentReference[oaicite:0]{index=0}

    # 2. Convert back to BGR so downstream code expecting 3‐channels still works
    enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    # 3. Quick JPEG “denoise” via Pillow to help suppress faint watermarks
    #    (the compression step tends to blur very low‐contrast background patterns) :contentReference[oaicite:1]{index=1}
    pil_img = Image.fromarray(cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf,
                 format='JPEG',
                 quality=jpeg_quality,
                 optimize=True,
                 dpi=(dpi, dpi))
    buf.seek(0)
    optimized = Image.open(buf)

    # 4. Convert back to OpenCV BGR
    final = cv2.cvtColor(np.array(optimized), cv2.COLOR_RGB2BGR)
    return final

def detect_and_split_boxes(det_results, vertical_lines, encoded_pdf):
    """
    Detect text boxes and split them at vertical lines without recognition

    Parameters:
    image_path (str): Path to the input image
    enhance_path (str): Path to the enhanced image
    detect_lines_func (function): Function to detect vertical lines

    Returns:
    tuple: (split_text_boxes, vertical_lines)
    """

    if encoded_pdf:
        return det_results

    # Process detection results
    split_text_boxes = []

    # Process detection-only results
    for idx in range(len(det_results)):
        boxes = det_results[idx]
        for points in boxes:
            # Convert points to rectangle
            x_coords = [point[0] for point in points]
            y_coords = [point[1] for point in points]
            x = min(x_coords)
            y = min(y_coords)
            w = max(x_coords) - x
            h = max(y_coords) - y

            box = {
                'x': int(x),
                'y': int(y),
                'w': int(w),
                'h': int(h),
                'points': points,  # Keep original points for reference
                'text': "",  # Will be filled in by recognition step
                'confidence': 0.0  # Will be filled in by recognition step
            }

            # Check if this box intersects with any vertical line
            intersecting_lines = []
            for line_idx, (line_x, line_y, line_w, line_h) in enumerate(vertical_lines):
                # Calculate the center of the line
                line_center_x = line_x + line_w // 2

                # Check if the vertical line intersects with the box horizontally
                if box['x'] < line_center_x < (box['x'] + box['w']):
                    # Check if the line and box overlap vertically
                    if (line_y < (box['y'] + box['h']) and (line_y + line_h) > box['y']):
                        # Add this line as intersecting
                        intersecting_lines.append((line_idx, line_center_x))

            # If no intersections, add the box as is
            if not intersecting_lines:
                split_text_boxes.append(box)
                continue

            # We have intersections, so we need to split this box
            # Sort intersecting lines by x-coordinate
            intersecting_lines.sort(key=lambda line: line[1])

            # Process each split iteratively
            current_x = box['x']

            for split_idx, (_, line_x) in enumerate(intersecting_lines):
                # Calculate width of this segment
                segment_width = line_x - current_x

                # Create a box for the left segment
                if segment_width > 0:
                    split_text_boxes.append({
                        'x': current_x,
                        'y': box['y'],
                        'w': segment_width,
                        'h': box['h'],
                        'points': None,  # Original points no longer valid
                        'text': "",  # Will be filled in by recognition step
                        'confidence': 0.0,  # Will be filled in by recognition step
                        'split': True,
                        'split_idx': split_idx
                    })

                # Update for the next iteration
                current_x = line_x

            # Add the final segment
            final_width = (box['x'] + box['w']) - current_x
            if final_width > 0:
                split_text_boxes.append({
                    'x': current_x,
                    'y': box['y'],
                    'w': final_width,
                    'h': box['h'],
                    'points': None,  # Original points no longer valid
                    'text': "",  # Will be filled in by recognition step
                    'confidence': 0.0,  # Will be filled in by recognition step
                    'split': True,
                    'split_idx': len(intersecting_lines)
                })

    return split_text_boxes

def detect_and_split_boxes_new(det_page, vertical_lines, encoded_pdf: bool = False):
    """
    Slice every text-detection box at the supplied vertical rules.

    Parameters
    ----------
    det_page      : dict
        Single-page result from TextDetection()
        Must contain keys: 'dt_polys' (N×4×2 int array) and
        'dt_scores' (list of floats, len N).
    vertical_lines: list[(x, y, w, h)]
        Coordinates of vertical rulers already detected in the same image.
    encoded_pdf   : bool, default False
        If the PDF already carries selectable text, no splitting is required.

    Returns
    -------
    List[Box]
        A flat list of dictionaries; each represents either an untouched
        detection or a fragment created by splitting.  Keys:

        x, y, w, h      : int  – axis-aligned bounding rectangle
        points          : list – original quad vertices (None for fragments)
        confidence      : float
        text            : str  – recogniser will fill later
        split           : bool – True if this is a fragment
        split_idx       : int  – order of fragment within parent (0-n, left→right)
        parent_idx      : int  – index of the original polygon in det_page['dt_polys']
    """
    # ------------------------------------------------------------------ fast-exit
    if encoded_pdf:
        # caller can keep working with original detection output unchanged
        return det_page

    # ------------------------------------------------------------------ normalise
    poly_arr = det_page["dt_polys"].astype(int)       # (N, 4, 2)
    scores = list(map(float, det_page["dt_scores"]))  # (N,)

    split_boxes: List[Box] = []

    # ------------------------------------------------------------------ main loop
    for idx, (poly, sc) in enumerate(zip(poly_arr, scores)):
        xs, ys = poly[:, 0], poly[:, 1]
        x0, y0 = int(xs.min()), int(ys.min())
        w, h = int(xs.max() - xs.min()), int(ys.max() - ys.min())

        # identify rulers that bisect this rectangle
        crossings = [
            (ln_idx, lx + lw // 2)
            for ln_idx, (lx, ly, lw, lh) in enumerate(vertical_lines)
            if x0 < lx + lw // 2 < x0 + w and ly < y0 + h and ly + lh > y0
        ]

        # ................................................ no crossings → keep box
        if not crossings:
            split_boxes.append(
                {
                    "x": x0,
                    "y": y0,
                    "w": w,
                    "h": h,
                    "points": poly.tolist(),
                    "confidence": sc,
                    "text": "",
                }
            )
            continue

        # ................................................ crossings → split box
        crossings.sort(key=lambda t: t[1])  # left → right
        cur_x = x0

        for seg_idx, (_, cx) in enumerate(crossings):
            seg_w = cx - cur_x
            if seg_w > 0:
                split_boxes.append(
                    {
                        "x": cur_x,
                        "y": y0,
                        "w": seg_w,
                        "h": h,
                        "points": None,
                        "confidence": sc,
                        "split": True,
                        "split_idx": seg_idx,
                        "parent_idx": idx,
                        "text": "",
                    }
                )
            cur_x = cx

        # right-most fragment
        right_w = x0 + w - cur_x
        if right_w > 0:
            split_boxes.append(
                {
                    "x": cur_x,
                    "y": y0,
                    "w": right_w,
                    "h": h,
                    "points": None,
                    "confidence": sc,
                    "split": True,
                    "split_idx": len(crossings),
                    "parent_idx": idx,
                    "text": "",
                }
            )

    return split_boxes

def recognize_text_in_boxes(image, boxes):
    """
    Batch-recognise the text inside `boxes` on `image`.

    Parameters
    ----------
    image : np.ndarray (H×W×3 BGR)
    boxes : list of dicts with keys x, y, w, h
    ocr_rec : a pre-initialised PaddleOCR object
              with det=False, rec=True, cls=False

    Returns
    -------
    list[dict]  -- boxes enriched with 'text' and 'confidence'
    """
    crops, meta = [], []

    start_time = time.time()

    print("Starting RECOGNITIO**************************************************N processing...")

    # print("boxes:", boxes)
    # print("image shape:", image)

    # 1️⃣ collect ROIs in RAM (no cv2.imwrite)
    for b in boxes:
        # print("Processing box:", b)
        x0, y0, x1, y1 = b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']
        # print("x0, y0, x1, y1:", x0, y0, x1, y1)
        roi = image[y0:y1, x0:x1]
        # print("roi shape:", roi)

        # skip empty / very small crops
        if roi.size == 0 or roi.shape[0] < 5 or roi.shape[1] < 5:
            b.update(text='', confidence=0.0)
            continue

        crops.append(roi)
        meta.append(b)

    if not crops:                       # nothing to do
        return boxes

    # 2️⃣ single batched call (Paddle handles rec_batch_num)
    #    det=False & cls=False keep it strictly recogniser-only

    start = time.time()
    print("Starting recognition on crops...")
    rec_results = rec_model_mobile.predict(crops) ##############################################################################################
    end = time.time()
    print(f"Time taken for recognition: {end - start:.2f} seconds")

    # print("Recognition results:", rec_results)

    # 3️⃣ unpack results back into their boxes
    for b, res in zip(meta, rec_results):
        # each res looks like [[txt, score]]
        txt, score = res['rec_text'], res['rec_score']
        b.update(text=txt, confidence=score)

    return boxes

def returns_doc_according_to_columns(images_path, detected_original_bboxs, vertical_lines, horizontal_lines, encoded_pdf, first_page):
   """
   Returns a document with columns added based on the test case.
   This function is a placeholder and should be replaced with actual logic.
   """
   output_folder = "temp_pdfs"
   os.makedirs(output_folder, exist_ok=True)
   output_pdf = os.path.join(TEMP_SAVED_PDF_DIR, f"ocr_output_{uuid.uuid4().hex}.pdf")
   doc = fitz.open()

   if first_page:
      print("Processing first page with detected boxes")
      images_path = [images_path[0]]
      detected_original_bboxs = [detected_original_bboxs[0]]
          
   print("len detected:", len(detected_original_bboxs))

   i = 0
   for i in range(len(images_path)):

      print(f"Processing  ----------- page {i} with detected boxes")

      # 1. First detect and split boxes (no recognition yet)
      split_boxes = detect_and_split_boxes_new(detected_original_bboxs[i], vertical_lines, encoded_pdf)

      print("step one passed: boxes are split")

      # 2. Now run text recognition on the split boxes
      text_boxes = recognize_text_in_boxes(images_path[i], split_boxes)

      print("step two passed: text recognition done")

      image_path = images_path[i]  # Use the first page image directly
    #   print("pdf to images:", image_path)
      enhanced_image = new_enhance_image_contrast(image_path)
      enhanced_path = os.path.join(TEMP_SAVED_PDF_DIR, f"temp_enhanced_{i}_is_{uuid.uuid4().hex}.jpg")
      cv2.imwrite(enhanced_path, enhanced_image)
      print(f"Enhanced image {i} saved at:", enhanced_path)

      if first_page:
        enhanced_new_path = save_first_page_numpy_to_image(enhanced_image)
      else:
        enhanced_new_path = enhanced_path

      horizontal_lines = horizontal_lines_detection(enhanced_new_path)  # Detect horizontal lines
      print(f"Detected horizontal lines for page {i}: {horizontal_lines}")
   
      # 3. Add this page to our document
      doc = image_with_ocr_to_pdf_dynamic_font(enhanced_new_path, text_boxes, horizontal_lines, vertical_lines,
                                                doc=doc,  # Pass the existing document
                                                )
      
      print(f"step three passed: page no {i} added to document")
      
      i += 1
   
   # 4. Save the document to a temporary file
   if doc:
         doc.save(
            output_pdf,
            garbage=3,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=False
         )
         doc.close()

   return output_pdf

def save_first_page_numpy_to_image(array):
   output_path = os.path.join(TEMP_SAVED_PDF_DIR, f"first_page_image_{uuid.uuid4().hex}.png")
   # OpenCV saves in BGR format, so convert RGB -> BGR
   img_bgr = cv2.cvtColor(array, cv2.COLOR_RGB2BGR)
   cv2.imwrite(output_path, img_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 0])  # 0 = highest quality for PNG
   return output_path


def process_pdf_with_test_cases(pdf_to_images, detected_original_bboxs, encoded_pdf):
   # Create new PDF document with compression settings
   horizontal_lines = [] # Placeholder for horizontal lines, if needed
   
   ###-------------------------FOR DETECTION OF VERTICAL LINES WHERE ITS REALLY PRESENT------------------------------###

   # image_path = save_first_page_numpy_to_image(pdf_to_images[0]) #get the first 2 pages of the scanned pdf
   image_path = pdf_to_images[0]  # Use the first page image directly
   # print("pdf to images:", image_path)
   enhanced_image = new_enhance_image_contrast(image_path)
#    enhanced_path = "temp_enhanced.jpg"
   enhanced_path = os.path.join(TEMP_SAVED_PDF_DIR, f"temp_enhanced_is_{uuid.uuid4().hex}.jpg")

   cv2.imwrite(enhanced_path, enhanced_image)
   print("Enhanced image saved at:", enhanced_path)
   new_path = save_first_page_numpy_to_image(enhanced_image)
   coordinates_A = vertical_lines_detection(new_path) #returns lines (if>3)
   print("Detected vertical lines:", coordinates_A)
   ###-----------------------------END OF DETECTION OF VERTICAL LINES WHERE ITS REALLY PRESENT-----------------------###

   doc_og = returns_doc_according_to_columns(pdf_to_images, detected_original_bboxs, coordinates_A, horizontal_lines, encoded_pdf, first_page=True) #rec1
   print(f"Document after initial processing: {doc_og}")

#    v_lines = [item[0] for item in coordinates_A]

   print("Starting Test Case Processing...")

   coordinates_after_ocr = get_ocr_column_coordinates(doc_og)

#    print("before ocr: ", v_lines)
   print("after ocr: ", coordinates_A)

   if len (coordinates_A) > 3:

    print("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% NOT SKIPPING %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%")
    # Test Case A
    model_df_A, lists = run_test_case_A(doc_og, coordinates_after_ocr)
    if model_df_A is not None:
            print("Test Case A passed")
            return ["A", 0, lists, coordinates_A]  # Test Case A passed

    model_df_B, lists = run_test_case_B(doc_og, coordinates_after_ocr)
    if model_df_B is not None:
            print("Test Case B passed")
            return ["B", 0, lists, coordinates_A]  # Test Case B passed


   ###------------------------------------------------------------------------------------------------
   ### first we will have to make a raw document with direct ocr extraction
#    page_one_raw_doc = returns_doc_according_to_columns(pdf_to_images, detected_original_bboxs, [], [], encoded_pdf, first_page=True) # rec2
   output_single_pdf = os.path.join(TEMP_SAVED_PDF_DIR, f"model_single_ocr_output_{uuid.uuid4().hex}.pdf")
   image = Image.open(new_path).convert("RGB")
   image.save(output_single_pdf)
   print(f"Single page PDF saved at: {output_single_pdf}")

   page_with_columns, coordinates_C, only_lines = add_column_separators_in_memory(output_single_pdf)
   page_h = pdf_to_images[0].shape[0]   # if numpy array, otherwise use image height
   explicit_lines = [(int(round(x+20)), 0, 2, page_h) for x in only_lines] #coz vertical lines look like this

   doc_model = returns_doc_according_to_columns(pdf_to_images, detected_original_bboxs, explicit_lines, horizontal_lines, encoded_pdf, first_page=True) # rec3
   print(f"Document after text processing for (transformer model): {doc_model}")

   coordinates_after_ocr = get_ocr_column_coordinates(doc_model)
    
    # Test Case C
   model_df_C, lists = run_test_case_C(doc_model, coordinates_after_ocr)
   if model_df_C is not None:
        print("Test Case C (with table_transformer model) passed")
        return ["C", coordinates_C, lists, explicit_lines]  # Test Case C passed

    # Test Case D
   model_df_D, lists = run_test_case_D(doc_model, coordinates_after_ocr)
   if model_df_D is not None:
        print("Test Case D (with table_transformer model) passed")
        return ["D", coordinates_C, lists, explicit_lines]  # Test Case D passed

   else:
        # Test Case E
        lists = 0
        print("Test Case E begins : NOT MOVING TOWARDS CUSTOM EXTRACTION")
        return ["E", coordinates_C, lists, explicit_lines]

def run_test_output_on_whole_pdf(list_a, pdf_in_saved_pdf, encoded_pdf):
    test_case = list_a[0]
    coordinates_C = list_a[1]
    lists_of_columns = list_a[2]
    explicit_lines = list_a[3]

    coordinates_after_ocr = get_ocr_column_coordinates(pdf_in_saved_pdf)

    if test_case == "A":
        # Run `extract_dataframe_from_pdf_ocr()` for Test Case A
        print("Running extract_dataframe_from_pdf_ocr() for Test Case A")
        explicit_lines = coordinates_after_ocr
        if not explicit_lines:
            df = extract_dataframe_from_pdf_ocr(pdf_in_saved_pdf, table_settings={
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "edge_min_length": 20,
            })
            model_df = new_mode_for_pdf(df, lists_of_columns)
            return model_df, None
        else:
            df = extract_dataframe_from_pdf_ocr(pdf_in_saved_pdf, table_settings={
                "vertical_strategy": "explicit",
                "explicit_vertical_lines": explicit_lines,
                "horizontal_strategy": "lines",
                "intersection_x_tolerance": 200,
            })
            model_df = new_mode_for_pdf(df, lists_of_columns)
            return model_df, None

    elif test_case == "B":
        # Run `row_separators_addition()` for Test Case B
        explicit_lines = coordinates_after_ocr
        print("Running row_separators_addition() for Test Case B")
        # pdf_in_rows_saved_pdf = self.add_row_separators_in_memory(pdf_in_saved_pdf)
        if not explicit_lines:
            df = extract_dataframe_from_pdf_ocr(pdf_in_saved_pdf, table_settings={
                "vertical_strategy": "lines",
                "horizontal_strategy": "text",
                "edge_min_length": 20,
                "intersection_x_tolerance": 200
            })
            model_df = new_mode_for_pdf(df, lists_of_columns)
            return model_df, None
        else:
            df = extract_dataframe_from_pdf_ocr(pdf_in_saved_pdf, table_settings={
                "vertical_strategy": "explicit",
                "explicit_vertical_lines": explicit_lines,
                "horizontal_strategy": "text",
                "intersection_x_tolerance": 200
            })
            model_df = new_mode_for_pdf(df, lists_of_columns)
            return model_df, None

    elif test_case == "C":
        # Run `add_column_separators_with_coordinates()` for Test Case C
        print(f"Running add_column_separators_with_coordinates() for Test Case C with coordinates {coordinates_C}")
        explicit_lines = coordinates_after_ocr
        # pdf_in_columns_saved_pdf, explicit_lines = self.add_column_separators_with_coordinates(pdf_in_saved_pdf, coordinates_C)
        df = extract_dataframe_from_pdf_ocr(pdf_in_saved_pdf, table_settings={
            "vertical_strategy": "explicit",
            "explicit_vertical_lines": explicit_lines,
            "horizontal_strategy": "lines",
            "intersection_x_tolerance": 200
        })
        model_df = new_mode_for_pdf(df, lists_of_columns)
        return model_df, None

    elif test_case == "D":
        # First add row separators, then column separators with coordinates for Test Case D
        print("Running add_row_separators and add_column_separators_with_coordinates() for Test Case D")
        # pdf_in_rows_saved_pdf = self.add_row_separators_in_memory(pdf_in_saved_pdf)
        # pdf_in_columns_saved_pdf, explicit_lines = self.add_column_separators_with_coordinates(pdf_in_saved_pdf, coordinates_C)
        explicit_lines = coordinates_after_ocr
        df = extract_dataframe_from_pdf_ocr(pdf_in_saved_pdf, table_settings={
            "vertical_strategy": "explicit",
            "explicit_vertical_lines": explicit_lines,
            "horizontal_strategy": "text",
            "intersection_x_tolerance": 200,
        })
        model_df = new_mode_for_pdf(df, lists_of_columns)
        return model_df, None

    else:
        # Handle Test Case E
        print("Running specific handling for Test Case E with extracted dataframe")
        df = pd.DataFrame()
        return df, explicit_lines

def is_pdf_encoded_ocr(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        
        # Choose pages 0 to 3 if total_pages > 4, else all available pages
        if total_pages > 4:
            page_indices = [0, 1, 2, 3]
        else:
            page_indices = list(range(total_pages))

        readable_count = 0

        for page_number in page_indices:
            page = reader.pages[page_number]
            text = page.extract_text()
            if text:
                printable_chars = sum(char.isprintable() for char in text)
                if printable_chars / len(text) >= 0.5:
                    readable_count += 1

        if readable_count >= 1:
            return "PDF text is readable and not encoded."
        else:
            return "PDF appears encoded or obfuscated."

    except Exception as e:
        return f"An unexpected error occurred: {e}"

def pdf_to_numpy_arrays(pdf_path):
    doc = fitz.open(pdf_path)
    arrays = []

    for page in doc:
        # 1. Calculate the zoom factor needed to achieve the target DPI
        zoom = 300 / 72.0  # The base DPI is 72
        
        # 2. Create the transformation matrix
        matrix = fitz.Matrix(zoom, zoom)
        
        # 3. Render the page to a pixmap using the high-res matrix
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        
        # 4. Convert pixmap samples to a NumPy array
        img_array = np.frombuffer(
            pix.samples,
            dtype=np.uint8
        ).reshape(pix.height, pix.width, pix.n)
        
        arrays.append(img_array)

    doc.close()
    return arrays


from pathlib import Path
import fitz              # PyMuPDF
import numpy as np

def extract_textboxes(pdf_path: str | Path,
                      pages: list[int] | None = None,
                      scale: float = 2.0):
    """
    Parameters
    ----------
    pdf_path : str | Path
        Path to the PDF.
    pages : list[int] | None
        0-based page indexes to process (None → all).
    scale : float
        Render scale multiplier. 2.0 ⇒ 144 dpi if the PDF is 72 dpi.

    Returns
    -------
    list[dict]
        One dict per page, matching your desired schema:
        {
          'input_path': str,
          'page_index': int,
          'input_img': np.ndarray[H,W,3] uint8,
          'dt_polys': np.ndarray[(N,4,2)] int16,
          'dt_scores': list[float]
        }
    """
    pdf_path = Path(pdf_path).expanduser().resolve()
    outputs = []

    with fitz.open(pdf_path) as doc:
        page_ids = pages if pages is not None else range(len(doc))

        for pno in page_ids:
            page = doc[pno]

            # 1️⃣ Render page → RGB image  -----------------------------------
            mat   = fitz.Matrix(scale, scale)        # upscale for clarity
            pix   = page.get_pixmap(matrix=mat, alpha=False)
            img   = np.frombuffer(pix.samples, dtype=np.uint8)
            img   = img.reshape(pix.height, pix.width, 3)

            # 2️⃣ Collect text blocks → polygons -----------------------------
            blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, ...)
            polys  = [
                [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
                for x0, y0, x1, y1, *_ in blocks
            ]

            if not polys:    # page with no text
                continue

            dt_polys  = np.array(polys, dtype=np.int16)
            dt_scores = [0.99] * len(polys)

            outputs.append(
                {
                    "input_path": str(pdf_path.name),
                    "page_index": pno,
                    "input_img":  img,
                    "dt_polys":   dt_polys,
                    "dt_scores":  dt_scores,
                }
            )

    return outputs


import time
# Main function to run test cases with optimizations
def extract_with_test_cases_ocr(bank_name, pdf_path, pdf_password, CA_ID, encoded_pdf=False):
   ##################################################################################################################

#    df , name_num, error = extract_with_test_cases(bank_name, pdf_path, pdf_password, [], [], encoded_pdf)

#    print("---------------------------------Initial extraction process completed--------------------------------------------")

#    df.to_excel("rectify_output.xlsx")

#    print(xx)

   ###################################################################################################################
   timestamp = "1234_temp"
   pdf_in_saved_pdf = unlock_and_add_margins_to_pdf(pdf_path, pdf_password, timestamp, CA_ID)
   pdf_to_images = pdf_to_numpy_arrays(pdf_in_saved_pdf) #list of high quality images of pdf page
   # print(f"PDF converted to images: {pdf_to_images}"
   print("Detection Started")
   start = time.time() 

   if encoded_pdf:
       detected_original_bboxs = extract_textboxes(pdf_in_saved_pdf) 

   else:
       detected_original_bboxs = det_model_mobile.predict(pdf_to_images)

   end = time.time()
   print(f"Time taken for detection: {end - start} seconds")

   #  print(f"Detected original bounding boxes: {dict_output}")
   
   list_test = process_pdf_with_test_cases(pdf_to_images, detected_original_bboxs, encoded_pdf)

   print("aiyaz ",list_test)
   if list_test[0] == "E":
       print("ALL TEST CASES FAILED")
       return pd.DataFrame(), "GO TO RECTIFY", []

   pdf_in_saved_pdf = returns_doc_according_to_columns(pdf_to_images, detected_original_bboxs, list_test[3], [], encoded_pdf, first_page=False) # rec4
    
   idf, explicit_lines = run_test_output_on_whole_pdf(list_test, pdf_in_saved_pdf, encoded_pdf)

   text = extract_text_from_pdf_ocr(pdf_in_saved_pdf)
   return idf, text, explicit_lines

def extraction_process_only_rectify(bank, pdf_path, pdf_password, start_date, end_date, only_lines, labels, encoded_pdf=False):
    
    # only_lines = [360.12442452566955, 466.55299595424094, 277.2672816685267, 85.83871023995533, 567.2672816685266, 24.410138811383923]
    
    CA_ID = "1234_temp"
    empty_idf = pd.DataFrame()
    default_name_n_num = ["_", "XXXXXXXXXX"]
    # bank = re.sub(r"\d+", "", bank)
    a = ""

    print("______________________________qwerty_______________________")

    # explicit_lines = [(x, 0, 0, 0) for x in only_lines]
    pdf_to_images = pdf_to_numpy_arrays(pdf_path)

    # page_h = pdf_to_images[0].shape[0]   # if numpy array, otherwise use image height
    # explicit_lines = [(int(round(x+20)), 0, 2, page_h) for x in only_lines] #coz vertical lines look like this

    # --- FIX IS HERE ---
    # 1. Recalculate the SAME zoom factor that the function uses internally.
    zoom = 300 / 72.0 

    # 2. Get the height of the new, high-res image
    page_h = pdf_to_images[0].shape[0]

    # 3. Scale your original coordinates using the zoom factor
    explicit_lines = [(int(round((x) * zoom)), 0, int(round(2 * zoom)), page_h) for x in only_lines]

    print("Only Lines:", only_lines)
    print("Explicit lines for rectify:", explicit_lines)

    print("Detection Started for rectify")
    start = time.time() 
    if encoded_pdf:
        detected_original_bboxs = [] # replace wil new textboxes detected directly from pdf_pages
    else:
        detected_original_bboxs = det_model_mobile.predict(pdf_to_images)
    end = time.time()
    print(f"Time taken for detection rectify: {end - start} seconds")

    doc_rectify = returns_doc_according_to_columns(pdf_to_images, detected_original_bboxs, explicit_lines, [], encoded_pdf, first_page=False) # rec3
    print(f"Document after text processing for (transformer model): {doc_rectify}")

    coordinates_after_ocr = get_ocr_column_coordinates(doc_rectify)
    explicit_lines = coordinates_after_ocr

    try:
        df = extract_dataframe_from_pdf_ocr(doc_rectify, table_settings={
            "vertical_strategy": "explicit",
            "explicit_vertical_lines": explicit_lines,
            "horizontal_strategy": "text",
            "intersection_x_tolerance": 200,
        })

        all_null = all(label[1] == "null" for label in labels)

        if not all_null and not df.empty:
            new_row = [None] * len(df.columns)  # Create a blank row with the same number of columns
            for index, label_type in labels:
                if index < len(new_row):
                    new_row[index] = label_type

            # Insert the new row at the top of the DataFrame
            df.loc[-1] = new_row  # Add the new row with a negative index to place it at the top
            df.index = df.index + 1  # Shift all indices by 1
            df.sort_index(inplace=True)  # Reorder the DataFrame to update the row positions

        try:
            idf, _ = model_for_pdf_ocr(df)
        except Exception as e:
            idf = empty_idf
            
        # Add start and end date
        if idf.empty:
            df = extract_dataframe_from_pdf_ocr(doc_rectify, table_settings={
                "vertical_strategy": "explicit",
                "explicit_vertical_lines": explicit_lines,
                "horizontal_strategy": "lines",
                "intersection_x_tolerance": 200,
            })

            all_null = all(label[1] == "null" for label in labels)

            if not all_null:
                new_row = [None] * len(df.columns)  # Create a blank row with the same number of columns
                for index, label_type in labels:
                    if index < len(new_row):
                        new_row[index] = label_type

                # Insert the new row at the top of the DataFrame
                df.loc[-1] = new_row  # Add the new row with a negative index to place it at the top
                df.index = df.index + 1  # Shift all indices by 1
                df.sort_index(inplace=True)  # Reorder the DataFrame to update the row positions

            idf, _ = model_for_pdf_ocr(df)

        # idf = add_start_n_end_date_v2(idf, start_date, end_date, bank)
        # name_n_num = []
        idf = add_start_n_end_date_v2(idf, start_date, end_date, bank)
        name_n_num = extract_account_details(extract_text_from_pdf_ocr(pdf_path))
        a = validate_bank_statement_returns_error_message_ocr(idf)

        return idf, name_n_num, a

    except Exception as e:
        er = "There was an exception error, please contact Support team for help."
        return empty_idf, default_name_n_num, er
    
