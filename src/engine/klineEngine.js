const axios = require('axios');

const BINANCE_API = 'https://api.binance.com/api/v3';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TIMEFRAME_CONFIG = {
  '15m': { interval: '15m', initialLimit: 210, refreshMs: 60000 },
  '30m': { interval: '30m', initialLimit: 210, refreshMs: 120000 },
  '1h':  { interval: '1h',  initialLimit: 210, refreshMs: 300000 },
  '3h':  { interval: '3h',  initialLimit: 210, refreshMs: 420000 },
  '4h':  { interval: '4h',  initialLimit: 210, refreshMs: 600000 },
  '12h': { interval: '12h', initialLimit: 210, refreshMs: 1200000 },
  '1d':  { interval: '1d',  initialLimit: 210, refreshMs: 1800000 },
};

let klineCache = new Map();
let isInitialized = false;

const BATCH_SIZE = 10;
const BATCH_DELAY = 1000;
const INITIAL_COIN_LIMIT = 50;

async function fetchKlines(symbol, interval, limit) {
  try {
    const { data } = await axios.get(`${BINANCE_API}/klines`, {
      params: { symbol, interval, limit },
      timeout: 15000,
    });
    return data.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      time: k[0],
    }));
  } catch {
    return [];
  }
}

function cacheKey(symbol, timeframe) {
  return `${symbol}_${timeframe}`;
}

function storeKlines(symbol, timeframe, klines) {
  const key = cacheKey(symbol, timeframe);
  klineCache.set(key, {
    closes: klines.map(k => k.close),
    highs: klines.map(k => k.high),
    lows: klines.map(k => k.low),
    volumes: klines.map(k => k.volume),
    times: klines.map(k => k.time),
    updatedAt: Date.now(),
  });
}

async function loadInitialKlines(symbols, timeframe) {
  const config = TIMEFRAME_CONFIG[timeframe];
  if (!config) return;

  const loadSymbols = symbols.slice(0, INITIAL_COIN_LIMIT);
  console.log(`[KlineEngine] Loading ${loadSymbols.length} coins for ${timeframe}...`);
  console.time(`[KlineEngine] Load ${timeframe}`);

  let loaded = 0;
  for (let i = 0; i < loadSymbols.length; i += BATCH_SIZE) {
    const batch = loadSymbols.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (symbol) => {
        const klines = await fetchKlines(symbol, config.interval, config.initialLimit);
        if (klines.length >= 50) {
          storeKlines(symbol, timeframe, klines);
          loaded++;
        }
      })
    );
    if (i + BATCH_SIZE < loadSymbols.length) await sleep(BATCH_DELAY);
  }

  console.log(`[KlineEngine] Loaded ${loaded}/${loadSymbols.length} for ${timeframe}`);
  console.timeEnd(`[KlineEngine] Load ${timeframe}`);
}

async function refreshKlinesForTimeframe(symbols, timeframe) {
  const config = TIMEFRAME_CONFIG[timeframe];
  if (!config) return;

  const refreshSymbols = symbols.slice(0, INITIAL_COIN_LIMIT);
  console.time(`[KlineEngine] Refresh ${timeframe}`);

  let refreshed = 0;
  for (let i = 0; i < refreshSymbols.length; i += BATCH_SIZE) {
    const batch = refreshSymbols.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (symbol) => {
        const key = cacheKey(symbol, timeframe);
        const cached = klineCache.get(key);

        if (!cached || !cached.times.length) {
          const klines = await fetchKlines(symbol, config.interval, config.initialLimit);
          if (klines.length >= 50) {
            storeKlines(symbol, timeframe, klines);
            refreshed++;
          }
          return;
        }

        const newKlines = await fetchKlines(symbol, config.interval, 3);
        if (!newKlines.length) return;

        const lastCachedTime = cached.times[cached.times.length - 1];
        const lastNewTime = newKlines[newKlines.length - 1].time;

        if (lastNewTime > lastCachedTime) {
          for (const k of newKlines) {
            if (k.time > lastCachedTime) {
              cached.closes.push(k.close);
              cached.highs.push(k.high);
              cached.lows.push(k.low);
              cached.volumes.push(k.volume);
              cached.times.push(k.time);
            } else if (k.time === lastCachedTime) {
              cached.closes[cached.closes.length - 1] = k.close;
              cached.highs[cached.highs.length - 1] = k.high;
              cached.lows[cached.lows.length - 1] = k.low;
              cached.volumes[cached.volumes.length - 1] = k.volume;
            }
          }

          const maxLen = config.initialLimit;
          if (cached.closes.length > maxLen) {
            const excess = cached.closes.length - maxLen;
            cached.closes.splice(0, excess);
            cached.highs.splice(0, excess);
            cached.lows.splice(0, excess);
            cached.volumes.splice(0, excess);
            cached.times.splice(0, excess);
          }

          cached.updatedAt = Date.now();
          refreshed++;
        } else if (lastNewTime === lastCachedTime) {
          const lastK = newKlines[newKlines.length - 1];
          cached.closes[cached.closes.length - 1] = lastK.close;
          cached.highs[cached.highs.length - 1] = lastK.high;
          cached.lows[cached.lows.length - 1] = lastK.low;
          cached.volumes[cached.volumes.length - 1] = lastK.volume;
          cached.updatedAt = Date.now();
          refreshed++;
        }
      })
    );
    if (i + BATCH_SIZE < refreshSymbols.length) await sleep(BATCH_DELAY);
  }

  console.timeEnd(`[KlineEngine] Refresh ${timeframe}`);
}

async function startRefreshLoop(symbols) {
  while (true) {
    for (const [timeframe] of Object.entries(TIMEFRAME_CONFIG)) {
      const loaded = getLoadedCount(timeframe);
      if (loaded < 5) {
        await sleep(30000);
        continue;
      }
      try {
        await refreshKlinesForTimeframe(symbols, timeframe);
      } catch (err) {
        console.error(`[KlineEngine] Refresh ${timeframe} error:`, err.message);
      }
      await sleep(5000);
    }
  }
}

async function start(symbols) {
  if (isInitialized) return;
  isInitialized = true;
  console.log(`[KlineEngine] Starting for ${Math.min(symbols.length, INITIAL_COIN_LIMIT)} coins...`);

  for (const timeframe of Object.keys(TIMEFRAME_CONFIG)) {
    try {
      await loadInitialKlines(symbols, timeframe);
    } catch (err) {
      console.error(`[KlineEngine] Initial load ${timeframe} error:`, err.message);
    }
  }

  console.log('[KlineEngine] Initial load complete');
  startRefreshLoop(symbols).catch(() => {});
}

function getKlines(symbol, timeframe) {
  return klineCache.get(cacheKey(symbol, timeframe)) || null;
}

function isLoaded(symbol, timeframe) {
  const cached = klineCache.get(cacheKey(symbol, timeframe));
  return cached && cached.closes.length >= 50;
}

function getLoadedCount(timeframe) {
  let count = 0;
  for (const [key] of klineCache) {
    if (key.endsWith(`_${timeframe}`)) count++;
  }
  return count;
}

module.exports = { start, getKlines, isLoaded, getLoadedCount, TIMEFRAME_CONFIG };
