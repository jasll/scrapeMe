import express from 'express';
import path from 'path';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  sizeKB: number | null;
  sourcePage: string;
}

function getFileSizeInKB(imageUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(imageUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const request = protocol.request(
        {
          method: 'HEAD',
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          port: parsedUrl.port || undefined,
          timeout: 5000,
        },
        (res) => {
          const length = res.headers['content-length'];
          resolve(length ? Math.round(parseInt(length, 10) / 1024) : null);
        }
      );

      request.on('error', () => resolve(null));
      request.end();
    } catch {
      resolve(null);
    }
  });
}

async function scrapeImagesFromPage(browser: puppeteer.Browser, url: string): Promise<ImageInfo[]> {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const rawData = await page.$$eval('img', (imgs: HTMLImageElement[]) =>
    imgs
      .map((img: HTMLImageElement) => {
        const url = img.src || img.getAttribute('data-src') || '';
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        return url ? { url, width, height } : null;
      })
      .filter((item): item is { url: string; width: number; height: number } => Boolean(item))
  );

  const imageData: ImageInfo[] = [];
  for (const item of rawData) {
    const sizeKB = await getFileSizeInKB(item.url);
    imageData.push({ ...item, sizeKB, sourcePage: url });
  }

  await page.close();
  return imageData;
}

async function getInternalLinks(browser: puppeteer.Browser, rootUrl: string): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto(rootUrl, { waitUntil: 'networkidle2' });

  const rawLinks = await page.$$eval('a', (anchors: HTMLAnchorElement[]) =>
    anchors
      .map((a: HTMLAnchorElement) => a.getAttribute('href'))
      .filter((href: string | null): href is string => typeof href === 'string')
  );

  await page.close();

  const baseUrl = new URL(rootUrl).origin;
  const rootHost = new URL(rootUrl).hostname;
  const seen = new Set<string>();

  return rawLinks
    .map((href: string) => {
      try {
        const fullUrl = new URL(href, baseUrl);
        return fullUrl.origin === baseUrl ? fullUrl.href : null;
      } catch {
        return null;
      }
    })
    .filter((href: string | null): href is string =>
      typeof href === 'string' && href.includes(rootHost)
    )
    .filter((href: string) => {
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    })
    .slice(0, 10);
}

app.post('/scrape', async (req, res) => {
  const targetUrl = req.body.url?.trim();
  if (!targetUrl) return res.status(400).send('No URL provided');

  const finalUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
  console.log(`🧭 Crawling from: ${finalUrl}`);
  let browser: puppeteer.Browser | undefined;

  try {
    browser = await puppeteer.launch({ headless: true });
    const allImages: ImageInfo[] = [];

    const pagesToVisit = [finalUrl, ...(await getInternalLinks(browser, finalUrl))];
    for (const pageUrl of pagesToVisit) {
      const pageImages = await scrapeImagesFromPage(browser, pageUrl);
      allImages.push(...pageImages);
    }

    // Save CSV
    const csvContent = 'ImageURL,Width,Height,SizeKB,SourcePage\n' +
      allImages.map(img =>
        `${img.url},${img.width},${img.height},${img.sizeKB ?? 'Unknown'},${img.sourcePage}`
      ).join('\n');

    const desktopPath = path.join(require('os').homedir(), 'Desktop', 'image-details.csv');
    fs.writeFileSync(desktopPath, csvContent, 'utf8');
    console.log(`📁 Saved to desktop as image-details.csv`);

    // Send HTML result
    const tableRows = allImages.map(img => `
      <tr>
        <td><a href="${img.url}" target="_blank">${img.url}</a></td>
        <td>${img.width}</td>
        <td>${img.height}</td>
        <td>${img.sizeKB ?? 'Unknown'} KB</td>
        <td><a href="${img.sourcePage}" target="_blank">Page</a></td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scrape Results</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; background: #f2f7fc; }
          h2 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; background: white; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #e5f1fb; }
          a { color: #3366cc; text-decoration: none; }
        </style>
      </head>
      <body>
        <h2>✅ Scraped ${allImages.length} image(s) from ${pagesToVisit.length} page(s)</h2>
        <p>CSV also saved to your desktop ✅</p>
        <table>
          <tr>
            <th>Image URL</th>
            <th>Width</th>
            <th>Height</th>
            <th>Size (KB)</th>
            <th>Source Page</th>
          </tr>
          ${tableRows}
        </table>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('❌ Scraping error:', err);
    res.status(500).send('Scraping failed.');
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 App running at http://localhost:${PORT}`);
});
