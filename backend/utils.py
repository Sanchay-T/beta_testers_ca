import tempfile
import sys
import os

def get_saved_pdf_dir():

    TEMP_SAVED_PDF_DIR = os.path.join(tempfile.gettempdir(), "saved_pdf")

    return TEMP_SAVED_PDF_DIR



def get_saved_excel_dir():

    TEMP_SAVED_EXCEL_DIR = os.path.join(tempfile.gettempdir(), "saved_excel")

    return TEMP_SAVED_EXCEL_DIR
    

def get_base_dir():
    """
    Determine the base directory of the application.
    - Use sys.executable if running as an executable
    - Use __file__ if running as a script
    
    """
    if hasattr(sys, '_MEIPASS'):
        print("MEIPASS : ", sys._MEIPASS)
        return sys._MEIPASS
    else:
        return os.path.dirname(os.path.abspath(__file__))
