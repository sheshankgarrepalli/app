import csv
import re
import time
import requests
import urllib3
from bs4 import BeautifulSoup
import os

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    # Using a standard Windows Chrome User-Agent
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
}
OUTPUT_FILE = "samsung_s24plus_inventory.csv"

def init_csv():
    if not os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["OEM_ID", "Full_Model_String", "Storage", "RAM_Raw"])

def extract_storage_from_model(model_str):
    if model_str == "NULL":
        return "NULL"
    # Regex to find storage like 256GB, 512GB, 1TB
    m = re.search(r"(\d+(?:GB|TB))", model_str, flags=re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return "NULL"

def main():
    init_csv()

    print("[*] Stage 1: Link Harvesting")
    # PhoneDB search form uses POST with search_exp
    search_url = "https://phonedb.net/index.php?m=device&s=list"
    
    try:
        resp = requests.post(search_url, data={"search_exp": "SM-S926"}, headers=HEADERS, timeout=30, verify=False)
        resp.raise_for_status()
    except Exception as e:
        print("[!] Failed to load search page. Error:", e)
        # Fallback empty list or exit
        return

    soup = BeautifulSoup(resp.content, "html.parser")
    device_links = []
    
    # Extract "All details" links
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        if "all details" in text or "d=detailed_specs" in a["href"]:
            href = a["href"]
            href_lower = href.lower()
            if "samsung" in href_lower or "s926" in href_lower:
                # Convert to absolute URL if needed
                if href.startswith("index.php"):
                    href = "https://phonedb.net/" + href
                if href not in device_links:
                    device_links.append(href)

    print(f"[*] Found {len(device_links)} device 'All details' links.")

    print("[*] Stage 2: Deep Spec Extraction")
    for link in device_links:
        print(f"[*] Extracting: {link}")
        time.sleep(3) # Politeness rule: wait 3 seconds before next request
        try:
            r = requests.get(link, headers=HEADERS, timeout=30, verify=False)
            if r.status_code != 200:
                print(f"  [!] Server responded with HTTP {r.status_code}")
                # Log nulls and continue
                with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
                    csv.writer(f).writerow(["NULL", "NULL", "NULL", "NULL"])
                continue
            
            s = BeautifulSoup(r.content, "html.parser")
            
            model = "NULL"
            oem_id = "NULL"
            ram = "NULL"
            storage_raw = "NULL"

            # Parse HTML tables looking for exact row labels
            for tr in s.find_all("tr"):
                th_td = tr.find_all(["th", "td"])
                if len(th_td) >= 2:
                    label = th_td[0].get_text(strip=True)
                    val = th_td[1].get_text(strip=True)
                    
                    if label == "Model":
                        model = val
                    elif label == "OEM ID":
                        oem_id = val
                    elif label == "RAM Capacity":
                        ram = val
                    elif label == "Non-volatile Memory Capacity":
                        storage_raw = val

            # Use regex on Full_Model_String to extract final storage
            storage = extract_storage_from_model(model)
            if storage == "NULL" and storage_raw != "NULL":
                storage = extract_storage_from_model(storage_raw)
            
            # Write row immediately after extraction (resilience)
            with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([oem_id, model, storage, ram])
                print(f"  [+] Saved {model[:30]}... | Storage: {storage} | OEM: {oem_id}")
                
        except Exception as e:
            print(f"  [!] Error parsing {link}: {e}")
            # Insert NULL on error to prevent crashing
            with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(["NULL", "NULL", "NULL", "NULL"])

    print("[*] Done. Output saved to:", OUTPUT_FILE)

if __name__ == "__main__":
    main()
