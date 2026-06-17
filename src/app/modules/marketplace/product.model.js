const mongoose = require("mongoose");

const productSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 2000 },
    price: { type: Number, required: true },
    image: { type: String, default: "" },
    category: { type: String, enum: ["electronics", "furniture", "clothing", "sports", "other"], default: "other" },
    condition: { type: String, enum: ["new", "like_new", "good", "fair"], default: "good" },
    location: { type: String, default: "" },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["available", "sold"], default: "available" },
  },
  { timestamps: true }
);

productSchema.index({ title: "text", description: "text" });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
