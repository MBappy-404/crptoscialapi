const serverless = require("serverless-http");
const app = require("../src/app");
const { connectDB } = require("./db");
const priceEngine = require("../src/engine/priceEngine");
const klineEngine = require("../src/engine/klineEngine");
const analysisEngine = require("../src/engine/analysisEngine");

let isConnected = false;
let enginesStarted = false;
let serverlessHandler = null;

const SYMBOL_MAP = {
  bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', tether: 'USDTUSDT', binancecoin: 'BNBUSDT',
  ripple: 'XRPUSDT', 'usd-coin': 'USDCUSDT', solana: 'SOLUSDT', dogecoin: 'DOGEUSDT',
  cardano: 'ADAUSDT', 'shiba-inu': 'SHIBUSDT', polkadot: 'DOTUSDT', 'avalanche-2': 'AVAXUSDT',
  tron: 'TRXUSDT', litecoin: 'LTCUSDT', chainlink: 'LINKUSDT', stellar: 'XLMUSDT',
  'bitcoin-cash': 'BCHUSDT', uniswap: 'UNIUSDT', monero: 'XMRUSDT', cosmos: 'ATOMUSDT',
  'hedera-hashgraph': 'HBARUSDT', 'internet-computer': 'ICPUSDT', sandbox: 'SANDUSDT',
  'stepn': 'GMTUSDT', aptos: 'APTUSDT', 'sui': 'SUIUSDT', arbitrum: 'ARBUSDT',
  optimism: 'OPUSDT', pepe: '1000PEPEUSDT', 'the-graph': 'GRTUSDT', 'fantom': 'FTMUSDT',
  'algorand': 'ALGOUSDT', filecoin: 'FILUSDT', 'aave': 'AAVEUSDT', render: 'RNDRUSDT',
  'crypto-com-chain': 'CROUSDT', 'sei-network': 'SEIUSDT', worldcoin: 'WLDUSDT',
  'vechain': 'VETUSDT', 'decentraland': 'MANAUSDT', 'axie-infinity': 'AXSUSDT',
};

const REVERSE_MAP = {};
for (const [k, v] of Object.entries(SYMBOL_MAP)) {
  REVERSE_MAP[v.replace('USDT', '')] = k;
}

async function ensureDB() {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
}

async function ensureEngines() {
  if (enginesStarted) return;
  enginesStarted = true;

  try {
    console.log('[Vercel] Starting crypto engines...');
    priceEngine.initReverseMap(REVERSE_MAP);

    await priceEngine.start();

    const coinList = priceEngine.getCoinList();
    const symbols = coinList.map(c => c.symbol + 'USDT');

    await klineEngine.start(symbols);

    await analysisEngine.start();

    console.log('[Vercel] All engines started');
  } catch (err) {
    console.error('[Vercel] Engine startup error:', err.message);
  }
}

module.exports = async function handler(req, res) {
  try {
    await ensureDB();
    await ensureEngines();

    if (!serverlessHandler) {
      serverlessHandler = serverless(app);
    }
    return serverlessHandler(req, res);
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ status: "error", message: "Server cold start failed" });
  }
};
