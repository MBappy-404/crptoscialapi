const Signal = require('../app/modules/crypto/signal.model');

const EXPIRY_HOURS = { '1h': 24, '4h': 72, '1d': 168 };
const VALID_TRANSITIONS = {
  'ACTIVE': ['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'WIN', 'LOSS', 'INVALIDATED', 'EXPIRED'],
  'TP1_HIT': ['TP2_HIT', 'TP3_HIT', 'WIN', 'LOSS', 'INVALIDATED', 'EXPIRED'],
  'TP2_HIT': ['TP3_HIT', 'WIN', 'LOSS', 'INVALIDATED', 'EXPIRED'],
  'TP3_HIT': ['WIN'],
};

async function createSignal(signalData) {
  const existing = await Signal.findOne({
    symbol: signalData.symbol,
    timeframe: signalData.timeframe,
    direction: signalData.direction,
    status: { $in: ['ACTIVE', 'TP1_HIT', 'TP2_HIT'] },
  });

  if (existing) {
    existing.confidence = Math.max(existing.confidence, signalData.confidence || 0);
    existing.signalScore = Math.max(existing.signalScore || 0, signalData.signalScore || 0);
    await existing.save();
    return existing;
  }

  return await Signal.create(signalData);
}

async function updateSignalStatus(signalId, newStatus, exitPrice) {
  const sig = await Signal.findById(signalId);
  if (!sig) return null;

  const allowed = VALID_TRANSITIONS[sig.status];
  if (!allowed || !allowed.includes(newStatus)) return sig;

  sig.status = newStatus;
  if (exitPrice) sig.exitPrice = exitPrice;

  if (newStatus === 'TP1_HIT') sig.tp1Hit = true;
  if (newStatus === 'TP2_HIT') sig.tp2Hit = true;
  if (newStatus === 'TP3_HIT') sig.tp3Hit = true;

  await sig.save();
  return sig;
}

async function checkExpiration() {
  const now = Date.now();
  let changed = false;

  for (const tf of Object.keys(EXPIRY_HOURS)) {
    const expiryMs = EXPIRY_HOURS[tf] * 3600000;
    const cutoff = new Date(now - expiryMs);

    const expired = await Signal.find({
      timeframe: tf,
      status: { $in: ['ACTIVE', 'TP1_HIT', 'TP2_HIT'] },
      createdAt: { $lt: cutoff },
    });

    for (const sig of expired) {
      sig.status = 'EXPIRED';
      sig.expiredAt = new Date();
      await sig.save();
      changed = true;
    }
  }

  return changed;
}

async function checkInvalidation(analysisResult) {
  if (!analysisResult || !analysisResult.symbol) return false;

  const activeSignals = await Signal.find({
    symbol: analysisResult.symbol,
    status: { $in: ['ACTIVE', 'TP1_HIT', 'TP2_HIT'] },
  });

  let changed = false;

  for (const sig of activeSignals) {
    let shouldInvalidate = false;
    const isBuy = sig.direction === 'BUY';

    if (isBuy) {
      if (analysisResult.ema20CrossBelow50) shouldInvalidate = true;
      if (analysisResult.ma200 && analysisResult.currentPrice < analysisResult.ma200) shouldInvalidate = true;
      if (analysisResult.rsi && analysisResult.rsi < 50) shouldInvalidate = true;
      if (analysisResult.marketStructure === 'Bearish') shouldInvalidate = true;
      if (!analysisResult.volumeConfirmed) shouldInvalidate = true;
    } else {
      if (analysisResult.ema20CrossAbove50) shouldInvalidate = true;
      if (analysisResult.ma200 && analysisResult.currentPrice > analysisResult.ma200) shouldInvalidate = true;
      if (analysisResult.rsi && analysisResult.rsi > 50) shouldInvalidate = true;
      if (analysisResult.marketStructure === 'Bullish') shouldInvalidate = true;
      if (!analysisResult.volumeConfirmed) shouldInvalidate = true;
    }

    if (shouldInvalidate) {
      sig.status = 'INVALIDATED';
      sig.exitPrice = analysisResult.currentPrice;
      await sig.save();
      changed = true;
    }
  }

  return changed;
}

async function checkPriceUpdates(currentPrices) {
  let changed = false;

  const activeSignals = await Signal.find({
    status: { $in: ['ACTIVE', 'TP1_HIT', 'TP2_HIT'] },
  });

  for (const sig of activeSignals) {
    const price = currentPrices[sig.symbol];
    if (price == null) continue;

    const isBuy = sig.direction === 'BUY';
    let updated = false;

    if (!sig.tp1Hit && isBuy && price >= sig.tp1) {
      sig.status = 'TP1_HIT';
      sig.tp1Hit = true;
      sig.exitPrice = price;
      updated = true;
    } else if (!sig.tp1Hit && !isBuy && price <= sig.tp1) {
      sig.status = 'TP1_HIT';
      sig.tp1Hit = true;
      sig.exitPrice = price;
      updated = true;
    }

    if (sig.tp1Hit && !sig.tp2Hit && isBuy && price >= sig.tp2) {
      sig.status = 'TP2_HIT';
      sig.tp2Hit = true;
      sig.exitPrice = price;
      updated = true;
    } else if (sig.tp1Hit && !sig.tp2Hit && !isBuy && price <= sig.tp2) {
      sig.status = 'TP2_HIT';
      sig.tp2Hit = true;
      sig.exitPrice = price;
      updated = true;
    }

    if (sig.tp2Hit && !sig.tp3Hit && isBuy && price >= sig.tp3) {
      sig.status = 'TP3_HIT';
      sig.tp3Hit = true;
      sig.exitPrice = price;
      updated = true;
    } else if (sig.tp2Hit && !sig.tp3Hit && !isBuy && price <= sig.tp3) {
      sig.status = 'TP3_HIT';
      sig.tp3Hit = true;
      sig.exitPrice = price;
      updated = true;
    }

    if (sig.status === 'TP3_HIT') {
      sig.status = 'WIN';
      sig.exitPrice = price;
      updated = true;
    }

    if (!sig.tp1Hit && isBuy && price <= sig.stopLoss) {
      sig.status = 'LOSS';
      sig.exitPrice = price;
      updated = true;
    } else if (!sig.tp1Hit && !isBuy && price >= sig.stopLoss) {
      sig.status = 'LOSS';
      sig.exitPrice = price;
      updated = true;
    }

    if (updated) {
      await sig.save();
      changed = true;
    }
  }

  return changed;
}

async function getActiveSignals() {
  return await Signal.find({ status: { $in: ['ACTIVE', 'TP1_HIT', 'TP2_HIT'] } }).sort({ createdAt: -1 }).lean();
}

async function getAllSignals(limit = 100) {
  return await Signal.find().sort({ createdAt: -1 }).limit(limit).lean();
}

async function getSignalStats() {
  const stats = await Signal.aggregate([
    {
      $group: {
        _id: '$timeframe',
        wins: { $sum: { $cond: [{ $eq: ['$status', 'WIN'] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $eq: ['$status', 'LOSS'] }, 1, 0] } },
        invalidated: { $sum: { $cond: [{ $eq: ['$status', 'INVALIDATED'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0] } },
        tp1Hits: { $sum: { $cond: ['$tp1Hit', 1, 0] } },
        tp2Hits: { $sum: { $cond: ['$tp2Hit', 1, 0] } },
        tp3Hits: { $sum: { $cond: ['$tp3Hit', 1, 0] } },
        avgRR: { $avg: '$riskReward' },
      },
    },
  ]);

  const coinStats = await Signal.aggregate([
    { $match: { status: 'WIN' } },
    { $group: { _id: '$symbol', wins: { $sum: 1 } } },
    { $sort: { wins: -1 } },
    { $limit: 1 },
  ]);

  let totalWins = 0, totalLosses = 0, totalInvalidated = 0, totalExpired = 0;
  let totalTp1 = 0, totalTp2 = 0, totalTp3 = 0, totalRR = 0, rrCount = 0;

  for (const s of stats) {
    totalWins += s.wins || 0;
    totalLosses += s.losses || 0;
    totalInvalidated += s.invalidated || 0;
    totalExpired += s.expired || 0;
    totalTp1 += s.tp1Hits || 0;
    totalTp2 += s.tp2Hits || 0;
    totalTp3 += s.tp3Hits || 0;
    if (s.avgRR) { totalRR += s.avgRR * ((s.wins || 0) + (s.losses || 0)); rrCount += (s.wins || 0) + (s.losses || 0); }
  }

  const total = totalWins + totalLosses;
  const bestTimeframe = stats.sort((a, b) => (b.wins || 0) - (a.wins || 0))[0]?._id || null;

  return {
    wins: totalWins,
    losses: totalLosses,
    invalidated: totalInvalidated,
    expired: totalExpired,
    tp1Hits: totalTp1,
    tp2Hits: totalTp2,
    tp3Hits: totalTp3,
    total,
    winRate: total > 0 ? Math.round((totalWins / total) * 100) : 0,
    avgRR: rrCount > 0 ? Math.round((totalRR / rrCount) * 100) / 100 : 0,
    bestCoin: coinStats[0]?._id || null,
    bestTimeframe,
    byTimeframe: stats,
  };
}

async function archiveCompleted() {
  const completed = await Signal.find({ status: { $in: ['WIN', 'LOSS', 'INVALIDATED', 'EXPIRED'] } }).lean();
  return completed;
}

async function clearAll() {
  await Signal.deleteMany({});
}

module.exports = {
  createSignal,
  updateSignalStatus,
  checkExpiration,
  checkInvalidation,
  checkPriceUpdates,
  getActiveSignals,
  getAllSignals,
  getSignalStats,
  archiveCompleted,
  clearAll,
};
