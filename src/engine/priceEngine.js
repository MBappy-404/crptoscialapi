const axios = require('axios');

const BINANCE_API = 'https://api.binance.com/api/v3';
const COINCAP_API = 'https://api.coincap.io/v2';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let priceCache = {};
let coinListCache = [];
let globalCache = null;
let isInitialized = false;
let reverseMap = {};

function initReverseMap(map) {
  Object.assign(reverseMap, map);
}

async function loadCoinCapData() {
  try {
    const { data } = await axios.get(`${COINCAP_API}/assets?limit=200`, { timeout: 8000 });
    const map = {};
    for (const a of (data.data || [])) {
      map[a.symbol] = {
        marketCapUsd: parseFloat(a.marketCapUsd),
        volumeUsd24Hr: parseFloat(a.volumeUsd24Hr),
        changePercent24Hr: parseFloat(a.changePercent24Hr),
        name: a.name,
        rank: a.rank,
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
  console.time('[PriceEngine] Initial load');
  try {
    const [tickerRes, capData] = await Promise.all([
      axios.get(`${BINANCE_API}/ticker/24hr`, { timeout: 15000 }),
      loadCoinCapData(),
    ]);

    const capAvailable = Object.keys(capData).length > 0;

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
        const cap = capData[sym] || {};
        return {
          id: reverseMap[sym] || t.symbol.toLowerCase(),
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
      .filter(c => capAvailable ? c.market_cap > 0 : true)
      .sort((a, b) => capAvailable ? b.market_cap - a.market_cap : parseFloat(b.total_volume) - parseFloat(a.total_volume))
      .slice(0, 200)
      .map((c, i) => ({ ...c, market_cap_rank: c.market_cap > 0 ? c.market_cap_rank : i + 1 }));

    console.log(`[PriceEngine] Loaded ${coinListCache.length} coins`);
    console.timeEnd('[PriceEngine] Initial load');
  } catch (err) {
    console.error('[PriceEngine] Initial load failed:', err.message);
    console.timeEnd('[PriceEngine] Initial load');
  }
}

async function refreshPricesLoop() {
  while (true) {
    await sleep(30000);
    try {
      if (coinListCache.length === 0) {
        console.log('[PriceEngine] coinListCache is empty, retrying initial load...');
        await loadInitialPrices();
        if (coinListCache.length === 0) {
          continue;
        }
      }
      const tickerRes = await axios.get(`${BINANCE_API}/ticker/24hr`, { timeout: 10000 });
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
      console.log('[PriceEngine] Prices refreshed');
    } catch (err) {
      console.error('[PriceEngine] Price refresh failed:', err.message);
    }
  }
}

async function refreshGlobalLoop() {
  while (true) {
    await sleep(60000);
    try {
      await loadGlobalData();
    } catch {}
  }
}

async function start() {
  if (isInitialized) return;
  isInitialized = true;
  console.log('[PriceEngine] Starting...');

  await Promise.all([loadInitialPrices(), loadGlobalData()]);

  refreshPricesLoop().catch(() => {});
  refreshGlobalLoop().catch(() => {});

  console.log('[PriceEngine] Ready');
}

function getPrices() { return coinListCache; }
function getPrice(symbol) { return priceCache[symbol] || null; }
function getGlobal() { return globalCache; }
function getCoinList() { return coinListCache; }
function isReady() { return coinListCache.length > 0; }

module.exports = { start, getPrices, getPrice, getGlobal, getCoinList, isReady, initReverseMap };
