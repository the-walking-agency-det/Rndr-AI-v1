from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto('http://localhost:4243/')
            page.wait_for_timeout(5000)

            # Login
            if page.get_by_role('button', name='Sign In').is_visible():
                print('Logging in...')
                page.get_by_placeholder('artist@indiios.com').fill('test@indiios.com')
                page.locator('input[type="password"]').fill('password')
                page.get_by_role('button', name='Sign In').click()
                page.wait_for_timeout(5000)

            # Verify login success
            print(f'Current URL: {page.url}')

            # The dashboard component has a section Reference Assets
            # It renders <ReferenceImageManager /> under it.

            if page.get_by_text('Reference Assets').is_visible():
                print('Found Reference Assets section')
                # Take screenshot of that section
                # Try to locate the heading and get the next sibling or parent container
                section = page.locator('text=Reference Assets').first.locator('xpath=../..')
                section.screenshot(path='verification/reference_manager_section.png')
            else:
                print('Dashboard not loaded or Reference Assets not visible.')
                page.screenshot(path='verification/dashboard_failed.png')

        except Exception as e:
            print(f'Error: {e}')
        finally:
            browser.close()

if __name__ == '__main__':
    run()
