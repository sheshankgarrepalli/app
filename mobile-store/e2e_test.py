import requests
import json
import traceback

import time

BASE_URL = "http://localhost:8000"

def run_test():
    try:
        print("Starting E2E Workflow Test...")

        # 1. Log in as admin
        print("\n[1] Logging in as admin...")
        res = requests.post(f"{BASE_URL}/api/auth/login", data={"username": "admin@test.com", "password": "password"})
        assert res.status_code == 200, f"Failed to login: {res.text}"
        admin_token = res.json()["access_token"]
        auth_admin = {"Authorization": f"Bearer {admin_token}"}

        # 2. Add a new model and receive it into central inventory via auto-lookup flow
        print("\n[2] Fast-receiving new inventory item...")
        IMEI = f"E2E-IMEI-{int(time.time())}"
        payload = {
            "inventory": {
                "imei": IMEI,
                "serial_number": "SN-E2E-999",
                "model_number": "NOK3310"
            },
            "phone_model": {
                "model_number": "NOK3310",
                "brand": "Nokia",
                "name": "3310",
                "color": "Navy Blue",
                "storage_gb": 0
            }
        }
        res = requests.post(f"{BASE_URL}/api/inventory/central/fast-receive", json=payload, headers=auth_admin)
        assert res.status_code == 200, f"Failed to fast-receive: {res.text}"
        print("Success! Created model and received item.")

        # 3. Transfer the device to store_a
        print("\n[3] Transferring item to store_a...")
        res = requests.post(f"{BASE_URL}/api/transfers/", json={"imei": IMEI, "to_store_id": "store_a"}, headers=auth_admin)
        assert res.status_code == 200, f"Failed to transfer: {res.text}"
        print("Success! Item transferred.")

        # 4. Log in as store_a and track the device
        print("\n[4] Logging in as store_a and tracking device...")
        res = requests.post(f"{BASE_URL}/api/auth/login", data={"username": "store_a@test.com", "password": "password"})
        assert res.status_code == 200, f"Failed to login: {res.text}"
        store_token = res.json()["access_token"]
        auth_store = {"Authorization": f"Bearer {store_token}"}

        res = requests.get(f"{BASE_URL}/api/track/{IMEI}", headers=auth_store)
        assert res.status_code == 200, f"Failed to track device: {res.text}"
        print(f"Success! Timeline events: {len(res.json()['timeline'])}")

        # 5. Sell the device via POS as store_a
        print("\n[5] Operating POS to sell device as store_a...")
        invoice_payload = {
            "customer": {
                "name": "E2E Test Customer",
                "phone": "555-0101"
            },
            "items": [
                {"imei": IMEI, "unit_price": 50.0}
            ],
            "tax_percent": 10.0
        }
        res = requests.post(f"{BASE_URL}/api/pos/invoice", json=invoice_payload, headers=auth_store)
        assert res.status_code == 200, f"Failed to run POS: {res.text}"
        invoice_id = res.json()["id"]
        invoice_number = res.json()["invoice_number"]
        print(f"Success! Sold device. Invoice #{invoice_number} generated.")

        # 6. Retrieve the generated PDF invoice
        print("\n[6] Retrieving PDF invoice...")
        res = requests.get(f"{BASE_URL}/api/pos/invoice/{invoice_id}/pdf")
        assert res.status_code == 200, f"Failed to get PDF: {res.text}"
        assert res.headers["content-type"] == "application/pdf"
        print(f"Success! Downloaded {len(res.content)} bytes of PDF data.")

        print("\nAll E2E tests passed successfully! ✅")

    except AssertionError as e:
        print(f"\n❌ E2E TEST FAILED: {e}")
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
