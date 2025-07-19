# scrapeMe

An interactive image scraper with a browser-based interface built using Express, Puppeteer, and TypeScript. Crawl any website, grab image metadata (URL, dimensions, estimated file size), and export results to CSV.

---

## Features

- Crawl up to 10 web pages from a given site
- Extract image URLs, dimensions, and file sizes
- Save metadata locally as CSV
- Preview results via a clean GUI
- Optional CLI for advanced scraping

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/jasll/scrapeMe.git
cd scrapeMe
npm install

2. Run GUI Version
```bash
npx ts-node guiServer.ts

Visit http://localhost:3000 to launch the GUI.

3. Run CLI Version (Optional)
```bash
npx ts-node scrapeImageDetailsCrawler.ts

Tech Stack
Tool	        Role
Express	      Web server and GUI frontend
Puppeteer	    Headless browser scraping
TypeScript	  Type-safe architecture
ts-node	Run   TypeScript directly

Output Format

The scraper saves results to image-details.csv on your desktop. Each row contains:
Image URL
Resolution (Width × Height)
Estimated File Size
Source Page URL

Setup Notes

If you see TypeScript errors like missing type declarations for Express, run:
```bash
npm install --save-dev @types/express

This installs required types for successful compilation.

License

MIT

