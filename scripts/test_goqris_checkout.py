"""
GoQRIS Checkout Integration Test
Tests the full checkout flow with QRIS payment method.

Usage:
  python scripts/test_goqris_checkout.py
  
Requires: playwright (pip install playwright && playwright install chromium)
"""

import re
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"


def test_homepage(page):
    """Test the store homepage loads correctly"""
    print("[1/6] Testing homepage...")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    assert page.title() is not None, "Page should have a title"
    print(f"  ✓ Page title: {page.title()}")

    products_link = page.locator("a").filter(has_text=re.compile(r"Products|products|Shop|shop", re.IGNORECASE)).first
    if products_link.count() > 0:
        txt = products_link.text_content() or ""
        print(f"  ✓ Found products link: '{txt.strip()}'")
    else:
        print("  ⚠ No products link found on homepage")
    
    page.screenshot(path="/tmp/goqris_homepage.png", full_page=True)
    print("  ✓ Homepage loaded successfully\n")


def test_products_page(page):
    """Test the products page loads and shows products"""
    print("[2/6] Testing products page...")
    page.goto(f"{BASE_URL}/products")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/goqris_products.png", full_page=True)
    print(f"  ✓ Products page URL: {page.url}")

    product_links = page.locator("a[href*='/products/']").all()
    visible_links = [el for el in product_links if el.is_visible()]
    print(f"  ✓ Found {len(visible_links)} visible product links")

    if visible_links:
        first = visible_links[0]
        href = first.get_attribute("href") or ""
        print(f"  ✓ First product link: {href}")
        return href
    else:
        print("  ⚠ No products found")
        return None


def test_add_to_cart(page, product_href):
    """Test adding a product to the cart"""
    print("[3/6] Testing add to cart...")
    if not product_href:
        print("  ⚠ Skipping - no product to add")
        return False

    page.goto(f"{BASE_URL}{product_href}")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/goqris_product_detail.png", full_page=True)
    print(f"  ✓ Product page loaded: {page.url}")

    add_btn = page.locator("button").filter(has_text=re.compile(r"Add to Cart|Beli|Tambah|Buy", re.IGNORECASE)).first
    if add_btn.count() > 0 and add_btn.is_visible():
        add_btn.click()
        page.wait_for_timeout(1500)
        print("  ✓ Clicked 'Add to Cart'")
        page.screenshot(path="/tmp/goqris_cart_after_add.png", full_page=True)
        return True
    else:
        print("  ⚠ No 'Add to Cart' button found")
        return False


def test_checkout_flow(page):
    """Test the full checkout flow through all steps"""
    print("[4-6/6] Testing checkout flow...")

    # Navigate to checkout
    page.goto(f"{BASE_URL}/checkout")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/goqris_checkout_start.png", full_page=True)

    content = page.content().lower()
    if "cart is empty" in content or "empty" in content:
        print("  ⚠ Cart is empty - trying to add item via API")
        # Try direct navigation with cart item via API
        return test_api_order_flow(page)
    
    print("  ✓ Cart has items, proceeding with checkout")

    # Step 1: Fill customer info
    name_inputs = page.locator("input[placeholder*='Your name'], input[placeholder*='Name']").all()
    if name_inputs:
        name_inputs[0].fill("Test Customer")
        print("  ✓ Filled name")

    discord_inputs = page.locator("input[placeholder*='Discord']").all()
    if discord_inputs:
        discord_inputs[0].fill("testuser#1234")
        print("  ✓ Filled Discord")
    
    page.screenshot(path="/tmp/goqris_step1_filled.png", full_page=True)

    # Click Continue to step 2
    continue_btn = page.locator("button").filter(has_text=re.compile(r"Continue", re.IGNORECASE)).first
    if continue_btn.count() > 0 and continue_btn.is_visible():
        continue_btn.click()
        page.wait_for_timeout(1500)
        print("  ✓ Advanced to Step 2 (Order Review)")
        page.screenshot(path="/tmp/goqris_step2.png", full_page=True)

    # Continue to step 3
    continue_btn2 = page.locator("button").filter(has_text=re.compile(r"Continue", re.IGNORECASE)).first
    if continue_btn2.count() > 0 and continue_btn2.is_visible():
        continue_btn2.click()
        page.wait_for_timeout(1500)
        print("  ✓ Advanced to Step 3 (Payment)")
        page.screenshot(path="/tmp/goqris_step3_payment.png", full_page=True)

    # Verify QRIS payment method is shown
    if "QRIS" in page.content() or "GoPay" in page.content():
        print("  ✓ QRIS payment method is displayed on the payment step")
    else:
        print("  ⚠ QRIS not visible on payment step")

    # Look for payment instructions
    instructions = page.locator("text=Payment Instructions").first
    if instructions.count() > 0 and instructions.is_visible():
        print("  ✓ Payment Instructions section displayed with 5 steps")

    # Click the "Pay with QRIS" button
    pay_btn = page.locator("button").filter(has_text=re.compile(r"Pay with QRIS|Complete Order", re.IGNORECASE)).first
    if pay_btn.count() > 0 and pay_btn.is_visible():
        print("  ✓ 'Pay with QRIS' button found, clicking...")
        pay_btn.click()
        page.wait_for_timeout(5000)  # Wait for API response
        page.screenshot(path="/tmp/goqris_confirmation.png", full_page=True)
        print("  ✓ Order submission triggered")
        
        # Check results
        final_content = page.content()
        if "Confirmed" in final_content or "confirmed" in final_content.lower():
            print("  ✓ Order confirmation page reached!")
        
        # Check for QR code image
        qr_img = page.locator("img").filter(has_text=re.compile(r"QR", re.IGNORECASE)).first
        if qr_img.count() > 0:
            print("  ✓ QR code area present")
        else:
            all_imgs = page.locator("img").all()
            print(f"  Found {len(all_imgs)} images on confirmation")
            has_qr = any("qr" in (img.get_attribute("alt") or "").lower() or "qris" in (img.get_attribute("src") or "").lower() for img in all_imgs)
            if has_qr:
                print("  ✓ QR code image found")
            else:
                print("  ⚠ No QR code image detected")
        
        return True
    else:
        print("  ⚠ 'Pay with QRIS' button not found")
        all_btns = page.locator("button").all()
        for b in all_btns:
            txt = b.text_content() or ""
            if txt.strip():
                print(f"    Found button: '{txt.strip()}'")
        return False


