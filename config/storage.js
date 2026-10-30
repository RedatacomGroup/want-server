const path = require("path");
const fs = require("fs");
const { v2: cloudinary } = require("cloudinary");

const provider = (process.env.STORAGE_PROVIDER || "local").trim().toLowerCase();
const publicApiUrl = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, "");
const localRoot = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || "uploads");
const maxImageBytes = Number.parseInt(process.env.MAX_IMAGE_BYTES || `${8 * 1024 * 1024}`, 10);
const autoPublish = String(process.env.DESIRE_AUTO_PUBLISH || "true").toLowerCase() === "true";

if (!["local", "cloudinary"].includes(provider)) {
  throw new Error("STORAGE_PROVIDER must be local or cloudinary.");
}

if (!Number.isInteger(maxImageBytes) || maxImageBytes < 1024) {
  throw new Error("MAX_IMAGE_BYTES must be a valid integer greater than 1024.");
}

if (provider === "cloudinary") {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error(
      "CLOUDINARY_URL is required when STORAGE_PROVIDER=cloudinary."
    );
  }

  cloudinary.config({
    secure: true,
  });

  const cloudinaryConfig =
    cloudinary.config();

  if (
    !cloudinaryConfig.cloud_name ||
    !cloudinaryConfig.api_key ||
    !cloudinaryConfig.api_secret
  ) {
    throw new Error(
      "Cloudinary configuration is incomplete. Check CLOUDINARY_URL."
    );
  }
} else {
  fs.mkdirSync(
    path.join(
      localRoot,
      "desires"
    ),
    {
      recursive: true,
    }
  );
}

module.exports = Object.freeze({
  provider,
  publicApiUrl,
  localRoot,
  maxImageBytes,
  autoPublish,
  cloudinary
});
