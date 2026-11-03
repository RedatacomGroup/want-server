const socialService = require("../services/socialService");

const searchUsers = async (req, res) =>
  res.json({
    success: true,
    people: await socialService.searchUsers(req.user.id, req.query),
    requestId: req.requestId,
  });

const listPins = async (req, res) =>
  res.json({
    success: true,
    people: await socialService.listPins(req.user.id, req.query),
    requestId: req.requestId,
  });

const getPinStatus = async (req, res) =>
  res.json({
    success: true,
    pin: await socialService.getPinStatus(req.user.id, req.params.userId),
    requestId: req.requestId,
  });

const pinUser = async (req, res) =>
  res.status(201).json({
    success: true,
    pin: await socialService.pinUser(req.user.id, req.params.userId),
    requestId: req.requestId,
  });

const unpinUser = async (req, res) =>
  res.json({
    success: true,
    pin: await socialService.unpinUser(req.user.id, req.params.userId),
    requestId: req.requestId,
  });

module.exports = {
  searchUsers,
  listPins,
  getPinStatus,
  pinUser,
  unpinUser,
};
