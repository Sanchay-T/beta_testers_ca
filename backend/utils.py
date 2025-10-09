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

def cleanup_temp_files(ca_id: str):
    """
    Deletes all temporary files associated with a specific ca_id from the saved_pdf directory.
    """
    if not ca_id:
        return

    temp_dir = get_saved_pdf_dir()
    for filename in os.listdir(temp_dir):
        if filename.startswith(ca_id):
            try:
                os.remove(os.path.join(temp_dir, filename))
                print(f"Successfully deleted temporary file: {filename}")
            except OSError as e:
                print(f"Error deleting file {filename}: {e.strerror}")