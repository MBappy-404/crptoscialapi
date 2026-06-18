const { Router } = require("express");
const axios = require("axios");
const catchAsync = require("../../utils/catchAsync");
const { httpResponse } = require("../../utils/httpResponse");
const { calculateSignal } = require("../../utils/technicalAnalysis");
const { addSuggestion, checkHits, getPerformance, getRecentSuggestions, getTopHits } = require("../../utils/suggestionTracker");

const router = Router();

const BINANCE = "https://api.binance.com/api/v3";
const COINCAP = "https://api.coincap.io/v2";
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

const TIMEFRAME_CONFIG = {
  '15m': { interval: '15m', limit: 250, label: '15 Min' },
  '30m': { interval: '30m', limit: 250, label: '30 Min' },
  '1h':  { interval: '1h',  limit: 250, label: '1 Hour' },
  '3h':  { interval: '3h',  limit: 250, label: '3 Hour' },
  '4h':  { interval: '4h',  limit: 250, label: '4 Hour' },
  '12h': { interval: '12h', limit: 250, label: '12 Hour' },
  '1d':  { interval: '1d',  limit: 250, label: '1 Day' },
};

function formatP(n) {
  if (n == null) return '-';
  if (n >= 1) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toFixed(8);
}

async function fetchCoinCap() {
  try {
    const { data } = await axios.get(`${COINCAP}/assets?limit=1000`, { timeout: 5000 });
    const map = {};
    for (const a of (data.data || [])) {
      map[a.symbol] = {
        marketCapUsd: parseFloat(a.marketCapUsd),
        volumeUsd24Hr: parseFloat(a.volumeUsd24Hr),
        changePercent24Hr: parseFloat(a.changePercent24Hr),
        name: a.name,
        rank: a.rank,
        id: a.id,
      };
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchCoinGeckoMarkets() {
  try {
    const results = [];
    for (let page = 1; page <= 4; page++) {
      try {
        const { data } = await axios.get(`${COINGECKO}/coins/markets`, {
          params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page, sparkline: false },
          timeout: 15000,
        });
        results.push(...(data || []));
        if (page < 4) await sleep(1500);
      } catch {
        break;
      }
    }
    const map = {};
    for (const c of results) {
      map[c.symbol.toUpperCase()] = {
        marketCapUsd: c.market_cap || 0,
        volumeUsd24Hr: c.total_volume || 0,
        changePercent24Hr: c.price_change_percentage_24h || 0,
        name: c.name,
        cgId: c.id,
      };
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchGlobalData() {
  try {
    const { data } = await axios.get(`${COINCAP}/global`, { timeout: 5000 });
    const g = data?.data;
    return {
      totalMarketCap: parseFloat(g?.marketCapUsd) || 0,
      totalVolume: parseFloat(g?.volume24hUsd) || 0,
      btcDominance: parseFloat(g?.marketCapDominance) || 0,
      activeCurrencies: parseInt(g?.activeCurrencies) || 0,
    };
  } catch {
    try {
      const { data } = await axios.get(`${COINGECKO}/global`, { timeout: 8000 });
      const g = data?.data;
      return {
        totalMarketCap: g?.total_market_cap?.usd || 0,
        totalVolume: g?.total_volume?.usd || 0,
        btcDominance: g?.market_cap_percentage?.btc || 0,
        activeCurrencies: g?.active_cryptocurrencies || 0,
      };
    } catch {
      return { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, activeCurrencies: 0 };
    }
  }
}

async function fetchCoinGeckoCoin(id) {
  try {
    const { data } = await axios.get(`${COINGECKO}/coins/${id}`, {
      params: { localization: false, tickers: false, market_data: true, community_data: false, developer_data: false, sparkline: false },
      timeout: 10000,
    });
    return {
      name: data.name,
      description: data.description?.en || '',
      ath: data.market_data?.ath?.usd,
      athChangePercentage: data.market_data?.ath_change_percentage?.usd,
    };
  } catch {
    return null;
  }
}

async function fetchBinanceKlines(symbol, interval, limit) {
  const { data } = await axios.get(`${BINANCE}/klines`, {
    params: { symbol, interval, limit },
    timeout: 10000,
  });
  return data.map(k => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    time: k[0],
  }));
}

async function fetch7dChanges(symbols) {
  const BATCH = 5;
  const results = {};
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const { data } = await axios.get(`${BINANCE}/klines`, {
            params: { symbol: sym, interval: '1d', limit: 8 },
            timeout: 8000,
          });
          if (data.length >= 2) {
            const oldClose = parseFloat(data[0][4]);
            const newClose = parseFloat(data[data.length - 1][4]);
            if (oldClose > 0) results[sym] = ((newClose - oldClose) / oldClose) * 100;
          }
        } catch {}
      })
    );
    if (i + BATCH < symbols.length) await sleep(300);
  }
  return results;
}

