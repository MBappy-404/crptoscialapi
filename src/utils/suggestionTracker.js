const CryptoSuggestion = require("../app/modules/crypto/suggestion.model");

const inMemoryCache = [];

async function addSuggestion(coin) {
  const type = coin.signal.includes('BUY') ? 'BUY' : coin.signal.includes('SELL') ? 'SELL' : null;
  if (!type) return;

  const doc = {
    coinId: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    type,
    signal: coin.signal,
    confidence: coin.confidence,
    entryPrice: coin.trading?.entryPrice,
    stopLoss: coin.trading?.stopLoss,
    takeProfit: coin.trading?.takeProfit,
    riskReward: coin.trading?.riskReward,
    risk: coin.risk?.level,
    leverage: coin.trading?.leverage,
  };

  inMemoryCache.push({ ...doc, timestamp: Date.now(), hit: false, missed: false, hitTarget: null });

  try {
    const existing = await CryptoSuggestion.findOne({
      coinId: doc.coinId,
      type: doc.type,
      status: "ACTIVE",
    });
    if (!existing) {
      await CryptoSuggestion.create(doc);
    }
  } catch {}
}

async function checkHits(coinId, currentPrice) {
  for (const s of inMemoryCache) {
    if (s.id === coinId && !s.hit && !s.missed) {
      if (s.takeProfit && currentPrice >= s.takeProfit) {
        s.hit = true;
        s.hitTarget = 'takeProfit';
        await markDBHit(coinId, 'HIT_TP', currentPrice);
      } else if (s.stopLoss && currentPrice <= s.stopLoss) {
        s.missed = true;
        s.hitTarget = 'stopLoss';
        await markDBHit(coinId, 'HIT_SL', currentPrice);
      }
    }
  }
}

async function markDBHit(coinId, status, hitPrice) {
  try {
    await CryptoSuggestion.findOneAndUpdate(
      { coinId, status: "ACTIVE" },
      { status, hitAt: new Date(), hitPrice },
      { sort: { createdAt: -1 } }
    );
  } catch {}
}

async function getPerformance() {
  try {
    const hits = await CryptoSuggestion.countDocuments({ status: "HIT_TP" });
    const missed = await CryptoSuggestion.countDocuments({ status: "HIT_SL" });
    const active = await CryptoSuggestion.countDocuments({ status: "ACTIVE" });
    const total = hits + missed;
    const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
    return { total: total + active, hits, missed, active, hitRate };
  } catch {
    const hits = inMemoryCache.filter(s => s.hit).length;
    const missed = inMemoryCache.filter(s => s.missed).length;
    const total = hits + missed;
    return { total: inMemoryCache.length, hits, missed, active: inMemoryCache.length - total, hitRate: total > 0 ? Math.round((hits / total) * 100) : 0 };
  }
}

async function getRecentSuggestions(limit = 20) {
  try {
    const docs = await CryptoSuggestion.find().sort({ createdAt: -1 }).limit(limit).lean();
    return docs.map(d => ({
      id: d.coinId, symbol: d.symbol, name: d.name, signal: d.signal,
      confidence: d.confidence, entryPrice: d.entryPrice, stopLoss: d.stopLoss,
      takeProfit: d.takeProfit, riskReward: d.riskReward, risk: d.risk,
      status: d.status, hitAt: d.hitAt, hitPrice: d.hitPrice,
      type: d.type, leverage: d.leverage, timestamp: d.createdAt,
      hit: d.status === 'HIT_TP', missed: d.status === 'HIT_SL',
    }));
  } catch {
    return inMemoryCache.slice(-limit);
  }
}

async function getTopHits() {
  try {
    const docs = await CryptoSuggestion.find({ status: "HIT_TP" }).sort({ hitAt: -1 }).limit(10).lean();
    return docs.map(d => ({
      id: d.coinId, symbol: d.symbol, name: d.name, signal: d.signal,
      price: d.hitPrice, entryPrice: d.entryPrice, takeProfit: d.takeProfit,
      type: d.type, hitAt: d.hitAt, confidence: d.confidence,
    }));
  } catch {
    return inMemoryCache.filter(s => s.hit).slice(-10);
  }
}

module.exports = { addSuggestion, checkHits, getPerformance, getRecentSuggestions, getTopHits };
