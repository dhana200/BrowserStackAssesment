const { test, expect, request } = require("@playwright/test");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const RAPID_API_KEY =
  process.env.RAPID_API_KEY ||
  "a33f51f64fmsh70389831c99ae05p12017ajsn1d4b9ab8ec0a";

// Detect if running on BrowserStack
const isBrowserStack = !!process.env.BROWSERSTACK_USERNAME;

test("Translate Spanish to English using RapidAPI", async ({ page }) => {
  const apiContext = await request.newContext({
    baseURL: "https://google-translator9.p.rapidapi.com",
    extraHTTPHeaders: {
      "x-rapidapi-key": RAPID_API_KEY,
      "x-rapidapi-host": "google-translator9.p.rapidapi.com",
      "Content-Type": "application/json",
    },
  });

  const payload = { source: "es", target: "en", format: "text" };

  await page.goto("https://elpais.com/", { waitUntil: "domcontentloaded" });

  const cookieBtn = page.getByRole("button", { name: /Agree and close/i });
  if (await cookieBtn.isVisible()) await cookieBtn.click();

  const lang = await page.locator("html").getAttribute("lang");
  expect(lang?.startsWith("es")).toBeTruthy();

  await page.goto("https://elpais.com/opinion/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("article");

  //  Fewer articles on BrowserStack to save time
  const rawLinks = await page.evaluate(
    (limit) => {
      const elements = document.querySelectorAll("article h2 a[href]");
      const hrefs = Array.from(elements).map((el) => el.href);
      const uniqueLinks = Array.from(new Set(hrefs));
      const opinionLinks = uniqueLinks.filter((link) =>
        link.includes("/opinion/")
      );
      return opinionLinks.slice(0, limit);
    },
    isBrowserStack ? 2 : 5
  );

  const translatedTitles = [];

  for (let i = 0; i < rawLinks.length; i++) {
    await page.goto(rawLinks[i], { waitUntil: "domcontentloaded" });

    const title = await page.locator("h1").textContent();
    const paragraphs =
      (await page.locator("article h2").first().textContent()) || "";

    //  Download images locally (skip on BrowserStack)
    if (!isBrowserStack) {
      const imageUrl = await page
        .locator("article img")
        .first()
        .getAttribute("src");
      if (imageUrl && imageUrl.startsWith("http")) {
        try {
          console.log(`Downloading image: ${imageUrl}`);

          // Fetch image as a buffer
          const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
          });

          // Create a safe filename based on the article index
          const fileExt = path.extname(new URL(imageUrl).pathname) || ".jpg";
          const imgPath = path.resolve(`article-${i + 1}${fileExt}`);

          // Save the image to disk
          fs.writeFileSync(imgPath, response.data);
          console.log(
            ` Saved ${imgPath} (${Math.round(
              response.data.byteLength / 1024
            )} KB)`
          );
        } catch (err) {
          console.log(` Image download failed: ${err.message}`);
        }
      }
    }

    const titlePayload = { ...payload, q: title };
    const response = await apiContext.post("/v2", { data: titlePayload });
    const responseData = await response.json();
    const translatedTitle = responseData.data.translations[0].translatedText;

    console.log(`Title ${i + 1}:`, translatedTitle);
    console.log(`Content:`, paragraphs);

    await page.waitForTimeout(1500); // slight delay for API limit
    translatedTitles.push(translatedTitle);
  }

  // Word frequency analysis
  const allWords = translatedTitles
    .join(" ")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/);
  const wordFrequency = {};
  for (const word of allWords) {
    if (word) wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  }

  console.log("Repeated words (>2 times):");
  Object.entries(wordFrequency).forEach(([word, count]) => {
    if (count > 2) console.log(`${word}: ${count}`);
  });
});