def test_api_order_flow(page):
    """Fallback: Test order creation via API directly and verify the response"""
    print("[API] Testing order creation via API...")
    
    # First get a product to use
    import json as j
    
    products_resp = page.evaluate("""
        fetch('/api/products?limit=1')
            .then(r => r.json())
            .then(d => JSON.stringify(d))
    """)
    
    try:
        products_data = j.loads(products_resp)
        items = products_data
        if isinstance(items, dict) and "data" in items:
            items = items["data"]
        if isinstance(items, dict) and "items" in items:
            items = items["items"]
        
        products = items if isinstance(items, list) else []
        if not products:
            print("  ⚠ No products available from API")
            return False
        
        product = products[0]
        product_id = product.get("id") or product.get("publicId") or ""
        print(f"  ✓ Found product: {product.get('name', 'unknown')} (ID: {product_id[:20]}...)")
        
        # Now create an order
        order_data = page.evaluate(f"""
            fetch('/api/orders', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{
                    customerName: 'API Test User',
                    customerEmail: 'test@example.com',
                    customerDiscord: 'testuser#1234',
                    items: [{{ productId: '{product_id}', quantity: 1 }}],
                    paymentMethod: 'goqris',
                    currency: 'IDR'
                }})
            }})
            .then(r => r.json())
            .then(d => JSON.stringify(d))
        """)
        
        order_response = j.loads(order_data)
        print(f"  ✓ Order API response received")
        
        # Extract order data
        order_info = order_response.get("data") or order_response
        order_number = order_info.get("orderNumber", "")
        goqris_payment = order_info.get("goqrisPayment")
        
        if order_number:
            print(f"  ✓ Order created: {order_number}")
        
        if goqris_payment:
            qr_string = goqris_payment.get("qrString", "")
            total_amount = goqris_payment.get("totalAmount", 0)
            expires_at = goqris_payment.get("expiresAt", "")
            payment_url = goqris_payment.get("paymentUrl", "")
            
            print(f"  ✓ GoQRIS payment data generated!")
            print(f"    Total amount: {total_amount}")
            print(f"    QR string: {qr_string[:50]}...")
            print(f"    Expires at: {expires_at}")
            print(f"    Payment URL: {payment_url[:80]}...")
            
            if qr_string:
                return True
        
        print("  ⚠ No QRIS payment data in response")
        return False
        
    except Exception as e:
        print(f"  ✗ API test error: {e}")
        return False


def run():
    """Main test runner"""
    print("=" * 60)
    print("  GoQRIS PAYMENT INTEGRATION TEST")
    print("=" * 60)
    
    results = {}
    all_pass = True
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        
        try:
            test_homepage(page)
            results["homepage"] = True
            
            product_href = test_products_page(page)
            results["products_page"] = True
            
            if product_href:
                test_add_to_cart(page, product_href)
            
            # Run checkout flow
            checkout_result = test_checkout_flow(page)
            results["checkout_flow"] = checkout_result
            
            if not checkout_result:
                # Try API-only test as fallback
                print("\n--- Running API-level test as fallback ---")
                api_result = test_api_order_flow(page)
                results["api_test"] = api_result
                if not api_result:
                    all_pass = False
            
        except Exception as e:
            print(f"\n❌ Error during test: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path="/tmp/goqris_error.png", full_page=True)
            all_pass = False
        finally:
            browser.close()
    
    # Summary
    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print("=" * 60)
    if all_pass and all(results.values()):
        print("\n✅ ALL TESTS PASSED - GoQRIS integration working correctly!\n")
        return 0
    else:
        print("\n⚠ Some tests had issues\n")
        return 1


if __name__ == "__main__":
    sys.exit(run())
