function sma(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function ema(data, period) {
  const k = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    if (data[i] === null || data[i] === undefined) { result.push(result[i - 1]); continue; }
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function rsi(closes, period = 14) {
  const result = [];
  if (closes.length < period + 1) return closes.map(() => 50);
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff; else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = 0; i < period; i++) result.push(50);
  if (avgLoss === 0) result.push(100);
  else result.push(100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) result.push(100);
    else result.push(100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function volumeConfirmation(volumes, period = 20) {
  if (volumes.length < period + 1) return false;
  const currentVol = volumes[volumes.length - 1];
  let sum = 0;
  for (let i = volumes.length - period - 1; i < volumes.length - 1; i++) sum += volumes[i];
  const avgVol = sum / period;
  return currentVol > avgVol;
}

function volumeStrength(volumes, period = 20) {
  if (volumes.length < period + 1) return 0;
  const currentVol = volumes[volumes.length - 1];
  let sum = 0;
  for (let i = volumes.length - period - 1; i < volumes.length - 1; i++) sum += volumes[i];
  const avgVol = sum / period;
  if (avgVol === 0) return 0;
  return Math.round((currentVol / avgVol) * 100) / 100;
}

function detectGoldenCross(ma45, ma50) {
  if (ma45.length < 2 || ma50.length < 2) return false;
  const p45 = ma45[ma45.length - 2], p50 = ma50[ma50.length - 2];
  const c45 = ma45[ma45.length - 1], c50 = ma50[ma50.length - 1];
  if (p45 === null || p50 === null || c45 === null || c50 === null) return false;
  return p45 <= p50 && c45 > c50;
}

function detectDeathCross(ma45, ma50) {
  if (ma45.length < 2 || ma50.length < 2) return false;
  const p45 = ma45[ma45.length - 2], p50 = ma50[ma50.length - 2];
  const c45 = ma45[ma45.length - 1], c50 = ma50[ma50.length - 1];
  if (p45 === null || p50 === null || c45 === null || c50 === null) return false;
  return p45 >= p50 && c45 < c50;
}

function marketStructure(price, ma45Now, ma50Now) {
  if (ma45Now === null || ma50Now === null) return 'Unknown';
  if (price > ma45Now && price > ma50Now && ma45Now > ma50Now) return 'Bullish';
  if (price < ma45Now && price < ma50Now && ma45Now < ma50Now) return 'Bearish';
  return 'Neutral';
}

function detectMARejection(highs, lows, closes, ma100Now, ma200Now) {
  if (closes.length < 2 || (!ma100Now && !ma200Now)) return false;
  const prevHigh = highs[highs.length - 2];
  const prevClose = closes[closes.length - 2];
  const currClose = closes[closes.length - 1];
  if (ma100Now && ((prevHigh >= ma100Now && currClose < ma100Now) || (prevClose >= ma100Now && currClose < ma100Now))) return true;
  if (ma200Now && ((prevHigh >= ma200Now && currClose < ma200Now) || (prevClose >= ma200Now && currClose < ma200Now))) return true;
  return false;
}

function calculateSignal(closes, volumes, highs, lows, timeframe) {
  const price = closes[closes.length - 1];
  const rsiValues = rsi(closes, 14);
  const rsiNow = rsiValues[rsiValues.length - 1];

  const ma20 = sma(closes, 20);
  const ma45 = sma(closes, 45);
  const ma50 = sma(closes, 50);
  const ma100 = sma(closes, 100);
  const ma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);

  const ma20Now = ma20[ma20.length - 1];
  const ma45Now = ma45[ma45.length - 1];
  const ma50Now = ma50[ma50.length - 1];
  const ma100Now = ma100[ma100.length - 1];
  const ma200Now = ma200[ma200.length - 1];
  const ema20Now = ema20[ema20.length - 1];
  const ema50Now = ema50[ema50.length - 1];

  const goldenCross = detectGoldenCross(ma45, ma50);
  const deathCross = detectDeathCross(ma45, ma50);
  const ema20CrossAbove50 = ema20.length >= 2 && ema50.length >= 2 && ema20[ema20.length - 2] <= ema50[ema50.length - 2] && ema20Now > ema50Now;
  const ema20CrossBelow50 = ema20.length >= 2 && ema50.length >= 2 && ema20[ema20.length - 2] >= ema50[ema50.length - 2] && ema20Now < ema50Now;
  const volConfirmed = volumeConfirmation(volumes, 20);
  const volStr = volumeStrength(volumes, 20);
  const structure = marketStructure(price, ma45Now, ma50Now);
  const maRejection = detectMARejection(highs, lows, closes, ma100Now, ma200Now);

  let signal = 'NO SIGNAL';
  let confidence = 0;
  let buyScore = 0;
  let sellScore = 0;

  const isSubDay = ['15m', '30m', '1h', '3h', '4h', '12h'].includes(timeframe);

  if (isSubDay) {
    let rsiScore = 0, gcScore = 0, structScore = 0, volScore = 0;

    if (rsiNow < 15) rsiScore = 30;
    else if (rsiNow < 20) rsiScore = 24;
    else if (rsiNow < 25) rsiScore = 18;
    else if (rsiNow < 30) rsiScore = 12;

    if (goldenCross) gcScore = 30;
    else if (ma45Now !== null && ma50Now !== null && ma45Now > ma50Now) {
      const gap = (ma45Now - ma50Now) / ma50Now;
      if (gap > 0.005) gcScore = 20;
      else if (gap > 0.002) gcScore = 14;
      else gcScore = 8;
    }

    if (structure === 'Bullish') structScore = 20;
    else if (structure === 'Neutral' && ma45Now !== null && price > ma45Now) structScore = 10;

    if (volConfirmed) volScore = 20;
    else if (volStr > 1.5) volScore = 10;
    else if (volStr > 1.1) volScore = 5;

    buyScore = rsiScore + gcScore + structScore + volScore;

    if (buyScore >= 50) {
      confidence = buyScore;
      if (confidence >= 85) signal = 'STRONG BUY';
      else if (confidence >= 70) signal = 'BUY';
      else signal = 'WEAK BUY';
    }
  }

  {
    let rsiScore = 0, dcScore = 0, rejectionScore = 0, volScore = 0;

    if (rsiNow > 85) rsiScore = 30;
    else if (rsiNow > 80) rsiScore = 24;
    else if (rsiNow > 75) rsiScore = 18;
    else if (rsiNow > 70) rsiScore = 12;

    if (deathCross) dcScore = 30;
    else if (ma45Now !== null && ma50Now !== null && ma45Now < ma50Now) {
      const gap = (ma50Now - ma45Now) / ma50Now;
      if (gap > 0.005) dcScore = 20;
      else if (gap > 0.002) dcScore = 14;
      else dcScore = 8;
    }

    if (maRejection) rejectionScore = 20;
    else if (ma100Now && Math.abs(price - ma100Now) / price < 0.02) rejectionScore = 10;
    else if (ma200Now && Math.abs(price - ma200Now) / price < 0.02) rejectionScore = 10;

    if (volConfirmed) volScore = 20;
    else if (volStr > 1.5) volScore = 10;
    else if (volStr > 1.1) volScore = 5;

    sellScore = rsiScore + dcScore + rejectionScore + volScore;

    if (sellScore >= 50) {
      if (sellScore >= confidence) {
        confidence = sellScore;
        if (confidence >= 85) signal = 'STRONG SHORT';
        else if (confidence >= 70) signal = 'SHORT';
        else signal = 'WEAK SELL';
      }
    }
  }

  if (confidence < 50) { signal = 'NO SIGNAL'; confidence = 0; }

  const support1 = ma45Now && price > ma45Now ? ma45Now : (ma50Now && price > ma50Now ? ma50Now : null);
  const support2 = ma50Now && ma50Now < price ? ma50Now : (ma100Now && ma100Now < price ? ma100Now : price * 0.95);
  const nearestSupport = support1 || support2 || price * 0.95;
  const nearestResistance = (ma100Now && ma100Now > price ? ma100Now : (ma200Now && ma200Now > price ? ma200Now : price * 1.05));

  let entryPrice = price;
  let stopLoss, takeProfit;
  const isBuy = signal.includes('BUY');
  const isSell = signal.includes('SELL') || signal.includes('SHORT');

  if (isBuy) {
    const riskPct = Math.min(Math.abs(entryPrice - nearestSupport) / entryPrice, 0.08);
    stopLoss = entryPrice * (1 - Math.max(riskPct, 0.02));
    takeProfit = entryPrice + (entryPrice - stopLoss) * 2.5;
  } else if (isSell) {
    const riskPct = Math.min(Math.abs(nearestResistance - entryPrice) / entryPrice, 0.08);
    stopLoss = entryPrice * (1 + Math.max(riskPct, 0.02));
    takeProfit = entryPrice - (stopLoss - entryPrice) * 2.5;
  } else {
    stopLoss = price * 0.97;
    takeProfit = price * 1.03;
  }

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
  const entryDistance = entryPrice > 0 ? Math.round(((price - entryPrice) / entryPrice) * 10000) / 100 : 0;

  const hasSignal = signal !== 'NO SIGNAL';
  return {
    symbol: null, timeframe, signal, confidence,
    currentPrice: Math.round(price * 100) / 100,
    rsi: Math.round(rsiNow * 10) / 10,
    ma20: ma20Now ? Math.round(ma20Now * 100) / 100 : null,
    ma45: ma45Now ? Math.round(ma45Now * 100) / 100 : null,
    ma50: ma50Now ? Math.round(ma50Now * 100) / 100 : null,
    ma100: ma100Now ? Math.round(ma100Now * 100) / 100 : null,
    ma200: ma200Now ? Math.round(ma200Now * 100) / 100 : null,
    ema20: ema20Now ? Math.round(ema20Now * 100) / 100 : null,
    ema50: ema50Now ? Math.round(ema50Now * 100) / 100 : null,
    ema20CrossAbove50, ema20CrossBelow50,
    goldenCross, deathCross, volumeConfirmed: volConfirmed,
    volumeStrength: Math.round(volStr * 100) / 100,
    marketStructure: structure, maRejection, entryDistance,
    scores: { buy: buyScore, sell: sellScore },
    trading: hasSignal ? {
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      riskReward,
      nearestSupport: Math.round(nearestSupport * 100) / 100,
      nearestResistance: Math.round(nearestResistance * 100) / 100,
    } : null,
  };
}

module.exports = { sma, ema, rsi, volumeConfirmation, volumeStrength, detectGoldenCross, detectDeathCross, marketStructure, detectMARejection, calculateSignal };
