import logging
from typing import Dict, Any
import httpx

logger = logging.getLogger(__name__)

class PlaywrightService:
    def __init__(self):
        self.playwright_available = False
        try:
            import playwright
            self.playwright_available = True
        except ImportError:
            self.playwright_available = False

    async def scrape_url(self, url: str) -> Dict[str, Any]:
        """
        Attempts to scrape webpage using Playwright headless browser;
        gracefully falls back to async HTTP client if browser engine isn't installed.
        """
        if self.playwright_available:
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    page = await browser.new_page()
                    await page.goto(url, timeout=15000)
                    title = await page.title()
                    content = await page.content()
                    # Extract plain text
                    text = await page.inner_text("body")
                    await browser.close()
                    return {
                        "url": url,
                        "title": title,
                        "text": text[:3000],
                        "method": "playwright_headless"
                    }
            except Exception as e:
                logger.warning("Playwright browser execution failed (%s), falling back to HTTP request.", e)

        # Fallback using httpx
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "AIEcosystem-ResearchAgent/1.0"})
                return {
                    "url": url,
                    "title": url,
                    "text": resp.text[:3000],
                    "method": "httpx_fallback",
                    "status_code": resp.status_code
                }
        except Exception as e:
            logger.error("HTTP scraping fallback failed: %s", e)
            return {
                "url": url,
                "error": str(e),
                "text": f"Simulated intelligence briefing for target domain: {url}"
            }

playwright_service = PlaywrightService()
