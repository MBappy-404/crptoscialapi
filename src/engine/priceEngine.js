const WebSocket = require('ws');
const axios = require('axios');

const BINANCE_WS = 'wss://stream.binance.com:9443/ws';
const BINANCE_API = 'https://api.binance.com/api/v3';
const COINCAP_API = 'https://api.coincap.io/v2';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PRICE_REFRESH_MS = 30000;
const GLOBAL_REFRESH_MS = 60000;
const MCAP_REFRESH_MS = 300000;

let priceCache = {};
let coinListCache = [];
let globalCache = null;
let marketCapCache = {};

let ws = null;
let isInitialized = false;
let reverseMap = {};

function initReverseMap(map) {
  Object.assign(reverseMap, map);
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`${BINANCE_WS}/!miniTicker@arr`);

    ws.on('open', () => {
      console.log('[PriceEngine] WebSocket connected');
    });

    ws.on('message', (data) => {
      try {
        const tickers = JSON.parse(data);
        for (const t of tickers) {
          if (t.s && t.s.endsWith('USDT') && !t.s.includes('UP') && !t.s.includes('DOWN')) {
            const open = parseFloat(t.o);
            const close = parseFloat(t.c);
            priceCache[t.s] = {
              price: close,
              high24h: parseFloat(t.h),
              low24h: parseFloat(t.l),
              volume: parseFloat(t.v),
              quoteVolume: parseFloat(t.q),
              change24h: open > 0 ? ((close - open) / open) * 100 : 0,
              updatedAt: Date.now(),
            };
          }
        }
      } catch {}
    });

    ws.on('error', (err) => {
      console.error('[PriceEngine] WebSocket error:', err.message);
    });

    ws.on('close', () => {
      console.log('[PriceEngine] WebSocket disconnected, reconnecting in 5s...');
      ws = null;
      setTimeout(connectWebSocket, 5000);
    });
  } catch (err) {
    console.error('[PriceEngine] WebSocket connection failed:', err.message);
    setTimeout(connectWebSocket, 5000);
  }
}

