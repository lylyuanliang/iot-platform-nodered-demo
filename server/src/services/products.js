import { pool } from "../db/pool.js";

export async function listProducts() {
  const [rows] = await pool.query("SELECT * FROM product ORDER BY id");
  return rows;
}

export async function listThingModel(productKey) {
  const [rows] = await pool.query(
    "SELECT * FROM thing_model WHERE product_key = ? ORDER BY id",
    [productKey]
  );
  return rows;
}
