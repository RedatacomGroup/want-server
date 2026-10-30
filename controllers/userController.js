const userService = require("../services/userService");

const getMe = async (req, res) => res.json({ success: true, user: await userService.getMe(req.user.id), requestId: req.requestId });
const updateMe = async (req, res) => res.json({ success: true, user: await userService.updateMe(req.user.id, req.body || {}), requestId: req.requestId });
const updateInterests = async (req, res) => res.json({ success: true, interests: await userService.replaceInterests(req.user.id, req.body?.interests), requestId: req.requestId });
const updateColors = async (req, res) => res.json({ success: true, colors: await userService.replaceColors(req.user.id, req.body?.colors), requestId: req.requestId });
const completeOnboarding = async (req, res) => res.json({ success: true, user: await userService.completeOnboarding(req.user.id, req.body || {}), requestId: req.requestId });
const getPublicProfile = async (req, res) => res.json({ success: true, profile: await userService.getPublicProfile(req.params.username), requestId: req.requestId });
const getPublicDesires = async (req, res) => res.json({ success: true, desires: await userService.getUserDesires(req.params.username, req.query), requestId: req.requestId });
const getPublicStats = async (req, res) => res.json({ success: true, stats: await userService.getUserStats(req.params.username), requestId: req.requestId });
const getAvailableInterests = async (req, res) => res.json({ success: true, interests: await userService.getAvailableInterests(), requestId: req.requestId });

module.exports = { getMe, updateMe, updateInterests, updateColors, completeOnboarding, getPublicProfile, getPublicDesires, getPublicStats, getAvailableInterests };
