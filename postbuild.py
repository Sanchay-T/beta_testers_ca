import os
import shutil

# Define source paths
models = os.path.join("backend", "models")
category_sheet = os.path.join("backend", "Final_Category.xlsx")
customer_sheet = os.path.join("backend", "Customer_category.xlsx")
# assets = os.path.join("src", "utils", "assets")
# root_db = "db.sqlite3"
# root_license = "LICENSE.txt"
# root_icons = "icons"

# Define destination paths
dist_internal = os.path.join("dist", "main", "_internal")
print(dist_internal)
# dist_main = os.path.join("dist", "main")

# Ensure destination directories exist
# os.makedirs(dist_internal, exist_ok=True)
# os.makedirs(dist_main, exist_ok=True)

# Copy models folder
if os.path.exists(models):
    shutil.copytree(models, os.path.join(dist_internal, "models"), dirs_exist_ok=True)
    print(f"Copied: {models} to {os.path.join(dist_internal, 'models')}")
else:
    print(f"Source not found: {models}")

# Copy category sheet
if os.path.exists(category_sheet):
    shutil.copy(category_sheet, dist_internal)
    print(f"Copied: {category_sheet} to {dist_internal}")
else:
    print(f"Source not found: {category_sheet}")

# Copy category sheet
if os.path.exists(customer_sheet):
    shutil.copy(customer_sheet, dist_internal)
    print(f"Copied: {customer_sheet} to {dist_internal}")
else:
    print(f"Source not found: {customer_sheet}")
# Copy assets folder
# if os.path.exists(src_assets):
#     shutil.copytree(src_assets, os.path.join(dist_internal, "assets"), dirs_exist_ok=True)
#     print(f"Copied: {src_assets} to {os.path.join(dist_internal, 'assets')}")
# else:
#     print(f"Source not found: {src_assets}")

# Copy db.sqlite3
# if os.path.exists(root_db):
#     shutil.copy(root_db, dist_main)
#     print(f"Copied: {root_db} to {dist_main}")
# else:
#     print(f"Source not found: {root_db}")

# Copy LICENSE.txt
# if os.path.exists(root_license):
#     shutil.copy(root_license, dist_main)
#     print(f"Copied: {root_license} to {dist_main}")
# else:
#     print(f"Source not found: {root_license}")

# Copy icons folder
# if os.path.exists(root_icons):
#     shutil.copytree(root_icons, os.path.join(dist_main, "icons"), dirs_exist_ok=True)
#     print(f"Copied: {root_icons} to {os.path.join(dist_main, 'icons')}")
# else:
#     print(f"Source not found: {root_icons}")