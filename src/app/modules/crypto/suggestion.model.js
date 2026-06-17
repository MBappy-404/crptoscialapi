const { Schema, model } = require("mongoose");

const cryptoSuggestionSchema = new Schema(
  {
    coinId: { type: String, required: true },
    symbol: { type: String, required: true },
    name: String,
    type: { type: String, enum: ["BUY", "SELL", "LONG", "SHORT"], required: true },
    signal: { type: String, required: true },
    confidence: Number,
    entryPrice: Number,
    stopLoss: Number,
    takeProfit: Number,
    riskReward: Number,
    risk: String,
    leverage: String,
    status: { type: String, enum: ["ACTIVE", "HIT_TP", "HIT_SL", "EXPIRED"], default: "ACTIVE" },
    hitAt: Date,
    hitPrice: Number,
    pnl: Number,
    suggestedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

cryptoSuggestionSchema.index({ coinId: 1, status: 1 });
cryptoSuggestionSchema.index({ status: 1, createdAt: -1 });

module.exports = model("CryptoSuggestion", cryptoSuggestionSchema);
