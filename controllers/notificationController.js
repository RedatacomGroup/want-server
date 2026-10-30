const notificationService = require("../services/notificationService");

const list = async (req, res) => {
  const notifications = await notificationService.listNotifications(req.user.id, req.query);
  res.json({ success: true, notifications, requestId: req.requestId });
};

const unreadCount = async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user.id);
  res.json({ success: true, unreadCount, requestId: req.requestId });
};

const markRead = async (req, res) => {
  const notification = await notificationService.markRead(req.user.id, req.params.notificationId);
  res.json({ success: true, notification, requestId: req.requestId });
};

const markUnread = async (req, res) => {
  const notification = await notificationService.markUnread(req.user.id, req.params.notificationId);
  res.json({ success: true, notification, requestId: req.requestId });
};

const markAllRead = async (req, res) => {
  const result = await notificationService.markAllRead(req.user.id);
  res.json({ success: true, ...result, requestId: req.requestId });
};

const remove = async (req, res) => {
  const result = await notificationService.deleteNotification(req.user.id, req.params.notificationId);
  res.json({ success: true, ...result, requestId: req.requestId });
};

const getPreferences = async (req, res) => {
  const preferences = await notificationService.getPreferences(req.user.id);
  res.json({ success: true, preferences, requestId: req.requestId });
};

const updatePreferences = async (req, res) => {
  const preferences = await notificationService.updatePreferences(req.user.id, req.body || {});
  res.json({ success: true, preferences, requestId: req.requestId });
};

module.exports = {
  list,
  unreadCount,
  markRead,
  markUnread,
  markAllRead,
  remove,
  getPreferences,
  updatePreferences,
};
