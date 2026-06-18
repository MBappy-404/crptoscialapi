const { calculateSignal } = require('../utils/technicalAnalysis');
const { addSuggestion, checkHits, getPerformance, getRecentSuggestions, getTopHits } = require('../utils/suggestionTracker');
const klineEngine = require('./klineEngine');
const priceEngine = require('./priceEngine');
const signalStore = require('./signalStore');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let analysisCache = new Map();
let isInitialized = false;

function getCapCategory(marketCap) {
  if (marketCap >= 10e9) return 'large';
  if (marketCap >= 2e9) return 'mid';
  if (marketCap >= 300e6) return 'small';
  return 'micro';
}

function getCapLabel(cat) {
  return { large: 'Large Cap', mid: 'Mid Cap', small: 'Small Cap', micro: 'Micro Cap' }[cat] || cat;
}

function generateCoinAnalysis(symbol, timeframe) {
  const klines = klineEngine.getKlines(symbol, timeframe);
  if (!klines || klines.closes.length < 50) return null;

  try {
    const sig = calculateSignal(klines.closes, klines.volumes, klines.highs, klines.lows, timeframe);
    sig.symbol = symbol;
    return sig;
  } catch {
    return null;
  }
}

function calculateSentiment(topCoins) {
  const btc = topCoins.find(c => c.id === 'bitcoin');
  const eth = topCoins.find(c => c.id === 'ethereum');

  let gainers24h = 0, losers24h = 0;
  topCoins.forEach(c => {
    if ((c.price_change_percentage_24h || 0) >= 0) gainers24h++;
    else losers24h++;
  });
  const avg24h = topCoins.reduce((s, c) => s + (c.price_change_percentage_24h || 0), 0) / (topCoins.length || 1);

  const btcChange = btc?.price_change_percentage_24h || 0;
  const ethChange = eth?.price_change_percentage_24h || 0;
  const majorChange = (btcChange + ethChange) / 2;
  const gainersRatio = gainers24h / (gainers24h + losers24h || 1);

  let sentimentScore = Math.round(
    (50 + avg24h * 8) * 0.3 +
    (50 + majorChange * 10) * 0.3 +
    gainersRatio * 100 * 0.2 +
    (50 + btcChange * 8) * 0.2
  );
  sentimentScore = Math.max(0, Math.min(100, sentimentScore));

  let sentiment = "Neutral";
  if (sentimentScore >= 75) sentiment = "Extreme Greed";
  else if (sentimentScore >= 60) sentiment = "Greed";
  else if (sentimentScore <= 25) sentiment = "Extreme Fear";
  else if (sentimentScore <= 40) sentiment = "Fear";

  return { label: sentiment, score: sentimentScore, avg24h: Math.round(avg24h * 100) / 100, gainers24h, losers24h };
}

