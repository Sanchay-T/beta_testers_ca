def Upi(df):
    categories_to_include = ["UPI-Cr", "UPI-Dr"]

    def apply_regex_to_empty_entities_axis(row):
        if row["Category"] in categories_to_include:
            if "upi/p2a" in row["Description"] or "upi/p2m" in row["Description"]:
                match = re.search(r"upi/p2[am]/\d+/([^/]+)/", row["Description"])
                if match:
                    return match.group(1)
        return row["Entity"]

    def apply_regex_to_categories_hdfc(row):
        if row["Category"] in categories_to_include:
            if "upi-" in row["Description"]:
                match = re.search(r"(?<=upi-)([a-zA-Z]+)", row["Description"])
                if match:
                    return match.group(1)
        return row["Entity"]

    def apply_regex_to_empty_entities_sbi(row):
        if row["Category"] in categories_to_include:
            if (
                "totransfer-upi" in row["Description"]
                or "bytransfer-upi" in row["Description"]
            ):
                match = re.search(
                    r"(totransfer|bytransfer)-upi/[cd]r/\d+/([a-zA-Z]+)/",
                    row["Description"],
                )
                if match:
                    return match.group(2)
        return row["Entity"]

    def apply_regex_to_empty_entities_kotak(row):
        if row["Category"] in categories_to_include:
            # Check if 'upi/' is in the description
            if "upi/" in row["Description"]:
                # Match the name immediately after 'upi/'
                match = re.search(r"upi/([a-zA-Z.]+)", row["Description"])
                if match:
                    # Clean the name by removing special characters and numbers
                    name = re.sub(
                        r"[^a-zA-Z]", "", match.group(1)
                    )  # Keep only alphabetic characters
                    return (
                        name if name else "Suspense"
                    )  # Return 'Suspense' if the name is empty
        return row["Entity"]

    def apply_regex_to_empty_entities_rbl(row):
        if row["Category"] in categories_to_include:
            if "upi/" in row["Description"]:
                match = re.search(r"upi/\d+/\w+/([a-zA-Z0-9@.]+)", row["Description"])
                if match:
                    # Extract the raw name
                    raw_name = match.group(1)
                    # Remove numeric and '@' characters
                    cleaned_name = re.sub(r"[0-9@]", "", raw_name)
                    return cleaned_name
        return row["Entity"]

    def apply_regex_to_empty_entities_idfc(row):
        if row["Category"] in categories_to_include:
            if "upi/mob" in row["Description"]:
                match = re.search(r"upi/mob/\d+/([\w]+)", row["Description"])
                if match:
                    raw_name = match.group(1)
                    cleaned_name = re.sub(r"[0-9@]", "", raw_name)
                    print(f"Extracted Name: {cleaned_name}")
                    return cleaned_name
        return row["Entity"]

    def apply_regex_to_empty_entities_vasai(row):
        if row["Category"] in categories_to_include:
            match = re.search(r"upi/(cr|dr)/\d+/([\w]+)/", row["Description"])
            if match:
                extracted_name = match.group(2)
                return extracted_name
        return row["Entity"]

        # Step 1: Apply regex logic first

    def extract_name_upiab(row):
        if row["Category"] in categories_to_include:
            match = re.search(r"upiab/\d+/cr/([\w]+)/", row["Description"])
            if match:
                extracted_name = match.group(
                    1
                )  # Use group(1) for the first capturing group
                return (
                    extracted_name.capitalize()
                )  # Capitalize the name for consistency
        return row["Entity"]

    def extract_name_mpay(row):
        if row["Category"] in categories_to_include and row["Description"].startswith(
            "mpay/upi/"
        ):
            match = re.search(r"mpay/upi/.+?/\w+/([\w]+)+@", row["Description"])
            if match:
                extracted_name = match.group(1)
                cleaned_name = re.sub(r"[0-9@]", "", extracted_name)
                return cleaned_name
        return row["Entity"]

    def apply_regex_to_categories_jsbl(row):
        if row["Category"] in categories_to_include:
            pattern = r"upi/(?:cr|dr)/\d+/([^/]+)"
            match = re.search(pattern, row["Description"])
            if match:
                return match.group(1)  # group(1) is the name
        return row["Entity"]

    def apply_regex_to_categories_dcb(row):
        if row["Category"] in categories_to_include:
            # Modified pattern to match "upi:pay:" or "upi:rec:" format
            pattern = r"upi:(?:pay|rec):\d+/([^/]+)"
            match = re.search(pattern, row["Description"])
            if match:
                return match.group(1)  # Extract the name
        return row["Entity"]

    def apply_regex_to_categories_idfc(row):
        if row["Category"] in categories_to_include:
            pattern = r"upi/mob/\d+/([^/]+)"  # Added 'mob' to the pattern
            match = re.search(pattern, row["Description"])
            if match:
                return match.group(1)  # Returns the captured name
        return row["Entity"]

    def apply_regex_to_categories_uco(row):
        if row["Category"] in categories_to_include:
            new_pattern = r"(?:mpay/)?upi/trtr/\d+/[^/]+/([^/.]+)"
            new_match = re.search(new_pattern, row["Description"])
            if new_match:
                return new_match.group(1)  # Returns 'dream11'
        return row["Entity"]

    def apply_regex_to_categories_nkgsb(row):
        if row["Category"] in categories_to_include:
            pattern1 = r"upi/(?:credit|debit)/\d+/([^/]+)"
            pattern2 = r"upi/(?:credit|debit)/([^/]+/\d+/)"
            match1 = re.search(pattern1, row["Description"])
            if match1:
                return match1.group(1)  # Returns the captured name
            match2 = re.search(pattern2, row["Description"])
            if match2:
                return match2.group(1).split("/")[0]  # Extracts only the name part
        return row["Entity"]

    def apply_regex_to_categories_surat(row):
        if row["Category"] in categories_to_include:
            pattern2 = r"upi/(?:credit|debit)/([^/]+/\d+/)"
            match1 = re.search(pattern2, row["Description"])
            if match1:
                return match1.group(1)
        return row["Entity"]

    df["Entity"] = df.apply(apply_regex_to_categories_uco, axis=1)
    df["Entity"] = df.apply(apply_regex_to_categories_nkgsb, axis=1)
    df["Entity"] = df.apply(apply_regex_to_categories_surat, axis=1)
    df["Entity"] = df.apply(apply_regex_to_categories_idfc, axis=1)
    df["Entity"] = df.apply(apply_regex_to_categories_jsbl, axis=1)
    df["Entity"] = df.apply(apply_regex_to_empty_entities_axis, axis=1)
    df["Entity"] = df.apply(apply_regex_to_categories_hdfc, axis=1)
    df["Entity"] = df.apply(apply_regex_to_empty_entities_sbi, axis=1)
    df["Entity"] = df.apply(apply_regex_to_empty_entities_kotak, axis=1)
    df["Entity"] = df.apply(apply_regex_to_empty_entities_rbl, axis=1)
    df["Entity"] = df.apply(apply_regex_to_empty_entities_idfc, axis=1)
    df["Entity"] = df.apply(apply_regex_to_empty_entities_vasai, axis=1)
    df["Entity"] = df.apply(extract_name_upiab, axis=1)
    df["Entity"] = df.apply(extract_name_mpay, axis=1)
    df["Entity"] = df.apply(apply_regex_to_categories_dcb, axis=1)

    # print(df)
    return df
