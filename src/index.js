#!/usr/bin/env node
const app = require("./app");
const http = require("http");
const db = require("./config/db_conn");
const logger = require("./config/logger");
const socketConfig = require("./config/socket_io");

const port = normalizePort(process.env.PORT || "4000");
let server;

db.connectToServer(function (err) {
  if (err) {
    console.log(err);
    return;
  }

  logger.info("Connected to MongoDB");

  server = app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    startEnginesInBackground();
  });

  socketConfig.connect(server);
});

function startEnginesInBackground() {
  setTimeout(() => {
    (async () => {
      try {
        const priceEngine = require("./engine/priceEngine");
        console.log('[Boot] Starting price engine...');
        await priceEngine.start();
        console.log('[Boot] Price engine ready');

        const coinList = priceEngine.getCoinList();
        const symbols = coinList.map(c => c.symbol + 'USDT');
        console.log(`[Boot] ${symbols.length} symbols`);

        const klineEngine = require("./engine/klineEngine");
        console.log('[Boot] Starting kline engine...');
        await klineEngine.start(symbols);
        console.log('[Boot] Kline engine ready');

        const analysisEngine = require("./engine/analysisEngine");
        console.log('[Boot] Starting analysis engine...');
        await analysisEngine.start();
        console.log('[Boot] Analysis engine ready');

        console.log('[Boot] All engines started');
      } catch (err) {
        console.error('[Boot] Engine error:', err.message);
      }
    })().catch(err => {
      console.error('[Boot] Critical:', err.message);
    });
  }, 3000);
}

function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message || err);
});
process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) server.close();
});
