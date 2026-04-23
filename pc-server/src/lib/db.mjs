import mysql from "mysql2/promise";
import { isMysqlConfigured, serverConfig } from "./config.mjs";

let pool;

export function hasDatabase() {
  return isMysqlConfigured();
}

export async function getPool() {
  if (!hasDatabase()) {
    throw new Error("MySQL is not configured.");
  }

  if (!pool) {
    pool = mysql.createPool({
      host: serverConfig.mysql.host,
      port: serverConfig.mysql.port,
      user: serverConfig.mysql.user,
      password: serverConfig.mysql.password,
      database: serverConfig.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      multipleStatements: true,
    });
  }

  return pool;
}

export async function pingDatabase() {
  if (!hasDatabase()) {
    return false;
  }

  try {
    const activePool = await getPool();
    await activePool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function query(sql, params = {}) {
  const activePool = await getPool();
  const [rows] = await activePool.execute(sql, params);
  return rows;
}
