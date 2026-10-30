const feedService = require("../services/feedService");

const home = async (req, res) => {
  const feed = await feedService.getFeed(req.user.id, req.query);
  res.json({ success: true, feed, requestId: req.requestId });
};
const fresh = async (req, res) => {
  const feed = await feedService.getFreshFeed(req.user.id, req.query);
  res.json({ success: true, feed, requestId: req.requestId });
};
const local = async (req, res) => {
  const feed = await feedService.getLocalFeed(req.user.id, req.query);
  res.json({ success: true, feed, requestId: req.requestId });
};
const category = async (req, res) => {
  const feed = await feedService.getFeed(req.user.id, { ...req.query, category: req.params.slug, surface: "category" });
  res.json({ success: true, feed, requestId: req.requestId });
};

module.exports = { home, fresh, local, category };
