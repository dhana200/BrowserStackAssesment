import { test, expect, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const RAPID_API_KEY = 'a33f51f64fmsh70389831c99ae05p12017ajsn1d4b9ab8ec0a';

test('Translate Spanish to English using RapidAPI', async ({ browser }) => {
  // Create APIRequestContext with baseURL and headers
  const apiContext = await request.newContext({
    baseURL: 'https://google-translator9.p.rapidapi.com',
    extraHTTPHeaders: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': 'google-translator9.p.rapidapi.com',
      'Content-Type': 'application/json'
    },
  });

  // Prepare the request payload
  const payload = {
    source: "es",
    target: "en",
    format: "text"
  };

  const page = await browser.newPage();

  // Visit El País homepage
  await page.goto('https://elpais.com/', { waitUntil: 'domcontentloaded' });
  // await page.pause();
  await page.getByRole('button', { name: 'Agree and close: Agree to our' }).click();
  // Check if the page language is Spanish
  const lang = await page.locator('html').getAttribute('lang');
  expect(lang?.startsWith('es')).toBeTruthy();

  // Navigate to the Opinion section
  await page.goto('https://elpais.com/opinion/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article');

  // Get all article link elements (anchor tags) inside articles
  const rawLinks = await page.evaluate(() => {
    const elements = document.querySelectorAll('article h2 a[href]');
    const hrefs = Array.from(elements).map(el => (el as HTMLAnchorElement).href);
    const uniqueLinks = Array.from(new Set(hrefs));
    const opinionLinks = uniqueLinks.filter(link => link.includes('/opinion/'));
    return opinionLinks.slice(0, 5);
  });

  const articleUrls = rawLinks;
  const translatedTitles: string[] = [];

  for (let i = 0; i < articleUrls.length; i++) {
    const url = articleUrls[i];
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract title and article content
    const title = await page.locator('h1').textContent();
    const paragraphs = await page.locator('article h2').first().textContent() || '';

    // Download and save the first image if available
    const imageUrl = await page.locator('article img').first().getAttribute('src');
    if (imageUrl && imageUrl.startsWith('http')) {
      const imgPath = path.resolve(`article-${i + 1}.jpg`);
      const response = await axios.get(imageUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(imgPath);
      response.data.pipe(writer);
      await new Promise<void>(resolve => writer.on('finish', () => resolve()));
    }

    // Translate title to English
    const titlePayload = { ...payload, q: title };
    const response = await apiContext.post('/v2', { data: titlePayload });
    const responseData: any = await response.json();
    const translatedTitle = responseData.data.translations[0].translatedText;
    
    console.log(`Title ${i + 1}:`, translatedTitle);
    console.log(`Content:`, paragraphs);

    await page.waitForTimeout(3000); // Wait for 3 seconds to avoid hitting API limits
    translatedTitles.push(translatedTitle);    
  }

  // After processing all articles, check for repeated words in translatedTitles
  const allWords = translatedTitles
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/);

  const wordFrequency: { [word: string]: number } = {};
  for (const word of allWords) {
    if (word.length > 0) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  }

  // Find and print words repeated more than twice
  console.log('Repeated words (more than twice) in translated titles:');
  for (const [word, count] of Object.entries(wordFrequency)) {
    if (count > 2) {
      console.log(`${word}: ${count}`);
    }
  }
});