async function loadCoinCapData() {
  try {
    const { data } = await axios.get(`${COINCAP_API}/assets?limit=1000`, { timeout: 8000 });
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

async function loadCoinGeckoMarkets() {
  try {
    const results = [];
    for (let page = 1; page <= 4; page++) {
      try {
        const { data } = await axios.get(`${COINGECKO_API}/coins/markets`, {
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

async function loadGlobalData() {
  try {
    const { data } = await axios.get(`${COINCAP_API}/global`, { timeout: 5000 });
    const g = data?.data;
    globalCache = {
      totalMarketCap: parseFloat(g?.marketCapUsd) || 0,
      totalVolume: parseFloat(g?.volume24hUsd) || 0,
      btcDominance: parseFloat(g?.marketCapDominance) || 0,
      activeCurrencies: parseInt(g?.activeCurrencies) || 0,
    };
  } catch {
    try {
      const { data } = await axios.get(`${COINGECKO_API}/global`, { timeout: 8000 });
      const g = data?.data;
      globalCache = {
        totalMarketCap: g?.total_market_cap?.usd || 0,
        totalVolume: g?.total_volume?.usd || 0,
        btcDominance: g?.market_cap_percentage?.btc || 0,
        activeCurrencies: g?.active_cryptocurrencies || 0,
      };
    } catch {
      globalCache = { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, activeCurrencies: 0 };
    }
  }
}

async function loadInitialPrices() {
  console.time('[PriceEngine] Initial price load');
  try {
    const [tickerRes, capData] = await Promise.all([
      axios.get(`${BINANCE_API}/ticker/24hr`, { timeout: 15000 }),
      loadCoinCapData(),
    ]);

    const capAvailable = Object.keys(capData).length > 0;
    const assets = capAvailable ? capData : await loadCoinGeckoMarkets();
    const capDataAvailable = Object.keys(assets).length > 0;

    for (const t of (tickerRes.data || [])) {
      if (t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN')) {
        priceCache[t.symbol] = {
          price: parseFloat(t.lastPrice),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          volume: parseFloat(t.quoteVolume),
          change24h: parseFloat(t.priceChangePercent),
          updatedAt: Date.now(),
        };
      }
    }

    coinListCache = (tickerRes.data || [])
      .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && !t.symbol.includes('BULL') && !t.symbol.includes('BEAR'))
      .map(t => {
        const sym = t.symbol.replace('USDT', '');
        const cap = assets[sym] || {};
        return {
          id: reverseMap[sym] || cap.cgId || t.symbol.toLowerCase(),
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
      .slice(0, 1000)
      .map((c, i) => ({ ...c, market_cap_rank: c.market_cap > 0 ? c.market_cap_rank : i + 1 }));

    marketCapCache = assets;
    console.log(`[PriceEngine] Loaded ${coinListCache.length} coins, ${Object.keys(priceCache).length} prices`);
    console.timeEnd('[PriceEngine] Initial price load');
  } catch (err) {
    console.error('[PriceEngine] Initial load failed:', err.message);
    console.timeEnd('[PriceEngine] Initial price load');
  }
}

async function refreshPricesLoop() {
  while (true) {
    await sleep(PRICE_REFRESH_MS);
    try {
      const tickerRes = await axios.get(`${BINANCE_API}/ticker/24hr`, { timeout: 10000 });
      const tickers = (tickerRes.data || []).filter(t =>
        t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN')
      );

      for (const t of tickers) {
        priceCache[t.symbol] = {
          price: parseFloat(t.lastPrice),
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          volume: parseFloat(t.quoteVolume),
          change24h: parseFloat(t.priceChangePercent),
          updatedAt: Date.now(),
        };
      }

      for (const coin of coinListCache) {
        const live = priceCache[coin.symbol + 'USDT'];
        if (live) {
          coin.current_price = live.price;
          coin.high_24h = live.high24h;
          coin.low_24h = live.low24h;
          coin.total_volume = live.volume;
          coin.price_change_percentage_1h_in_currency = live.change24h;
        }
      }
      console.log(`[PriceEngine] Prices refreshed: ${tickers.length} tickers`);
    } catch (err) {
      console.error('[PriceEngine] Price refresh failed:', err.message);
    }
  }
}

async function refreshGlobalLoop() {
  while (true) {
    await sleep(GLOBAL_REFRESH_MS);
    await loadGlobalData();
  }
}

async function refreshMarketCapLoop() {
  while (true) {
    await sleep(MCAP_REFRESH_MS);
    try {
      const capData = await loadCoinCapData();
      if (Object.keys(capData).length > 0) {
        marketCapCache = capData;
        for (const coin of coinListCache) {
          const cap = capData[coin.symbol];
          if (cap) {
            coin.market_cap = cap.marketCapUsd;
            coin.market_cap_rank = cap.rank;
            coin.price_change_percentage_24h = cap.changePercent24Hr;
          }
        }
        console.log('[PriceEngine] Market cap refreshed');
      }
    } catch {}
  }
}

async function start() {
  if (isInitialized) return;
  isInitialized = true;
  console.log('[PriceEngine] Starting...');

  await Promise.all([loadInitialPrices(), loadGlobalData()]);
  connectWebSocket();

  refreshPricesLoop().catch(() => {});
  refreshGlobalLoop().catch(() => {});
  refreshMarketCapLoop().catch(() => {});
}

function getPrices() { return coinListCache; }
function getPrice(symbol) { return priceCache[symbol] || null; }
function getGlobal() { return globalCache; }
function getCoinList() { return coinListCache; }
function getMarketCapData() { return marketCapCache; }
function isReady() { return coinListCache.length > 0; }

module.exports = { start, getPrices, getPrice, getGlobal, getCoinList, getMarketCapData, isReady, initReverseMap };
