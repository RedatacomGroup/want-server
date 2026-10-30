const multer = require("multer");
const storageConfig = require("../config/storage");
const { AppError } = require("./errorMiddleware");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: storageConfig.maxImageBytes,
    fields: 20,
    fieldSize: 1024 * 1024
  },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new AppError(
          "Only JPEG, PNG, WebP, or GIF images are accepted.",
          400,
          "UNSUPPORTED_IMAGE_TYPE"
        )
      );
    }
    callback(null, true);
  }
});

const singleDesireImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            `Image exceeds the ${Math.round(storageConfig.maxImageBytes / 1024 / 1024)} MB limit.`,
            400,
            "IMAGE_TOO_LARGE"
          )
        );
      }
      return next(new AppError(error.message, 400, `UPLOAD_${error.code}`));
    }

    return next(error);
  });
};

module.exports = {
  singleDesireImage,
  allowedMimeTypes
};
