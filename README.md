# scrapeMe

An interactive image scraper with a browser-based interface built using Express, Puppeteer, and TypeScript. 
Crawl a website, grab image metadata (URL, dimensions, estimated file size), and download results as a CSV.

## Features

- Crawl up to 10 web pages
- Extract image URLs, resolutions, and approximate file sizes
- Save data locally in CSV format
- View results in-browser with a friendly GUI
- CLI tool also available for power users

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/jasll/scrapeMe.git
cd scrapeMe
npm install

### 2. Run the GUI scraper
npx ts-node guiServer.ts

### 3. Run CLI Scraper (Optional)
npx ts-node scrapeImageDetailsCrawler.ts

### Tech Stack

Tool	    Purpose
Express	    Web server & GUI
Puppeteer	Headless browser crawling
TypeScript	Type safety & structure
ts-node	    Run TS without manual build

### Output Format

After scraping, a CSV file named image-details.csv is saved to your desktop. Each row contains:

- Image URL
- Width × Height
- File size (KB)
- Source page

### License

MIT
