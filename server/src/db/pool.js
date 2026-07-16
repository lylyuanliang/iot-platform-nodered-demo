import mysql from "mysql2/promise";
import { config } from "../config.js";

export const pool = mysql.createPool({
  ...config.mysql,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});

pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+08:00'");
});
