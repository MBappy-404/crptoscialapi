#!/usr/bin/env node
const app = require("./app");
const http = require("http");
const db = require("./config/db_conn");
const logger = require("./config/logger");
const socketConfig = require("./config/socket_io");
const priceEngine = require("./engine/priceEngine");
const klineEngine = require("./engine/klineEngine");
const analysisEngine = require("./engine/analysisEngine");

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
    startEngines();
  });

  socketConfig.connect(server);
});

async function startEngines() {
  try {
    console.log('[Boot] Starting crypto engines...');

    await priceEngine.start();

    const coinList = priceEngine.getCoinList();
    const symbols = coinList.map(c => c.symbol + 'USDT');
    console.log(`[Boot] ${symbols.length} symbols for kline loading`);

    await klineEngine.start(symbols);

    await analysisEngine.start();

    console.log('[Boot] All engines started successfully');
  } catch (err) {
    console.error('[Boot] Engine startup error:', err.message);
  }
}

function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);
process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) server.close();
});
