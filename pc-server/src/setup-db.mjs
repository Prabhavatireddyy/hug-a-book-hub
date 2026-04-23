import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { isMysqlConfigured, serverConfig } from "./lib/config.mjs";

if (!isMysqlConfigured()) {
  console.error("MySQL environment variables are missing.");
  process.exit(1);
}

const schemaPath = resolve(process.cwd(), "pc-server", "schema.sql");
const sql = await readFile(schemaPath, "utf8");
const connection = await mysql.createConnection({
  host: serverConfig.mysql.host,
  port: serverConfig.mysql.port,
  user: serverConfig.mysql.user,
  password: serverConfig.mysql.password,
  database: serverConfig.mysql.database,
  multipleStatements: true,
});

await connection.query(sql);
await connection.end();
console.log("BookHug schema applied successfully.");
