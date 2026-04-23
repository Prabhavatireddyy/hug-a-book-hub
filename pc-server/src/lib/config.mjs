import { resolve } from "node:path";

const backendPort = Number(process.env.PC_SERVER_PORT ?? process.env.PORT ?? 8788);
const publicBaseUrl = process.env.PUBLIC_BACKEND_URL?.trim() || `http://localhost:${backendPort}`;
const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim() || "";
const uploadsDir = resolve(process.cwd(), "pc-server", "uploads");

export const serverConfig = {
  port: Number.isNaN(backendPort) ? 8788 : backendPort,
  publicBaseUrl,
  frontendOrigin,
  sessionCookieName: "bookhug_session",
  uploadsDir,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL?.trim() ||
      `${publicBaseUrl.replace(/\/$/, "")}/api/auth/google/callback`,
  },
  mysql: {
    host: process.env.MYSQL_HOST?.trim() || "",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER?.trim() || "",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE?.trim() || "",
  },
};

export function isGoogleConfigured() {
  return Boolean(
    serverConfig.google.clientId &&
      serverConfig.google.clientSecret &&
      serverConfig.google.callbackUrl,
  );
}

export function isMysqlConfigured() {
  return Boolean(
    serverConfig.mysql.host &&
      serverConfig.mysql.user &&
      serverConfig.mysql.database,
  );
}
