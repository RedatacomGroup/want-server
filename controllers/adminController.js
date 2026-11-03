const moderationService = require("../services/moderationService");

const paging = (req) => ({
  limit: Math.min(Math.max(Number(req.query.limit) || 50, 1), 100),
  offset: Math.max(Number(req.query.offset) || 0, 0),
});

const reports = async (req, res) => {
  const items = await moderationService.listReports({
    status: req.query.status || "open",
    ...paging(req),
  });
  res.json({ success: true, items, requestId: req.requestId });
};

const decideReport = async (req, res) => {
  const report = await moderationService.decideReport(
    req.user.id,
    req.params.reportId,
    req.body,
  );
  res.json({ success: true, report, requestId: req.requestId });
};

const desires = async (req, res) => {
  const items = await moderationService.listDesires(paging(req));
  res.json({ success: true, items, requestId: req.requestId });
};

const moderateDesire = async (req, res) => {
  const desire = await moderationService.moderateDesire(
    req.user.id,
    req.params.desireId,
    req.body,
  );
  res.json({ success: true, desire, requestId: req.requestId });
};

const users = async (req, res) => {
  const items = await moderationService.listUsers(paging(req));
  res.json({ success: true, items, requestId: req.requestId });
};

const enforceUser = async (req, res) => {
  const user = await moderationService.enforceUser(
    req.user.id,
    req.params.userId,
    req.body,
  );
  res.json({ success: true, user, requestId: req.requestId });
};

module.exports = {
  reports,
  decideReport,
  desires,
  moderateDesire,
  users,
  enforceUser,
};