let pricesCache = { data: null, timestamp: 0 };
let globalCache = { data: null, timestamp: 0 };
let trendingCache = { data: null, timestamp: 0 };
let analysisCache = { data: null, timestamp: 0 };
const CACHE_TTL = 60000;
const ANALYSIS_TTL = 180000;

function getCapCategory(marketCap) {
  if (marketCap >= 10e9) return 'large';
  if (marketCap >= 2e9) return 'mid';
  if (marketCap >= 300e6) return 'small';
  return 'micro';
}

function getCapLabel(cat) {
  return { large: 'Large Cap', mid: 'Mid Cap', small: 'Small Cap', micro: 'Micro Cap' }[cat] || cat;
}

async function fetchPricesFromBinance() {
  const [tickerRes, capData] = await Promise.all([
    axios.get(`${BINANCE}/ticker/24hr`, { timeout: 10000 }),
    fetchCoinCap(),
  ]);
  const capAvailable = Object.keys(capData).length > 0;
  const assets = capAvailable ? capData : await fetchCoinGeckoMarkets();
  const capDataAvailable = Object.keys(assets).length > 0;

  const rawCoins = (tickerRes.data || [])
    .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && !t.symbol.includes('BULL') && !t.symbol.includes('BEAR'))
    .map(t => {
      const sym = t.symbol.replace('USDT', '');
      const cap = assets[sym] || {};
      return {
        id: REVERSE_MAP[sym] || cap.cgId || t.symbol.toLowerCase(),
        name: cap.name || sym,
        symbol: sym,
        image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`,
        current_price: parseFloat(t.lastPrice),
        price_change_percentage_1h_in_currency: parseFloat(t.priceChangePercent),
        price_change_percentage_24h: cap.changePercent24Hr || parseFloat(t.priceChangePercent),
        price_change_percentage_7d_in_currency: null,
        market_cap: cap.marketCapUsd || 0,
        total_volume: cap.volumeUsd24Hr || parseFloat(t.quoteVolume),
        high_24h: parseFloat(t.highPrice),
        low_24h: parseFloat(t.lowPrice),
        market_cap_rank: cap.rank || 0,
      };
    })
    .filter(c => capDataAvailable ? c.market_cap > 0 : true)
    .sort((a, b) => capDataAvailable ? b.market_cap - a.market_cap : parseFloat(b.total_volume) - parseFloat(a.total_volume))
    .slice(0, 200)
    .map((c, i) => ({ ...c, market_cap_rank: c.market_cap > 0 ? c.market_cap_rank : i + 1 }));

  const topSymbols = rawCoins.filter(c => REVERSE_MAP[c.symbol]).map(c => SYMBOL_MAP[REVERSE_MAP[c.symbol]]);
  const changes7d = await fetch7dChanges([...new Set(topSymbols)].filter(Boolean));

  return rawCoins.map(c => {
    const binanceSym = SYMBOL_MAP[REVERSE_MAP[c.symbol]];
    return { ...c, price_change_percentage_7d_in_currency: binanceSym ? changes7d[binanceSym] ?? null : null };
  });
}

async function fetchPricesFromCoinGecko() {
  const all = [];
  for (let page = 1; page <= 4; page++) {
    try {
      const { data } = await axios.get(`${COINGECKO}/coins/markets`, {
        params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page, sparkline: false, price_change_percentage: '1h,24h,7d' },
        timeout: 15000,
      });
      all.push(...(data || []));
      if (page < 4) await sleep(1500);
    } catch {
      break;
    }
  }
  return all.map((c, i) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    image: c.image || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${c.symbol.toLowerCase()}.png`,
    current_price: c.current_price,
    price_change_percentage_1h_in_currency: c.price_change_percentage_1h_in_currency || 0,
    price_change_percentage_24h: c.price_change_percentage_24h || 0,
    price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency || null,
    market_cap: c.market_cap || 0,
    total_volume: c.total_volume || 0,
    high_24h: c.high_24h || c.current_price,
    low_24h: c.low_24h || c.current_price,
    market_cap_rank: c.market_cap_rank || i + 1,
  }));
}

