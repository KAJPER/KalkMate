import pandas as pd
import time
import os
from playwright.sync_api import sync_playwright

BOM_FILE = 'bom.xls'
DOWNLOAD_DIR = './lcsc_datasheets'

if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

# --- KLUCZOWA POPRAWKA ---
def is_pdf_response(response):
    # Odrzucamy wszystkie błędy
    if response.status != 200:
        return False
    
    content_type = response.headers.get("content-type", "").lower()
    
    # Akceptujemy TYLKO prawdziwe pliki PDF. 
    # Żadnego patrzenia na końcówkę linku. Odrzuca to wszystkie ściany Cloudflare.
    return "application/pdf" in content_type
# -------------------------

def download_from_lcsc():
    try:
        df = pd.read_excel(BOM_FILE)
        part_numbers = df['JLCPCB Part #'].dropna().unique()
        print(f"Znaleziono {len(part_numbers)} unikalnych komponentow do sprawdzenia.")
    except Exception as e:
        print(f"Blad odczytu pliku BOM: {e}")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False) 
        context = browser.new_context()
        page = context.new_page()

        for part in part_numbers:
            part = str(part).strip()
            if not part.startswith('C'):
                continue

            file_path = os.path.join(DOWNLOAD_DIR, f"{part}_Datasheet.pdf")
            if os.path.exists(file_path) and os.path.getsize(file_path) > 5000:
                print(f" -> Czesc {part} juz pobrana, pomijam.")
                continue

            print(f"\nPrzetwarzanie czesci: {part}")
            url = f"https://www.lcsc.com/product-detail/{part}.html"
            
            try:
                page.goto(url, wait_until="domcontentloaded")
                time.sleep(2) 
                
                pdf_locator = page.locator('a:has(img[alt="pdf icon"])').first
                
                if pdf_locator.is_visible():
                    pdf_url = pdf_locator.get_attribute("href")
                    if pdf_url.startswith("//"):
                        pdf_url = "https:" + pdf_url
                        
                    print(f"   -> Otwieranie podgladu PDF: {pdf_url.split('?')[0]}")
                    
                    pdf_page = context.new_page()
                    
                    try:
                        pdf_page.goto(pdf_url, wait_until="domcontentloaded")
                        
                        # Czekamy na zaladowanie ramki iframe z PDF
                        iframe_locator = pdf_page.locator('iframe')
                        iframe_locator.wait_for(state="attached", timeout=20000)
                        
                        pdf_src_url = iframe_locator.first.get_attribute("src")
                        if pdf_src_url:
                            if pdf_src_url.startswith("//"):
                                pdf_src_url = "https:" + pdf_src_url
                                
                            print(f"   -> Pobieranie bezposredniego pliku PDF: {pdf_src_url.split('?')[0]}")
                            response = context.request.get(pdf_src_url)
                            
                            if response.status == 200 and "application/pdf" in response.headers.get("content-type", "").lower():
                                pdf_bytes = response.body()
                                with open(file_path, "wb") as f:
                                    f.write(pdf_bytes)
                                print(f" [OK] Zapisano autentyczny dokument PDF dla {part} ({len(pdf_bytes)} bajtow)")
                            else:
                                print(f" [ERR] Blad: Serwer nie zwrocil pliku PDF (status: {response.status}, content-type: {response.headers.get('content-type')})")
                        else:
                            print(f" [ERR] Blad: Brak atrybutu src w ramce iframe dla {part}")
                            
                    except Exception as dl_err:
                        print(f" [ERR] Blad podczas pobierania PDF dla {part}: {dl_err}")
                    finally:
                        pdf_page.close() 
                        
                else:
                    print(f" [!] Nie znaleziono ikonki PDF na stronie {part}")
                    
            except Exception as e:
                print(f" [ERR] Blad podczas przetwarzania {part}: {e}")
            
            time.sleep(2) 

        browser.close()
        print("\nZakonczono pobieranie wszystkich plikow.")

if __name__ == "__main__":
    download_from_lcsc()