const { Router } = require("express");
const axios = require("axios");
const catchAsync = require("../../utils/catchAsync");
const { httpResponse } = require("../../utils/httpResponse");
const { getPerformance, getRecentSuggestions, getTopHits } = require("../../utils/suggestionTracker");
const priceEngine = require("../../engine/priceEngine");
const analysisEngine = require("../../engine/analysisEngine");

const router = Router();

const COINGECKO = "https://api.coingecko.com/api/v3";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

priceEngine.initReverseMap(REVERSE_MAP);

const TIMEFRAME_CONFIG = {
  '15m': { label: '15 Min' },
  '30m': { label: '30 Min' },
  '1h':  { label: '1 Hour' },
  '3h':  { label: '3 Hour' },
  '4h':  { label: '4 Hour' },
  '12h': { label: '12 Hour' },
  '1d':  { label: '1 Day' },
};

router.get(
  "/prices",
  catchAsync(async (req, res) => {
    const coins = priceEngine.getPrices();
    return res.status(200).json(httpResponse("success", coins, "Cached"));
  })
);

router.get(
  "/search",
  catchAsync(async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.status(200).json(httpResponse("success", [], "Empty query"));

    const lcq = q.toLowerCase();
    const coinList = priceEngine.getCoinList();
    const matched = coinList
      .filter(c => c.id.includes(lcq) || c.name.toLowerCase().includes(lcq) || c.symbol.toLowerCase().includes(lcq))
      .slice(0, 20)
      .map(c => ({ id: c.id, name: c.name, symbol: c.symbol, thumb: c.image }));

    if (matched.length >= 5) return res.status(200).json(httpResponse("success", matched, "Search results"));

    try {
      const cgRes = await axios.get(`${COINGECKO}/search`, { params: { query: q }, timeout: 5000 });
      const cgCoins = (cgRes.data?.coins || []).slice(0, 20).map(c => ({
        id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), thumb: c.thumb,
      }));
      const seen = new Set(matched.map(m => m.id));
      return res.status(200).json(httpResponse("success", [...matched, ...cgCoins.filter(c => !seen.has(c.id))], "Search results"));
    } catch {
      return res.status(200).json(httpResponse("success", matched, "Search results"));
    }
  })
);

router.get(
  "/coin/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const coinList = priceEngine.getCoinList();
    const coin = coinList.find(c => c.id === id);

    if (!coin) return res.status(404).json(httpResponse("error", null, "Coin not found"));

    const price = priceEngine.getPrice(coin.symbol + 'USDT');

    return res.status(200).json(httpResponse("success", {
      ...coin,
      current_price: price?.price || coin.current_price,
      high_24h: price?.high24h || coin.high_24h,
      low_24h: price?.low24h || coin.low_24h,
      price_change_percentage_1h_in_currency: price?.change24h || coin.price_change_percentage_1h_in_currency,
    }, "Cached"));
  })
);

router.get(
  "/global",
  catchAsync(async (req, res) => {
    const g = priceEngine.getGlobal();
    const globalData = {
      total_market_cap: { usd: g?.totalMarketCap || 0 },
      total_volume: { usd: g?.totalVolume || 0 },
      market_cap_percentage: { btc: g?.btcDominance || 0 },
      active_cryptocurrencies: g?.activeCurrencies || 0,
    };
    return res.status(200).json(httpResponse("success", globalData, "Cached"));
  })
);

router.get(
  "/analysis",
  catchAsync(async (req, res) => {
    const timeframe = req.query.timeframe || '4h';
    const tfConfig = TIMEFRAME_CONFIG[timeframe];
    if (!tfConfig) {
      return res.status(400).json(httpResponse("error", null, `Invalid timeframe. Use: ${Object.keys(TIMEFRAME_CONFIG).join(', ')}`));
    }

    const analysis = analysisEngine.getAnalysis(timeframe);
    if (!analysis) {
      return res.status(200).json(httpResponse("success", null, "Analysis not ready yet"));
    }

    return res.status(200).json(httpResponse("success", analysis, "Cached"));
  })
);

router.get(
  "/analysis/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const timeframe = req.query.timeframe || '4h';
    const tfConfig = TIMEFRAME_CONFIG[timeframe];
    if (!tfConfig) {
      return res.status(400).json(httpResponse("error", null, `Invalid timeframe`));
    }

    const symbol = SYMBOL_MAP[id] || id.toUpperCase() + 'USDT';
    const coinList = priceEngine.getCoinList();
    const coin = coinList.find(c => c.id === id);
    const price = priceEngine.getPrice(symbol);
    const analysis = analysisEngine.generateCoinAnalysisForTimeframe(symbol, timeframe);

    if (!coin && !price) {
      return res.status(404).json(httpResponse("error", null, "Coin not found"));
    }

    return res.status(200).json(httpResponse("success", {
      id, name: coin?.name || id, symbol: symbol.replace('USDT', ''),
      image: coin?.image || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.replace('USDT', '').toLowerCase()}.png`,
      price: price?.price || coin?.current_price || 0,
      marketCap: coin?.market_cap || 0,
      volume: price?.volume || coin?.total_volume || 0,
      high24h: price?.high24h || coin?.high_24h || 0,
      low24h: price?.low24h || coin?.low_24h || 0,
      change24h: price?.change24h || coin?.price_change_percentage_24h || 0,
      analysis: analysis ? { [timeframe]: analysis } : {},
    }, "Cached"));
  })
);

router.get(
  "/suggestions/performance",
  catchAsync(async (req, res) => {
    const perf = await getPerformance();
    const recent = await getRecentSuggestions(20);
    const topHits = await getTopHits();
    return res.status(200).json(httpResponse("success", { performance: perf, recent, topHits }, "Performance data"));
  })
);

router.get(
  "/trending",
  catchAsync(async (req, res) => {
    const coinList = priceEngine.getCoinList();
    const coins = coinList
      .filter(c => REVERSE_MAP[c.symbol])
      .sort((a, b) => parseFloat(b.total_volume) - parseFloat(a.total_volume))
      .slice(0, 7)
      .map(c => ({
        id: c.id, name: c.name, symbol: c.symbol, thumb: c.image,
        market_cap_rank: c.market_cap_rank || 0, score: 0,
      }));
    return res.status(200).json(httpResponse("success", coins, "Cached"));
  })
);

router.get(
  "/coin-detail/:symbol",
  catchAsync(async (req, res) => {
    const { symbol } = req.params;
    const sym = symbol.replace('USDT', '').toUpperCase();
    const binanceSymbol = sym + 'USDT';
    const coinList = priceEngine.getCoinList();
    const coin = coinList.find(c => c.symbol === sym);
    const price = priceEngine.getPrice(binanceSymbol);

    if (!price && !coin) return res.status(404).json(httpResponse("error", null, "Coin not found"));

    return res.status(200).json(httpResponse("success", {
      symbol: sym,
      name: coin?.name || sym,
      image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`,
      price: price?.price || coin?.current_price || 0,
      change24h: price?.change24h || 0,
      high24h: price?.high24h || 0,
      low24h: price?.low24h || 0,
      volume24h: price?.volume || 0,
      marketCap: coin?.market_cap || 0,
    }, "Cached"));
  })
);

module.exports = router;
