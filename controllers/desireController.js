const desireService = require("../services/desireService");

const create = async (req, res) => {
  const desire = await desireService.createDesire(req.user.id, req.body || {}, req.file);
  res.status(201).json({ success: true, desire, requestId: req.requestId });
};

const getOne = async (req, res) => {
  const desire = await desireService.getDesireById(req.params.desireId, {
    includeUnpublishedForUserId: req.user?.id || null
  });
  res.json({ success: true, desire, requestId: req.requestId });
};

const getMine = async (req, res) => {
  const desires = await desireService.getMyDesires(req.user.id, req.query);
  res.json({ success: true, desires, requestId: req.requestId });
};

const update = async (req, res) => {
  const desire = await desireService.updateDesire(req.user.id, req.params.desireId, req.body || {});
  res.json({ success: true, desire, requestId: req.requestId });
};

const remove = async (req, res) => {
  const result = await desireService.deleteDesire(req.user.id, req.params.desireId);
  res.json({ success: true, ...result, requestId: req.requestId });
};

module.exports = { create, getOne, getMine, update, remove };