router.get(
  "/prices",
  catchAsync(async (req, res) => {
    const now = Date.now();
    if (pricesCache.data && now - pricesCache.timestamp < CACHE_TTL) {
      return res.status(200).json(httpResponse("success", pricesCache.data, "Cached"));
    }
    let coins = [];
    try {
      coins = await fetchPricesFromBinance();
    } catch (err) {
      try {
        coins = await fetchPricesFromCoinGecko();
      } catch (err2) {}
    }
    if (coins.length > 0) {
      pricesCache = { data: coins, timestamp: now };
      return res.status(200).json(httpResponse("success", coins, "Live"));
    }
    if (pricesCache.data) return res.status(200).json(httpResponse("success", pricesCache.data, "Stale"));
    return res.status(200).json(httpResponse("success", [], "Failed to load prices"));
  })
);

router.get(
  "/search",
  catchAsync(async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.status(200).json(httpResponse("success", [], "Empty query"));
    const lcq = q.toLowerCase();
    const matched = Object.entries(SYMBOL_MAP)
      .filter(([id, sym]) => id.includes(lcq) || sym.toLowerCase().includes(lcq))
      .slice(0, 20)
      .map(([id, sym]) => ({
        id,
        name: sym.replace('USDT', ''),
        symbol: sym.replace('USDT', ''),
        thumb: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.replace('USDT', '').toLowerCase()}.png`,
      }));
    if (matched.length >= 5) return res.status(200).json(httpResponse("success", matched, "Search results"));
    try {
      const cgRes = await axios.get(`${COINGECKO}/search`, { params: { query: q }, timeout: 5000 });
      const cgCoins = (cgRes.data?.coins || []).slice(0, 20).map(c => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        thumb: c.thumb,
      }));
      const seen = new Set(matched.map(m => m.id));
      const merged = [...matched, ...cgCoins.filter(c => !seen.has(c.id))];
      return res.status(200).json(httpResponse("success", merged, "Search results"));
    } catch {
      return res.status(200).json(httpResponse("success", matched, "Search results"));
    }
  })
);

router.get(
  "/coin/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    try {
      const symbol = SYMBOL_MAP[id]?.replace('USDT', '') || id.toUpperCase();
      const binanceSymbol = SYMBOL_MAP[id] || symbol + 'USDT';
      const [tickerRes, capData, extra] = await Promise.all([
        axios.get(`${BINANCE}/ticker/24hr`, { params: { symbol: binanceSymbol }, timeout: 10000 }),
        fetchCoinCap(),
        fetchCoinGeckoCoin(id),
      ]);
      const t = tickerRes.data;
      const cap = capData[symbol] || {};
      const coin = {
        id, name: extra?.name || cap.name || symbol, symbol,
        image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`,
        market_cap_rank: cap.rank || 0, current_price: parseFloat(t.lastPrice),
        market_cap: cap.marketCapUsd || 0, total_volume: cap.volumeUsd24Hr || parseFloat(t.quoteVolume),
        high_24h: parseFloat(t.highPrice), low_24h: parseFloat(t.lowPrice),
        price_change_24h: parseFloat(t.priceChange),
        price_change_percentage_1h_in_currency: parseFloat(t.priceChangePercent),
        price_change_percentage_24h: cap.changePercent24Hr || parseFloat(t.priceChangePercent),
        ath: extra?.ath || 0, ath_change_percentage: extra?.athChangePercentage || 0,
        description: extra?.description || '',
      };
      return res.status(200).json(httpResponse("success", coin, "Coin data"));
    } catch {
      return res.status(404).json(httpResponse("error", null, "Coin not found"));
    }
  })
);

