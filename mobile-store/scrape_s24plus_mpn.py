import asyncio
import csv
import re
import os
import time
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# Configuration
SEARCH_NAME = "SM-S926"
OUTPUT_FILE = "samsung_s24plus_mpn_inventory.csv"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
DELAY = 3 # seconds

async def get_device_links(page, search_name):
    """Search for the device and return all individual device links."""
    search_url = f"https://phonedb.net/index.php?m=device&s=list&search_name={search_name}"
    print(f"[*] Navigating to search results: {search_url}")
    
    # Enable console log
    page.on("console", lambda msg: print(f"  [Browser Console] {msg.text}"))
    
    try:
        await page.goto(search_url, wait_until="load", timeout=60000)
    except Exception as e:
        print(f"[!] Target URL failed to load: {e}")
        return []

    print(f"[*] Page title: {await page.title()}")
    if "Challenge" in await page.title() or "Cloudflare" in await page.content():
        print("[!] Warning: Cloudflare/Challenge detected. Script might be blocked.")

    device_links = []
    device_links = []
    while True:
        # Optimization: Fetch all hrefs at once from the browser context
        all_links = await page.evaluate("""
            () => Array.from(document.querySelectorAll('a'))
                       .map(a => ({ href: a.getAttribute('href'), text: a.innerText }))
                       .filter(a => a.href && a.href.includes('m=device&id=') && !a.href.includes('d=detailed_specs'))
        """)
        
        initial_count = len(device_links)
        print(f"[*] Found {len(all_links)} potential tool links on page.")
        
        for l in all_links:
            href = l['href']
            text = l['text'].lower()
            href_lower = href.lower()
            
            # Filter strictly for S24+ or S926 (case-insensitive)
            if "samsung" in href_lower or "s926" in href_lower or "s24" in href_lower or "s24" in text:
                full_url = "https://phonedb.net/" + href if href.startswith("index.php") else href
                if full_url not in device_links:
                    device_links.append(full_url)
        
        new_count = len(device_links)
        print(f"[*] Found {new_count} unique matching device links so far...")
        
        if new_count == initial_count:
            print("[*] No new links found, stopping search loop.")
            break
            
        # Check for next page link
        next_button = await page.query_selector("a[title='Next page']")
        if next_button:
            print("[*] Navigating to next results page...")
            await next_button.click()
            await page.wait_for_load_state("load")
            await asyncio.sleep(DELAY)
        else:
            break
            
    return device_links

async def scrape_device_details(page, url):
    """Scrape specific fields from a device page."""
    print(f"[*] Scraping details from: {url}")
    await page.goto(url, wait_until="networkidle")
    content = await page.content()
    soup = BeautifulSoup(content, "html.parser")
    
    specs = {
        "Brand": "Samsung",
        "Model_Name": "NULL",
        "Base_Model_Number": "NULL",
        "MPN_or_UPC": "NULL",
        "Color": "NULL",
        "Storage": "NULL",
        "RAM": "NULL",
        "Region_or_Carrier": "NULL"
    }

    # Helper function to get value by key
    def get_val(labels):
        for row in soup.find_all("tr"):
            th_td = row.find_all(["th", "td"])
            if len(th_td) >= 2:
                key = th_td[0].get_text(strip=True)
                val = th_td[1].get_text(strip=True)
                if any(l.lower() == key.lower() or l.lower() in key.lower() for l in labels):
                    return val
        return "NULL"

    # Extract fields
    specs["Model_Name"] = get_val(["Model Name", "Full Name"])
    specs["Base_Model_Number"] = get_val(["Model Number", "Model ID"])
    specs["RAM"] = get_val(["RAM Capacity", "Random Access Memory"])
    specs["Storage"] = get_val(["Non-volatile Memory Capacity", "Internal Storage"])
    specs["Region_or_Carrier"] = get_val(["Region", "Carrier", "Target Market"])

    # Strict filtering: Must be Samsung AND (S24+ OR S926)
    model_name_lower = specs["Model_Name"].lower()
    base_model_lower = specs["Base_Model_Number"].lower()
    
    is_samsung = "samsung" in model_name_lower or "samsung" in soup.get_text().lower()[:500]
    is_s24plus = "s24+" in model_name_lower or "s24 plus" in model_name_lower or "s926" in base_model_lower or "s926" in model_name_lower
    
    if not (is_samsung and is_s24plus):
        print(f"  [SKIP] Not a Samsung S24+ variant: {specs['Model_Name']} ({specs['Base_Model_Number']})")
        return []

    print(f"  [MATCH] Found S24+ variant: {specs['Model_Name']}")

    # Extract MPNs/UPCs (Most Important)
    # Look for "OEM ID", "Brand SKU", "Part Number", "EAN", "UPC", "Reference Number"
    mpn_labels = ["OEM ID", "Brand SKU", "Part Number", "EAN", "UPC", "Reference Number"]
    mpns_raw = "NULL"
    for row in soup.find_all("tr"):
        th_td = row.find_all(["th", "td"])
        if len(th_td) >= 2:
            key = th_td[0].get_text(strip=True)
            if any(l.lower() in key.lower() for l in mpn_labels):
                mpns_raw = th_td[1].get_text(strip=True)
                break
    
    # If a page lists multiple MPNs/UPCs (complex parsing)
    # Sometimes it is a comma or slash list, or parenthetical
    # e.g. "SM-S926UZKEXAA (256GB Black), SM-S926UZAEXAA (512GB Grey)"
    # We will attempt a simple split or just keep the raw block if it's not easily splittable
    # For now, let's look for commas or separate lines
    variants = []
    if mpns_raw != "NULL":
        # Split by comma or semicolon if multiple values exist
        # Check if there is a pattern like Code (Description)
        parts = re.split(r",|\n|;", mpns_raw)
        for part in parts:
            p = part.strip()
            if not p: continue
            
            v_specs = specs.copy()
            # Try to extract color from parens if present
            color_match = re.search(r"\((.*?)\)", p)
            if color_match:
                v_specs["Color"] = color_match.group(1)
                v_specs["MPN_or_UPC"] = p.split("(")[0].strip()
            else:
                v_specs["MPN_or_UPC"] = p
            
            variants.append(v_specs)
    else:
        variants.append(specs)
        
    return variants

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=USER_AGENT)
        page = await context.new_page()
        
        # Initialize CSV
        file_exists = os.path.isfile(OUTPUT_FILE)
        with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["Brand", "Model_Name", "Base_Model_Number", "MPN_or_UPC", "Color", "Storage", "RAM", "Region_or_Carrier"])
            if not file_exists:
                writer.writeheader()
        
        try:
            device_links = await get_device_links(page, SEARCH_NAME)
            print(f"[*] Found {len(device_links)} devices to scrape.")
            
            for link in device_links:
                try:
                    variants = await scrape_device_details(page, link)
                    
                    # Log write
                    with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
                        writer = csv.DictWriter(f, fieldnames=["Brand", "Model_Name", "Base_Model_Number", "MPN_or_UPC", "Color", "Storage", "RAM", "Region_or_Carrier"])
                        for v in variants:
                            writer.writerow(v)
                            print(f"[+] Saved: {v.get('Model_Name')} - {v.get('MPN_or_UPC')}")
                    
                    # Politeness
                    await asyncio.sleep(DELAY)
                except Exception as e:
                    print(f"[!] Error scraping {link}: {e}")
                    
        finally:
            await browser.close()
            print("[*] Scraping completed.")

if __name__ == "__main__":
    asyncio.run(main())
