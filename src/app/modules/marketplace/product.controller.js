const httpStatus = require("http-status");
const catchAsync = require("../../../utils/catchAsync");
const productService = require("./product.service");
const { httpResponse } = require("../../../utils/httpResponse");

const createProduct = catchAsync(async (req, res) => {
  const product = await productService.createProduct(req.user.id, req.body);
  res.status(httpStatus.CREATED).json(httpResponse("success", product, "Product listed."));
});

const getProduct = catchAsync(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  res.status(httpStatus.OK).json(httpResponse("success", product, ""));
});

const getAllProducts = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, category, search } = req.query;
  const result = await productService.getAllProducts(parseInt(page), parseInt(limit), category, search);
  res.status(httpStatus.OK).json(httpResponse("success", result, ""));
});

const getSellerProducts = catchAsync(async (req, res) => {
  const products = await productService.getSellerProducts(req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", products, ""));
});

const updateProduct = catchAsync(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.user.id, req.body);
  res.status(httpStatus.OK).json(httpResponse("success", product, "Product updated."));
});

const deleteProduct = catchAsync(async (req, res) => {
  await productService.deleteProduct(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(httpResponse("success", {}, "Product deleted."));
});

module.exports = { createProduct, getProduct, getAllProducts, getSellerProducts, updateProduct, deleteProduct };
