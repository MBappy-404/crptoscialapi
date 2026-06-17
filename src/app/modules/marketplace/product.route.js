const { Router } = require("express");
const router = Router();
const auth = require("../../middleware/auth");
const productController = require("./product.controller");

router.post("/", auth.verifyToken, productController.createProduct);
router.get("/", auth.verifyToken, productController.getAllProducts);
router.get("/my", auth.verifyToken, productController.getSellerProducts);
router.get("/:id", auth.verifyToken, productController.getProduct);
router.put("/:id", auth.verifyToken, productController.updateProduct);
router.delete("/:id", auth.verifyToken, productController.deleteProduct);

module.exports = router;
