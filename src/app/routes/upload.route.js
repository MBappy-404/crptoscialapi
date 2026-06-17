const { Router } = require("express");
const multer = require("multer");
const cloudinary = require("../../config/cloudinary");
const auth = require("../middleware/auth");
const catchAsync = require("../../utils/catchAsync");
const { httpResponse } = require("../../utils/httpResponse");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = Router();

router.use(auth.verifyToken);

router.post(
  "/image",
  upload.single("file"),
  catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(httpResponse("error", null, "No file provided"));
    }
    const folder = req.body.folder || "facebook-clone";
    const b64 = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: "image",
    });
    res.status(200).json(
      httpResponse("success", { url: result.secure_url, publicId: result.public_id }, "Image uploaded")
    );
  })
);

router.post(
  "/video",
  upload.single("file"),
  catchAsync(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(httpResponse("error", null, "No file provided"));
    }
    const folder = req.body.folder || "facebook-clone";
    const b64 = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: "video",
    });
    res.status(200).json(
      httpResponse("success", { url: result.secure_url, publicId: result.public_id }, "Video uploaded")
    );
  })
);

router.post(
  "/delete",
  catchAsync(async (req, res) => {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json(httpResponse("error", null, "Public ID required"));
    }
    const result = await cloudinary.uploader.destroy(publicId);
    res.status(200).json(httpResponse("success", result, "Deleted from Cloudinary"));
  })
);

module.exports = router;