async function generateFullAnalysis(timeframe) {
  const config = klineEngine.TIMEFRAME_CONFIG[timeframe];
  if (!config) return null;

  console.time(`[AnalysisEngine] Generate ${timeframe}`);
  const startTime = Date.now();

  const topCoins = priceEngine.getCoinList();
  if (!topCoins.length) {
    console.error(`[AnalysisEngine] No coins available for ${timeframe}`);
    console.timeEnd(`[AnalysisEngine] Generate ${timeframe}`);
    return null;
  }

  const globalData = priceEngine.getGlobal() || { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, activeCurrencies: 0 };

  const coinAnalyses = {};
  for (const coin of topCoins) {
    const symbol = coin.symbol + 'USDT';
    const analysis = generateCoinAnalysis(symbol, timeframe);
    if (analysis) {
      coinAnalyses[coin.id] = analysis;
      try { await checkHits(coin.id, coin.current_price); } catch {}
    }
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

    try {
      const direction = c.signal.includes('BUY') ? 'BUY' : 'SELL';
      const isBuy = direction === 'BUY';
      const tp1 = isBuy
        ? c.trading.entryPrice + (c.trading.entryPrice - c.trading.stopLoss) * 1.5
        : c.trading.entryPrice - (c.trading.stopLoss - c.trading.entryPrice) * 1.5;
      const tp2 = isBuy
        ? c.trading.entryPrice + (c.trading.entryPrice - c.trading.stopLoss) * 2.5
        : c.trading.entryPrice - (c.trading.stopLoss - c.trading.entryPrice) * 2.5;

      await signalStore.createSignal({
        symbol: c.symbol + 'USDT',
        timeframe,
        direction,
        signalType: c.signal,
        entryPrice: c.trading.entryPrice,
        stopLoss: c.trading.stopLoss,
        tp1,
        tp2,
        tp3: c.trading.takeProfit,
        takeProfit: c.trading.takeProfit,
        confidence: c.confidence,
        signalScore: direction === 'BUY' ? c.scores.buy : c.scores.sell,
        riskReward: c.trading.riskReward,
      });
    } catch {}

    try {
      await signalStore.checkInvalidation(c);
    } catch {}
  }

  try {
    await signalStore.checkExpiration();
  } catch {}

  try {
    const currentPrices = {};
    for (const coin of topCoins) {
      currentPrices[coin.symbol + 'USDT'] = coin.current_price;
    }
    await signalStore.checkPriceUpdates(currentPrices);
  } catch {}

  const sorted = [...withSignals].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.volumeStrength - a.volumeStrength;
  });

  const btc = topCoins.find(c => c.id === 'bitcoin');
  const eth = topCoins.find(c => c.id === 'ethereum');

  const sentiment = calculateSentiment(topCoins);

  const trendScore = sentiment.avg24h * 0.5 + (btc?.price_change_percentage_24h || 0) * 0.5;
  const trend = trendScore > 0.5 ? 'Bullish' : trendScore < -0.5 ? 'Bearish' : 'Sideways';

  let perf = { hits: 0, missed: 0, active: 0, hitRate: 0 };
  let recentSugs = [];
  let topHitsData = [];
  let activeSignals = [];
  let signalStats = { wins: 0, losses: 0, invalidated: 0, expired: 0, tp1Hits: 0, tp2Hits: 0, tp3Hits: 0, total: 0, winRate: 0, avgRR: 0, bestCoin: null, bestTimeframe: null };
  try { perf = await getPerformance(); } catch {}
  try { recentSugs = await getRecentSuggestions(20); } catch {}
  try { topHitsData = await getTopHits(); } catch {}
  try { activeSignals = await signalStore.getActiveSignals(); } catch {}
  try { signalStats = await signalStore.getSignalStats(); } catch {}

  const analysis = {
    timeframe: config.label || timeframe,
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
      label: sentiment.label, score: sentiment.score,
      avg24h: sentiment.avg24h,
      gainers24h: sentiment.gainers24h, losers24h: sentiment.losers24h,
    },
    market: {
      trend,
      volatility: Math.max(...topCoins.map(c => Math.abs(c.price_change_percentage_24h || 0))),
    },
    signals: {
      strongBuy: sorted.filter(c => c.signal === 'STRONG BUY').slice(0, 10),
      buy: sorted.filter(c => c.signal === 'BUY').slice(0, 10),
      weakBuy: sorted.filter(c => c.signal === 'WEAK BUY').slice(0, 10),
      strongShort: sorted.filter(c => c.signal === 'STRONG SHORT').slice(0, 10),
      short: sorted.filter(c => c.signal === 'SHORT').slice(0, 10),
      weakSell: sorted.filter(c => c.signal === 'WEAK SELL').slice(0, 10),
    },
    allSignals: sorted,
    performance: perf,
    activeSignals,
    signalStats,
    recentSuggestions: recentSugs,
    topHits: topHitsData,
    timestamps: new Date().toISOString(),
  };

  const duration = Date.now() - startTime;
  console.log(`[AnalysisEngine] ${timeframe} generated in ${duration}ms - ${Object.keys(coinAnalyses).length} coins, ${withSignals.length} signals`);
  console.timeEnd(`[AnalysisEngine] Generate ${timeframe}`);

  return analysis;
}

async function startWorker() {
  const timeframes = Object.keys(klineEngine.TIMEFRAME_CONFIG);

  while (true) {
    for (const tf of timeframes) {
      const loaded = klineEngine.getLoadedCount(tf);
      if (loaded < 10) {
        console.log(`[AnalysisEngine] Waiting for klines: ${tf} has ${loaded} coins`);
        await sleep(30000);
        continue;
      }

      try {
        const analysis = await generateFullAnalysis(tf);
        if (analysis) {
          analysisCache.set(tf, { data: analysis, timestamp: Date.now() });
          console.log(`[AnalysisEngine] ${tf} analysis cached`);
        }
      } catch (err) {
        console.error(`[AnalysisEngine] ${tf} analysis failed:`, err.message);
      }

      const config = klineEngine.TIMEFRAME_CONFIG[tf];
      await sleep(config.refreshMs);
    }
  }
}

async function start() {
  if (isInitialized) return;
  isInitialized = true;
  console.log('[AnalysisEngine] Starting background worker...');

  while (!priceEngine.isReady()) {
    await sleep(5000);
  }

  startWorker().catch(() => {});
}

function getAnalysis(timeframe) {
  const cached = analysisCache.get(timeframe);
  return cached ? cached.data : null;
}

function getAnalysisTimestamp(timeframe) {
  const cached = analysisCache.get(timeframe);
  return cached ? cached.timestamp : 0;
}

function generateCoinAnalysisForTimeframe(symbol, timeframe) {
  return generateCoinAnalysis(symbol, timeframe);
}

module.exports = { start, getAnalysis, getAnalysisTimestamp, generateCoinAnalysisForTimeframe };
