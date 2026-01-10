
from playwright.sync_api import sync_playwright
import os

def generate_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Load the page
        page.goto(f"file://{os.getcwd()}/index.html")

        # Wait for tutorial modal
        try:
            page.wait_for_selector(".tutorial-modal", timeout=3000)
            page.screenshot(path="/home/jules/verification/tutorial_modal.png")
            print("Captured tutorial_modal.png")
            page.click("#tutorialClose")
        except:
            print("Tutorial modal skipped")

        # 1. Format Toolbar
        page.locator("#exportNotes").fill("Sample Note")
        page.locator("#exportNotes").select_text()
        page.click("#fmtBold")
        page.click("#exportNotes") # focus back
        page.type("#exportNotes", "\nNew Item")
        page.click("#fmtList")

        page.screenshot(path="/home/jules/verification/notes_toolbar.png")
        print("Captured notes_toolbar.png")

        # 2. Header Icons (Theme & Tutorial)
        page.wait_for_selector("#showTutorialBtn")
        page.screenshot(path="/home/jules/verification/header_icons.png")
        print("Captured header_icons.png")

        browser.close()

if __name__ == "__main__":
    generate_screenshots()
