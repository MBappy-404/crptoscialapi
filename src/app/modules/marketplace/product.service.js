const httpStatus = require("http-status");
const ApiError = require("../../../utils/ApiError");
const Product = require("../marketplace/product.model");

const createProduct = async (userId, data) => {
  const product = await Product.create({ ...data, seller: userId });
  return product.populate("seller", "name avatar");
};

const getProductById = async (productId) => {
  const product = await Product.findById(productId).populate("seller", "name avatar");
  if (!product) throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  return product;
};

const getAllProducts = async (page = 1, limit = 20, category, search) => {
  const skip = (page - 1) * limit;
  const filter = { status: "available" };
  if (category && category !== "all") filter.category = category;
  if (search) filter.$text = { $search: search };
  const products = await Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("seller", "name avatar");
  const total = await Product.countDocuments(filter);
  return { products, total, page, pages: Math.ceil(total / limit) };
};

const getSellerProducts = async (userId) => {
  return Product.find({ seller: userId }).sort({ createdAt: -1 }).populate("seller", "name avatar");
};

const updateProduct = async (productId, userId, data) => {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  if (product.seller.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
  Object.assign(product, data);
  await product.save();
  return product.populate("seller", "name avatar");
};

const deleteProduct = async (productId, userId) => {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  if (product.seller.toString() !== userId) throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
  await Product.findByIdAndDelete(productId);
};

module.exports = { createProduct, getProductById, getAllProducts, getSellerProducts, updateProduct, deleteProduct };
