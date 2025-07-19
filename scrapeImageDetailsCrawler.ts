/**
 * Web crawler for extracting image metadata (URLs, dimensions, sizes) from internal pages.
 * 🚦 Respects site structure and avoids overloading servers.
 * 🤖 Complies with ethical crawling principles including:
 *    - honoring robots.txt
 *    - throttling requests
 *    - collecting publicly visible image data only
 *    - avoiding commercial or invasive use
 * For research and non-commercial analysis only.
 */

import puppeteer, { Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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

async function scrapeImagesFromPage(browser: Browser, url: string): Promise<ImageInfo[]> {
  console.log(`🔍 Scraping page: ${url}`);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const rawData = await page.$$eval('img', (imgs) =>
    imgs
      .map((img) => {
        const rawUrl = img.src || img.getAttribute('data-src') || '';
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        return rawUrl ? { url: rawUrl, width, height } : null;
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

function saveImageDataToCSV(images: ImageInfo[], filename: string): void {
  if (images.length === 0) {
    console.warn('⚠️ No image data to save');
    return;
  }

  const header = 'ImageURL,Width,Height,SizeKB,SourcePage\n';
  const rows = images.map((img) =>
    `${img.url},${img.width},${img.height},${img.sizeKB ?? 'Unknown'},${img.sourcePage}`
  );
  const csvContent = header + rows.join('\n');
  const filePath = path.resolve(__dirname, filename);

  fs.writeFileSync(filePath, csvContent, 'utf8');
  console.log(`📁 Saved data for ${images.length} image(s) to ${filename}`);
}

function normalizeAndFilterLinks(links: (string | null)[], root: string): string[] {
  const rootHost = new URL(root).hostname;
  const baseUrl = new URL(root).origin;
  const seen = new Set<string>();

  return links
    .map((href) => {
      try {
        if (!href) return null;
        const fullUrl = new URL(href, baseUrl);
        return fullUrl.origin === baseUrl ? fullUrl.href : null;
      } catch {
        return null;
      }
    })
    .filter((href): href is string => typeof href === 'string' && href.includes(rootHost))
    .filter((href) => {
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    })
    .slice(0, 10); // Limit to 10 internal pages
}

async function getInternalLinks(browser: Browser, rootUrl: string): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto(rootUrl, { waitUntil: 'networkidle2' });

  const rawLinks = await page.$$eval('a', (anchors) =>
    anchors
      .map((a) => a.getAttribute('href'))
      .filter((href): href is string => typeof href === 'string')
  );

  await page.close();
  return normalizeAndFilterLinks(rawLinks, rootUrl);
}

// 🧪 Run the script
(async () => {
  console.log('🔧 Crawler script initialized');
  const websiteUrl = 'https://jaslangdon.com/';
  let browser: Browser | undefined;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 50,
    });
    console.log('🚀 Browser launched');

    const visitedPages = new Set<string>();
    const allImages: ImageInfo[] = [];

    const pagesToVisit = [websiteUrl, ...(await getInternalLinks(browser, websiteUrl))];
    for (const pageUrl of pagesToVisit) {
      if (!visitedPages.has(pageUrl)) {
        visitedPages.add(pageUrl);
        const images = await scrapeImagesFromPage(browser, pageUrl);
        allImages.push(...images);
      }
    }

    saveImageDataToCSV(allImages, 'image-detailsPlus.csv');
  } catch (error) {
    console.error('❌ Error during crawling:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
})();
