const { Schema, model } = require("mongoose");

const signalSchema = new Schema(
  {
    symbol: { type: String, required: true, index: true },
    timeframe: { type: String, required: true, enum: ['15m', '30m', '1h', '3h', '4h', '12h', '1d'] },
    direction: { type: String, required: true, enum: ['BUY', 'SELL'] },
    signalType: { type: String, required: true },
    entryPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    tp1: Number,
    tp2: Number,
    tp3: Number,
    takeProfit: Number,
    confidence: { type: Number, default: 0 },
    signalScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'WIN', 'LOSS', 'INVALIDATED', 'EXPIRED'],
      default: 'ACTIVE',
    },
    tp1Hit: { type: Boolean, default: false },
    tp2Hit: { type: Boolean, default: false },
    tp3Hit: { type: Boolean, default: false },
    exitPrice: Number,
    riskReward: Number,
    expiredAt: Date,
    isSelected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

signalSchema.index({ symbol: 1, timeframe: 1, direction: 1, status: 1 });
signalSchema.index({ status: 1, createdAt: -1 });
signalSchema.index({ timeframe: 1, status: 1 });

module.exports = model("Signal", signalSchema);
