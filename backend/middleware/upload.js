const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

const uploadSingleImage = (req, res, next) => {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();

  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }

  return upload.single("image")(req, res, next);
};

module.exports = {
  upload,
  uploadSingleImage
};
