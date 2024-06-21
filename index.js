require("dotenv").config();
const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const accessToken = process.env.ACCESS_TOKEN;
const query =
  process.argv[2] ||
  "Refil Compatível Soft Everest Star Slim Fit Plus Baby Cor Branco";
const apiUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(
  query
)}`;

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
    { id: "brand_id", title: "Brand ID" },
    { id: "brand_value", title: "Brand Value" },
    { id: "units_per_pack_id", title: "Units per Pack ID" },
    { id: "units_per_pack_value", title: "Units per Pack Value" },
    { id: "gtin_id", title: "GTIN ID" },
    { id: "gtin_value", title: "GTIN Value" },
    { id: "seller_id", title: "Seller ID" },
    { id: "seller_nickname", title: "Seller Nickname" },
    { id: "installments_quantity", title: "Installments Quantity" },
    { id: "installments_amount", title: "Installments Amount" },
    { id: "installments_rate", title: "Installments Rate" },
    { id: "installments_currency_id", title: "Installments Currency ID" },
  ],
});

async function fetchItems(offset = 0, items = []) {
  if (offset >= 1000) {
    console.log("Reached maximum allowed offset for public users");
    return items;
  }

  try {
    const response = await axios.get(`${apiUrl}&offset=${offset}&limit=50`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = response.data;
    if (data.results) {
      data.results.forEach((item) => {
        const attributes = {
          brand: { id: null, value_name: null },
          units_per_pack: { id: null, value_name: null },
          gtin: { id: null, value_name: null },
        };

        item.attributes.forEach((attr) => {
          if (attr.id === "BRAND") attributes.brand = attr;
          if (attr.id === "UNITS_PER_PACK") attributes.units_per_pack = attr;
          if (attr.id === "GTIN") attributes.gtin = attr;
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
          brand_id: attributes.brand.id,
          brand_value: attributes.brand.value_name,
          units_per_pack_id: attributes.units_per_pack.id,
          units_per_pack_value: attributes.units_per_pack.value_name,
          gtin_id: attributes.gtin.id,
          gtin_value: attributes.gtin.value_name,
          seller_id: seller.id,
          seller_nickname: seller.nickname,
          installments_quantity: installments.quantity,
          installments_amount: installments.amount,
          installments_rate: installments.rate,
          installments_currency_id: installments.currency_id,
        });
      });

      if (data.paging.total > offset + 50 && offset + 50 < 1000) {
        return fetchItems(offset + 50, items);
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
  console.log("Fetching data from Mercado Livre...");
  const items = await fetchItems();

  if (items && items.length > 0) {
    await csvWriter.writeRecords(items);
    console.log("Data saved to results.csv");
  } else {
    console.log("No data found");
  }
}

main();
