import { chromium } from 'playwright';
import * as fs from 'fs';
import axios from 'axios';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

// Get the RapidAPI key from .env
const RAPID_API_KEY = process.env.RAPID_API_KEY || '';

// Function to translate text from Spanish to English using RapidAPI
const translateText = async (text: string): Promise<string> => {
  try {
    const response = await axios.post(
      'https://rapid-translate-multi-traduction.p.rapidapi.com/t',
      {
        from: 'es',
        to: 'en',
        q: text,
      },
      {
        headers: {
          'content-type': 'application/json',
          'X-RapidAPI-Host': 'rapid-translate-multi-traduction.p.rapidapi.com',
          'X-RapidAPI-Key': RAPID_API_KEY,
        },
      }
    );

    return response.data[0];
  } catch (error) {
    if (error instanceof Error) {
      console.error('Translation failed:', error.message);
    } else {
      console.error('Translation failed:', error);
    }
    return '[Translation Error]';
  }
};

(async () => {
  // Launch the browser
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Visit El País homepage
  console.log(`Visiting El País...`);
  await page.goto('https://elpais.com/', { waitUntil: 'domcontentloaded' });

  // Check if the page language is Spanish
  const lang = await page.locator('html').getAttribute('lang');
  if (lang?.startsWith('es')) {
    console.log(`Website is in Spanish (lang="${lang}")`);
  } else {
    console.log(`Website is NOT in Spanish (lang="${lang}")`);
  }

  // Navigate to the Opinion section
  console.log(`Navigating to Opinion Section...`);
  await page.goto('https://elpais.com/opinion/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article');

  // Get all article link elements (anchor tags) inside articles
  const rawLinks = await page.$$eval('article h2 a[href]', elements => {
    const hrefs: string[] = [];

    for (const element of elements) {
      const link = (element as HTMLAnchorElement).href; // get the href of each link
      hrefs.push(link);
    }

    // Remove duplicate links using Set
    const uniqueLinks = Array.from(new Set(hrefs));

    // Keep only links that are part of the "opinion" section
    const opinionLinks = uniqueLinks.filter(link => link.includes('/opinion/'));

    // Return only the first 5 links
    return opinionLinks.slice(0, 5);
  });

  // Store them in a variable
  const articleUrls = rawLinks;


  const translatedTitles: string[] = [];
  const wordCount: Record<string, number> = {};

  // Iterate through the article URLs
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
      console.log(`Image saved to ${imgPath}`);
    } else {
      console.log(`No image found.`);
    }

    // Print title and partial content
    console.log(`Title (Spanish): ${title}`);
    console.log(`Content (first 300 chars):\n${paragraphs.slice(0, 300)}...`);

    // Translate title to English
    const translated = await translateText(title || '');
    await page.waitForTimeout(3000); // Wait for 3 seconds to avoid hitting API limits
    translatedTitles.push(translated);
    console.log(`Translated Title: ${translated}`);

    // Count words in translated title
    const words = translated.toLowerCase(); // convert to lowercase
    const cleanText = words.replace(/[^a-z\s]/g, ''); // remove punctuation or symbols (keep only letters and spaces)
    const wordList = cleanText.split(/\s+/); // split into individual words (by spaces)

    for (const word of wordList) {
      if (word.length > 2) { // ignore very short words (e.g. "a", "to")
        if (wordCount[word]) {
          wordCount[word] += 1; // if already counted, increment
        } else {
          wordCount[word] = 1; // otherwise, set it to 1
        }
      }
    }
  }

  // Print repeated words from translated titles
  console.log(`\nRepeated Words in Translated Headers (more than 2 occurrences):`);
  // Go through each word and its count in the wordCount object
  for (const word in wordCount) {
    const count = wordCount[word];

    // Only print words that appear more than 2 times
    if (count > 2) {
      console.log(word + ': ' + count + ' times');
    }
  }


  // Close the browser
  await browser.close();
})();