router.get(
  "/global",
  catchAsync(async (req, res) => {
    const now = Date.now();
    if (globalCache.data && now - globalCache.timestamp < CACHE_TTL) {
      return res.status(200).json(httpResponse("success", globalCache.data, "Cached"));
    }
    const g = await fetchGlobalData();
    const globalData = {
      total_market_cap: { usd: g.totalMarketCap },
      total_volume: { usd: g.totalVolume },
      market_cap_percentage: { btc: g.btcDominance },
      active_cryptocurrencies: g.activeCurrencies,
    };
    globalCache = { data: globalData, timestamp: now };
    return res.status(200).json(httpResponse("success", globalData, "Live"));
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

    const cacheKey = `analysis_${timeframe}`;
    const now = Date.now();
    if (analysisCache[cacheKey] && now - analysisCache[cacheKey].timestamp < ANALYSIS_TTL) {
      return res.status(200).json(httpResponse("success", analysisCache[cacheKey].data, "Cached"));
    }

    try {
      let topCoins = [];
      let tickerFailed = false;
      try {
        const [tickerRes, capData] = await Promise.all([
          axios.get(`${BINANCE}/ticker/24hr`, { timeout: 10000 }),
          fetchCoinCap(),
        ]);
        const hasCapData = Object.keys(capData).length > 0;
        const assets = hasCapData ? capData : await fetchCoinGeckoMarkets();
        const capAvailable = Object.keys(assets).length > 0;

        topCoins = (tickerRes.data || [])
          .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && !t.symbol.includes('BULL') && !t.symbol.includes('BEAR'))
          .map(t => {
            const sym = t.symbol.replace('USDT', '');
            const cap = assets[sym] || {};
            return {
              id: REVERSE_MAP[sym] || cap.cgId || t.symbol.toLowerCase(),
              name: cap.name || sym,
              symbol: sym,
              image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`,
              current_price: parseFloat(t.lastPrice),
              price_change_percentage_24h: cap.changePercent24Hr || parseFloat(t.priceChangePercent),
              market_cap: cap.marketCapUsd || 0,
              total_volume: cap.volumeUsd24Hr || parseFloat(t.quoteVolume),
              high_24h: parseFloat(t.highPrice),
              low_24h: parseFloat(t.lowPrice),
              market_cap_rank: cap.rank || 0,
            };
          })
          .sort((a, b) => b.market_cap > 0 && a.market_cap > 0 ? b.market_cap - a.market_cap : parseFloat(b.total_volume) - parseFloat(a.total_volume))
          .slice(0, 100)
          .map((c, i) => ({ ...c, market_cap_rank: c.market_cap > 0 ? c.market_cap_rank : i + 1 }));
      } catch {
        tickerFailed = true;
      }

      if (tickerFailed || topCoins.length === 0) {
        try {
          const cgAll = [];
          for (let cgPage = 1; cgPage <= 4; cgPage++) {
            try {
              const { data } = await axios.get(`${COINGECKO}/coins/markets`, {
                params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 250, page: cgPage, sparkline: false, price_change_percentage: '24h' },
                timeout: 10000,
              });
              cgAll.push(...(data || []));
              if (cgPage < 4) await sleep(1500);
            } catch { break; }
          }
          topCoins = cgAll.slice(0, 100).map((c, i) => ({
            id: c.id,
            name: c.name,
            symbol: c.symbol.toUpperCase(),
            image: c.image || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${c.symbol.toLowerCase()}.png`,
            current_price: c.current_price,
            price_change_percentage_24h: c.price_change_percentage_24h || 0,
            market_cap: c.market_cap || 0,
            total_volume: c.total_volume || 0,
            high_24h: c.high_24h || c.current_price,
            low_24h: c.low_24h || c.current_price,
            market_cap_rank: c.market_cap_rank || i + 1,
          }));
        } catch {}
      }

      if (topCoins.length === 0) throw new Error("No coins available for analysis");

      let globalData;
      try {
        globalData = await fetchGlobalData();
      } catch {
        globalData = { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, activeCurrencies: 0 };
      }

      const btc = topCoins.find(c => c.id === 'bitcoin');
      const eth = topCoins.find(c => c.id === 'ethereum');

      let gainers24h = 0, losers24h = 0;
      topCoins.forEach(c => {
        if ((c.price_change_percentage_24h || 0) >= 0) gainers24h++;
        else losers24h++;
      });
      const avg24h = topCoins.reduce((s, c) => s + (c.price_change_percentage_24h || 0), 0) / topCoins.length;

      let sentiment = "Neutral";
      let sentimentScore = 50;
      const btcChange = btc?.price_change_percentage_24h || 0;
      const ethChange = eth?.price_change_percentage_24h || 0;
      const majorChange = (btcChange + ethChange) / 2;
      const gainersRatio = gainers24h / (gainers24h + losers24h || 1);

      sentimentScore = Math.round(
        (50 + avg24h * 8) * 0.3 +
        (50 + majorChange * 10) * 0.3 +
        gainersRatio * 100 * 0.2 +
        (50 + btcChange * 8) * 0.2
      );
      sentimentScore = Math.max(0, Math.min(100, sentimentScore));
      if (sentimentScore >= 75) sentiment = "Extreme Greed";
      else if (sentimentScore >= 60) sentiment = "Greed";
      else if (sentimentScore <= 25) sentiment = "Extreme Fear";
      else if (sentimentScore <= 40) sentiment = "Fear";

      const BATCH = 20;
      const coinAnalyses = {};

      for (let i = 0; i < topCoins.length; i += BATCH) {
        const batch = topCoins.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (coin) => {
            const symbol = SYMBOL_MAP[coin.id] || coin.symbol + 'USDT';
            try {
              const klines = await fetchBinanceKlines(symbol, tfConfig.interval, tfConfig.limit).catch(() => []);
              if (klines.length < 50) return { id: coin.id, data: null };
              const closes = klines.map(k => k.close);
              const volumes = klines.map(k => k.volume);
              const highs = klines.map(k => k.high);
              const lows = klines.map(k => k.low);
              const sig = calculateSignal(closes, volumes, highs, lows, timeframe);
              sig.symbol = symbol;
              return { id: coin.id, data: sig };
            } catch {
              return { id: coin.id, data: null };
            }
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.data) {
            coinAnalyses[r.value.id] = r.value.data;
            try {
              await checkHits(r.value.id, topCoins.find(c => c.id === r.value.id)?.current_price);
            } catch {}
          }
        }
        if (i + BATCH < topCoins.length) await sleep(300);
      }

      const coinSignals = topCoins.map(c => {
        const analysis = coinAnalyses[c.id];
        const capCategory = getCapCategory(c.market_cap);
        return {
          id: c.id, name: c.name, symbol: c.symbol, image: c.image,
          price: c.current_price, currentPrice: analysis?.currentPrice || c.current_price,
          change24h: c.price_change_percentage_24h,
          marketCap: c.market_cap, capCategory, capLabel: getCapLabel(capCategory),
          volume: c.total_volume, high24h: c.high_24h, low24h: c.low_24h,
          signal: analysis?.signal || 'NO SIGNAL',
          confidence: analysis?.confidence || 0,
          rsi: analysis?.rsi || null,
          ma45: analysis?.ma45 || null,
          ma50: analysis?.ma50 || null,
          ma100: analysis?.ma100 || null,
          ma200: analysis?.ma200 || null,
          goldenCross: analysis?.goldenCross || false,
          deathCross: analysis?.deathCross || false,
          volumeConfirmed: analysis?.volumeConfirmed || false,
          volumeStrength: analysis?.volumeStrength || 0,
          marketStructure: analysis?.marketStructure || 'Unknown',
          maRejection: analysis?.maRejection || false,
          entryDistance: analysis?.entryDistance || 0,
          scores: analysis?.scores || { buy: 0, sell: 0 },
          trading: analysis?.trading || null,
          timeframe,
        };
      });

      const withSignals = coinSignals.filter(c => c.signal !== 'NO SIGNAL' && c.confidence >= 50);

      for (const c of withSignals) {
        try { await addSuggestion(c); } catch {}
      }

      const sorted = [...withSignals].sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return b.volumeStrength - a.volumeStrength;
      });

      const topStrongBuy = sorted.filter(c => c.signal === 'STRONG BUY');
      const topBuy = sorted.filter(c => c.signal === 'BUY');
      const topWeakBuy = sorted.filter(c => c.signal === 'WEAK BUY');
      const topStrongShort = sorted.filter(c => c.signal === 'STRONG SHORT');
      const topShort = sorted.filter(c => c.signal === 'SHORT');
      const topWeakSell = sorted.filter(c => c.signal === 'WEAK SELL');

      const trendScore = avg24h * 0.5 + btcChange * 0.5;
      const trend = trendScore > 0.5 ? 'Bullish' : trendScore < -0.5 ? 'Bearish' : 'Sideways';

      let perf = { hits: 0, missed: 0, active: 0, hitRate: 0 };
      let recentSugs = [];
      let topHits = [];
      try { perf = await getPerformance(); } catch {}
      try { recentSugs = await getRecentSuggestions(20); } catch {}
      try { topHits = await getTopHits(); } catch {}

      const analysis = {
        timeframe: tfConfig.label,
        timeframeKey: timeframe,
        overview: {
          totalMarketCap: globalData.totalMarketCap,
          totalVolume: globalData.totalVolume,
          btcDominance: globalData.btcDominance,
          btcPrice: btc?.current_price,
          ethPrice: eth?.current_price,
          btc24h: btc?.price_change_percentage_24h,
          eth24h: eth?.price_change_percentage_24h,
          totalCoins: topCoins.length,
          analyzedCoins: Object.keys(coinAnalyses).length,
          signalsFound: withSignals.length,
        },
        sentiment: {
          label: sentiment, score: sentimentScore,
          avg24h: Math.round(avg24h * 100) / 100,
          gainers24h, losers24h,
        },
        market: { trend, volatility: Math.max(...topCoins.map(c => Math.abs(c.price_change_percentage_24h || 0))) },
        signals: {
          strongBuy: topStrongBuy.slice(0, 10),
          buy: topBuy.slice(0, 10),
          weakBuy: topWeakBuy.slice(0, 10),
          strongShort: topStrongShort.slice(0, 10),
          short: topShort.slice(0, 10),
          weakSell: topWeakSell.slice(0, 10),
        },
        allSignals: sorted,
        performance: perf,
        recentSuggestions: recentSugs,
        topHits,
        timestamps: new Date().toISOString(),
      };

      if (!analysisCache[cacheKey]) analysisCache[cacheKey] = { data: null, timestamp: 0 };
      analysisCache[cacheKey] = { data: analysis, timestamp: now };
      return res.status(200).json(httpResponse("success", analysis, "Live analysis"));
    } catch (err) {
      if (analysisCache[cacheKey]?.data) {
        return res.status(200).json(httpResponse("success", analysisCache[cacheKey].data, "Stale"));
      }
      return res.status(200).json(httpResponse("success", null, "Failed to load analysis"));
    }
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
    try {
      const symbol = SYMBOL_MAP[id] || id.toUpperCase() + 'USDT';
      const [tickerRes, capData, extra] = await Promise.all([
        axios.get(`${BINANCE}/ticker/24hr`, { params: { symbol }, timeout: 10000 }),
        fetchCoinCap(),
        fetchCoinGeckoCoin(id),
      ]);
      const t = tickerRes.data;
      const sym = symbol.replace('USDT', '');
      const cap = capData[sym] || {};

      let analysis = {};
      try {
        const klines = await fetchBinanceKlines(symbol, tfConfig.interval, tfConfig.limit).catch(() => []);
        if (klines.length >= 50) {
          const closes = klines.map(k => k.close);
          const volumes = klines.map(k => k.volume);
          const highs = klines.map(k => k.high);
          const lows = klines.map(k => k.low);
          analysis[timeframe] = calculateSignal(closes, volumes, highs, lows, timeframe);
          analysis[timeframe].symbol = symbol;
        }
      } catch {}

      const result = {
        id, name: extra?.name || cap.name || sym, symbol: sym,
        image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`,
        price: parseFloat(t.lastPrice),
        marketCap: cap.marketCapUsd || 0,
        volume: cap.volumeUsd24Hr || parseFloat(t.quoteVolume),
        high24h: parseFloat(t.highPrice), low24h: parseFloat(t.lowPrice),
        change24h: cap.changePercent24Hr || parseFloat(t.priceChangePercent),
        analysis,
      };
      return res.status(200).json(httpResponse("success", result, "Live analysis"));
    } catch {
      return res.status(404).json(httpResponse("error", null, "Coin not found"));
    }
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
    const now = Date.now();
    if (trendingCache.data && now - trendingCache.timestamp < CACHE_TTL) {
      return res.status(200).json(httpResponse("success", trendingCache.data, "Cached"));
    }
    let coins = [];
    try {
      const tickerRes = await axios.get(`${BINANCE}/ticker/24hr`, { timeout: 10000 });
      coins = (tickerRes.data || [])
        .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && REVERSE_MAP[t.symbol.replace('USDT', '')])
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 7)
        .map(t => {
          const sym = t.symbol.replace('USDT', '');
          return {
            id: REVERSE_MAP[t.symbol.replace('USDT', '')] || t.symbol.toLowerCase(),
            name: sym, symbol: sym,
            thumb: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`,
            market_cap_rank: 0, score: 0,
          };
        });
    } catch (err) {
      try {
        const cgRes = await axios.get(`${COINGECKO}/coins/markets`, {
          params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 7, sparkline: false },
          timeout: 10000,
        });
        coins = (cgRes.data || []).map(c => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol.toUpperCase(),
          thumb: c.image || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${c.symbol.toLowerCase()}.png`,
          market_cap_rank: c.market_cap_rank || 0,
          score: 0,
        }));
      } catch (err2) {}
    }
    if (coins.length > 0) {
      trendingCache = { data: coins, timestamp: now };
      return res.status(200).json(httpResponse("success", coins, "Live"));
    }
    if (trendingCache.data) return res.status(200).json(httpResponse("success", trendingCache.data, "Stale"));
    return res.status(200).json(httpResponse("success", [], "Failed to load trending"));
  })
);

router.get(
  "/coin-detail/:symbol",
  catchAsync(async (req, res) => {
    const { symbol } = req.params;
    const sym = symbol.replace('USDT', '').toUpperCase();
    const binanceSymbol = sym + 'USDT';
    const cgId = REVERSE_MAP[sym];

    try {
      const [tickerRes, cgData] = await Promise.all([
        axios.get(`${BINANCE}/ticker/24hr`, { params: { symbol: binanceSymbol }, timeout: 10000 }),
        cgId ? axios.get(`${COINGECKO}/coins/${cgId}`, {
          params: { localization: false, tickers: false, market_data: true, community_data: false, developer_data: false, sparkline: false },
          timeout: 10000,
        }).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);

      const t = tickerRes.data;
      const cg = cgData?.data;
      const md = cg?.market_data;

      return res.status(200).json(httpResponse("success", {
        symbol: sym,
        name: cg?.name || sym,
        description: (cg?.description?.en || '').replace(/<[^>]*>/g, '').slice(0, 500),
        image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym.toLowerCase()}.png`,
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.priceChangePercent),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        volume24h: parseFloat(t.quoteVolume),
        marketCap: md?.market_cap?.usd || 0,
        ath: md?.ath?.usd || 0,
        athChangePercentage: md?.ath_change_percentage?.usd || 0,
        athDate: md?.ath_date?.usd || null,
        atl: md?.atl?.usd || 0,
        atlChangePercentage: md?.atl_change_percentage?.usd || 0,
        circulatingSupply: md?.circulating_supply || 0,
        totalSupply: md?.total_supply || 0,
        maxSupply: md?.max_supply || 0,
        fullyDilutedValuation: md?.fully_diluted_valuation?.usd || 0,
        priceChange7d: md?.price_change_percentage_7d || 0,
        priceChange30d: md?.price_change_percentage_30d || 0,
        priceChange1y: md?.price_change_percentage_1y || 0,
        categories: cg?.categories?.filter(Boolean) || [],
        homepage: cg?.links?.homepage?.filter(Boolean)?.[0] || null,
        blockchain: cg?.links?.blockchain_site?.filter(Boolean)?.[0] || null,
      }, "Live"));
    } catch {
      return res.status(404).json(httpResponse("error", null, "Coin not found"));
    }
  })
);

module.exports = router;
