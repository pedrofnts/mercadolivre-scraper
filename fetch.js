const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const puppeteer = require("puppeteer");

const inputFileName = process.argv[2] || "results.csv";
const outputFileName = process.argv[3] || "final_results.csv";

const csvWriter = createCsvWriter({
  path: outputFileName,
  header: [
    { id: "id", title: "ID" },
    { id: "title", title: "Title" },
    { id: "price", title: "Price" },
    { id: "currency_id", title: "Currency" },
    { id: "available_quantity", title: "Available Quantity" },
    { id: "sold_quantity", title: "Sold Quantity" },
    { id: "permalink", title: "Permalink" },
    { id: "brand_value", title: "Brand" },
    { id: "units_per_pack_value", title: "Units per Pack" },
    { id: "gtin_value", title: "GTIN" },
    { id: "seller_id", title: "Seller ID" },
    { id: "seller_nickname", title: "Seller Nickname" },
    { id: "installments_quantity", title: "Installments Quantity" },
    { id: "installments_amount", title: "Installments Amount" },
    { id: "installments_rate", title: "Installments Rate" },
    { id: "installments_currency_id", title: "Installments Currency ID" },
    { id: "rating", title: "Rating" },
    { id: "review_count", title: "Review Count" },
    { id: "sales_number", title: "Sales Number" },
  ],
  append: true,
});

async function fetchAdditionalInfo(item, page) {
  try {
    await page.goto(item.permalink, { waitUntil: "networkidle2" });

    let rating = null;
    try {
      await page.waitForSelector(".ui-pdp-review__rating", { timeout: 5000 });
      rating = await page.$eval(".ui-pdp-review__rating", (el) =>
        el.textContent.trim()
      );
    } catch {
      console.log(
        `Rating not found for product ${item.id} (${item.permalink})`
      );
    }

    let reviewCount = null;
    try {
      await page.waitForSelector(".ui-pdp-review__amount", { timeout: 5000 });
      reviewCount = await page.$eval(".ui-pdp-review__amount", (el) =>
        el.textContent.trim()
      );
    } catch {
      console.log(
        `Review count not found for product ${item.id} (${item.permalink})`
      );
    }

    let salesNumber = null;
    try {
      await page.waitForSelector(".ui-pdp-subtitle", { timeout: 5000 });
      salesNumber = await page.$eval(".ui-pdp-subtitle", (el) =>
        el.textContent.trim()
      );
    } catch {
      console.log(
        `Sales number not found for product ${item.id} (${item.permalink})`
      );
    }

    item.rating = rating;
    item.review_count = reviewCount;
    item.sales_number = salesNumber;
  } catch (error) {
    console.error(
      `Error fetching additional info for ${item.permalink}:`,
      error
    );
    item.rating = null;
    item.review_count = null;
    item.sales_number = null;
  }
  return item;
}

async function main() {
  const items = fs
    .readFileSync(inputFileName, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [
        id,
        title,
        price,
        currency_id,
        available_quantity,
        sold_quantity,
        permalink,
        brand_value,
        units_per_pack_value,
        gtin_value,
        seller_id,
        seller_nickname,
        installments_quantity,
        installments_amount,
        installments_rate,
        installments_currency_id,
      ] = line.split(",");

      return {
        id,
        title,
        price,
        currency_id,
        available_quantity,
        sold_quantity,
        permalink,
        brand_value,
        units_per_pack_value,
        gtin_value,
        seller_id,
        seller_nickname,
        installments_quantity,
        installments_amount,
        installments_rate,
        installments_currency_id,
      };
    });

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (["image", "font"].indexOf(request.resourceType()) !== -1)
      request.abort();
    else request.continue();
  });

  const fileExists = fs.existsSync(outputFileName);

  if (!fileExists) {
    await csvWriter.writeRecords([]); // This will create the file with headers if it doesn't exist
  }

  for (let item of items) {
    const itemWithInfo = await fetchAdditionalInfo(item, page);
    await csvWriter.writeRecords([itemWithInfo]);
    console.log(`Data for item ${item.id} saved to ${outputFileName}`);
  }

  await browser.close();
}

main();
