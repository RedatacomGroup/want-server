const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");
const storageConfig = require("../config/storage");

const extensionByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

const uploadToCloudinary = (file, ownerId) =>
  new Promise((resolve, reject) => {
    const publicId = `${ownerId}-${crypto.randomUUID()}`;
    const stream = storageConfig.cloudinary.uploader.upload_stream(
      {
        folder: "want/desires",
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ quality: "auto", fetch_format: "auto" }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          provider: "cloudinary",
          storageKey: result.public_id,
          url: result.secure_url,
          thumbnailUrl: storageConfig.cloudinary.url(result.public_id, {
            secure: true,
            width: 720,
            height: 900,
            crop: "fill",
            gravity: "auto",
            quality: "auto",
            fetch_format: "auto"
          }),
          mimeType: file.mimetype,
          width: result.width || null,
          height: result.height || null,
          bytes: result.bytes || file.size
        });
      }
    );
    stream.end(file.buffer);
  });

const uploadToLocal = async (file, ownerId) => {
  const extension = extensionByMime[file.mimetype] || ".bin";
  const fileName = `${ownerId}-${crypto.randomUUID()}${extension}`;
  const relativeKey = path.posix.join("desires", fileName);
  const absolutePath = path.join(storageConfig.localRoot, "desires", fileName);
  await fs.writeFile(absolutePath, file.buffer, { flag: "wx" });

  return {
    provider: "local",
    storageKey: relativeKey,
    url: `${storageConfig.publicApiUrl}/uploads/${relativeKey}`,
    thumbnailUrl: null,
    mimeType: file.mimetype,
    width: null,
    height: null,
    bytes: file.size
  };
};

const uploadDesireImage = async (file, ownerId) => {
  if (!file?.buffer) throw new Error("An uploaded image buffer is required.");
  return storageConfig.provider === "cloudinary"
    ? uploadToCloudinary(file, ownerId)
    : uploadToLocal(file, ownerId);
};

const deleteStoredAsset = async (asset) => {
  if (!asset?.storageKey) return;
  if (asset.provider === "cloudinary" || storageConfig.provider === "cloudinary") {
    await storageConfig.cloudinary.uploader.destroy(asset.storageKey, { resource_type: "image" });
    return;
  }
  const absolutePath = path.resolve(storageConfig.localRoot, asset.storageKey);
  if (!absolutePath.startsWith(storageConfig.localRoot)) return;
  await fs.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
};

module.exports = {
  uploadDesireImage,
  deleteStoredAsset
};
