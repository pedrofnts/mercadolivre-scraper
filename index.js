require("dotenv").config();
const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const puppeteer = require("puppeteer");

const accessToken = process.env.ACCESS_TOKEN;
const query =
  process.argv[2] ||
  "Refil Compatível Soft Everest Star Slim Fit Plus Baby Cor Branco";
const apiUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(
  query
)}`;

const priceRanges = [
  { min: 0, max: 50 },
  { min: 51, max: 100 },
  { min: 101, max: 200 },
  { min: 201, max: 500 },
  { min: 501, max: 1000 },
  { min: 1001, max: 5000 },
];

const csvWriter = createCsvWriter({
  path: "results.csv",
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
});

async function fetchItems(url, offset = 0, items = []) {
  if (offset >= 1000) {
    console.log("Reached maximum allowed offset for public users");
    return items;
  }

  try {
    const response = await axios.get(`${url}&offset=${offset}&limit=50`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = response.data;
    if (data.results) {
      data.results.forEach((item) => {
        const attributes = {
          brand: null,
          units_per_pack: null,
          gtin: null,
        };

        item.attributes.forEach((attr) => {
          if (attr.id === "BRAND") attributes.brand = attr.value_name;
          if (attr.id === "UNITS_PER_PACK")
            attributes.units_per_pack = attr.value_name;
          if (attr.id === "GTIN") attributes.gtin = attr.value_name;
        });

        const seller = item.seller
          ? { id: item.seller.id, nickname: item.seller.nickname }
          : { id: null, nickname: null };
        const installments = item.installments
          ? {
              quantity: item.installments.quantity,
              amount: item.installments.amount,
              rate: item.installments.rate,
              currency_id: item.installments.currency_id,
            }
          : { quantity: null, amount: null, rate: null, currency_id: null };

        items.push({
          id: item.id,
          title: item.title,
          price: item.price,
          currency_id: item.currency_id,
          available_quantity: item.available_quantity,
          sold_quantity: item.sold_quantity,
          permalink: item.permalink,
          brand_value: attributes.brand,
          units_per_pack_value: attributes.units_per_pack,
          gtin_value: attributes.gtin,
          seller_id: seller.id,
          seller_nickname: seller.nickname,
          installments_quantity: installments.quantity,
          installments_amount: installments.amount,
          installments_rate: installments.rate,
          installments_currency_id: installments.currency_id,
        });
      });

      if (data.paging.total > offset + 50) {
        return fetchItems(url, offset + 50, items);
      }
    } else {
      console.error("No results found or data format unexpected:", data);
    }

    return items;
  } catch (error) {
    console.error(
      "Error fetching data:",
      error.response ? error.response.data : error.message
    );
    return items;
  }
}

async function fetchAdditionalInfo(items) {
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

  for (let item of items) {
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
  }

  await browser.close();
  return items;
}

async function main() {
  let allItems = [];
  for (const range of priceRanges) {
    console.log(`Fetching data for price range ${range.min} - ${range.max}`);
    const url = `${apiUrl}&price=${range.min}-${range.max}`;
    const items = await fetchItems(url);
    allItems = allItems.concat(items);
  }

  if (allItems.length > 0) {
    console.log("Fetching additional info from product pages...");
    const itemsWithAdditionalInfo = await fetchAdditionalInfo(allItems);
    await csvWriter.writeRecords(itemsWithAdditionalInfo);
    console.log("Data saved to results.csv");
  } else {
    console.log("No data found");
  }
}

main();
