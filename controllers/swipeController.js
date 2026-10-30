const swipeService = require("../services/swipeService");

const swipe = async (req, res) => {
  const result = await swipeService.swipe(req.user.id, req.body || {});
  res.json({ success: true, ...result, requestId: req.requestId });
};
const history = async (req, res) => {
  const items = await swipeService.getHistory(req.user.id, req.query);
  res.json({ success: true, items, requestId: req.requestId });
};
const wants = async (req, res) => {
  const items = await swipeService.getMyWants(req.user.id, req.query);
  res.json({ success: true, items, requestId: req.requestId });
};

module.exports = { swipe, history, wants };
