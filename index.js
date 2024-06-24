require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const accessToken = process.env.ACCESS_TOKEN;
const query =
  process.argv[2] ||
  "Refil Compatível Soft Everest Star Slim Fit Plus Baby Cor Branco";
const fileName = process.argv[3] || "results.csv";
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
  path: fileName,
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
  ],
  append: true, // Append to the existing CSV file
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

async function main() {
  for (const range of priceRanges) {
    console.log(`Fetching data for price range ${range.min} - ${range.max}`);
    const url = `${apiUrl}&price=${range.min}-${range.max}`;
    const items = await fetchItems(url);
    if (items.length > 0) {
      await csvWriter.writeRecords(items);
      console.log(
        `Data for price range ${range.min} - ${range.max} saved to ${fileName}`
      );
    }
  }
}

main();
