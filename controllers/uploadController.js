const storageConfig = require("../config/storage");

const getUploadConfiguration = async (req, res) => {
  res.json({
    success: true,
    upload: {
      provider: storageConfig.provider,
      fieldName: "image",
      maxImageBytes: storageConfig.maxImageBytes,
      acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      endpoint: `${req.protocol}://${req.get("host")}/api/desires`,
      method: "POST",
      contentType: "multipart/form-data"
    },
    requestId: req.requestId
  });
};

module.exports = { getUploadConfiguration };
