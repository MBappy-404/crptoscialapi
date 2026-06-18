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
    startEnginesInBackground();
  });

  socketConfig.connect(server);
});

function startEnginesInBackground() {
  (async () => {
    try {
      console.log('[Boot] Starting crypto engines...');

      await priceEngine.start();
      console.log('[Boot] Price engine ready');

      const coinList = priceEngine.getCoinList();
      const symbols = coinList.map(c => c.symbol + 'USDT');
      console.log(`[Boot] ${symbols.length} symbols for kline loading`);

      await klineEngine.start(symbols);
      console.log('[Boot] Kline engine ready');

      await analysisEngine.start();
      console.log('[Boot] Analysis engine ready');

      console.log('[Boot] All engines started successfully');
    } catch (err) {
      console.error('[Boot] Engine startup error:', err.message);
    }
  })().catch(err => {
    console.error('[Boot] Critical engine error:', err.message);
  });
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

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});
process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) server.close();
});
