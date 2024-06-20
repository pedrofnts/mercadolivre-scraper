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
    { id: "attributes", title: "Attributes" },
  ],
});

async function fetchItems(offset = 0, items = []) {
  try {
    const response = await axios.get(`${apiUrl}&offset=${offset}&limit=50`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = response.data;
    data.results.forEach((item) => {
      const attributes = item.attributes
        .map((attr) => `${attr.name}: ${attr.value_name}`)
        .join(", ");
      items.push({
        id: item.id,
        title: item.title,
        price: item.price,
        currency_id: item.currency_id,
        available_quantity: item.available_quantity,
        sold_quantity: item.sold_quantity,
        permalink: item.permalink,
        attributes: attributes,
      });
    });

    if (data.paging.total > offset + 50) {
      return fetchItems(offset + 50, items);
    }

    return items;
  } catch (error) {
    console.error(
      "Error fetching data:",
      error.response ? error.response.data : error.message
    );
  }
}

async function main() {
  console.log("Fetching data from Mercado Livre...");
  const items = await fetchItems();

  if (items.length > 0) {
    await csvWriter.writeRecords(items);
    console.log("Data saved to results.csv");
  } else {
    console.log("No data found");
  }
}

main();
