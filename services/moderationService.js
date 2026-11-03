const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const createReport = async (reporterUserId, input) => {
  if (input.desireId) {
    const found = await db.query(
      `SELECT id, user_id FROM wants.desires WHERE id=$1 LIMIT 1`,
      [input.desireId],
    );
    if (!found.rows[0]) throw new AppError("Desire was not found.", 404, "DESIRE_NOT_FOUND");
    if (found.rows[0].user_id === reporterUserId) {
      throw new AppError("You cannot report your own desire.", 409, "SELF_REPORT_NOT_ALLOWED");
    }
  }
  if (input.reportedUserId === reporterUserId) {
    throw new AppError("You cannot report yourself.", 409, "SELF_REPORT_NOT_ALLOWED");
  }
  try {
    const result = await db.query(
      `INSERT INTO wants.moderation_reports
         (reporter_user_id, desire_id, reported_user_id, reason, details)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, reason, status, created_at`,
      [reporterUserId, input.desireId || null, input.reportedUserId || null, input.reason, input.details || null],
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      throw new AppError("An open report already exists for this target and reason.", 409, "REPORT_ALREADY_EXISTS");
    }
    throw error;
  }
};

const listReports = async ({ status = "open", limit = 50, offset = 0 }) => {
  const result = await db.query(
    `SELECT r.id,r.reason,r.details,r.status,r.resolution,r.created_at,r.updated_at,
            ru.id reporter_id,ru.username reporter_username,
            d.id desire_id,d.title desire_title,d.deleted_at desire_deleted_at,
            COALESCE(tu.id,du.id) reported_user_id,
            COALESCE(tu.username,du.username) reported_username,
            COALESCE(tu.status,du.status) reported_user_status,
            au.username assigned_admin_username
     FROM wants.moderation_reports r
     JOIN wants.users ru ON ru.id=r.reporter_user_id
     LEFT JOIN wants.desires d ON d.id=r.desire_id
     LEFT JOIN wants.users du ON du.id=d.user_id
     LEFT JOIN wants.users tu ON tu.id=r.reported_user_id
     LEFT JOIN wants.users au ON au.id=r.assigned_admin_id
     WHERE ($1::text='all' OR r.status=$1)
     ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
              r.created_at ASC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );
  return result.rows;
};

const decideReport = async (adminUserId, reportId, input) => db.withTransaction(async (client) => {
  const result = await client.query(
    `UPDATE wants.moderation_reports
     SET status=$1,resolution=$2,assigned_admin_id=$3,
         resolved_by=CASE WHEN $1 IN ('resolved','dismissed') THEN $3 ELSE resolved_by END,
         resolved_at=CASE WHEN $1 IN ('resolved','dismissed') THEN now() ELSE resolved_at END,
         updated_at=now()
     WHERE id=$4
     RETURNING *`,
    [input.status, input.resolution || null, adminUserId, reportId],
  );
  if (!result.rows[0]) throw new AppError("Report was not found.", 404, "REPORT_NOT_FOUND");
  await client.query(
    `INSERT INTO wants.moderation_actions
       (moderator_user_id,target_type,target_id,action,reason,metadata)
     VALUES ($1,'report',$2,$3,$4,$5::jsonb)`,
    [
      adminUserId,
      reportId,
      input.status === "dismissed"
        ? "reject"
        : input.status === "resolved"
          ? "approve"
          : "warn",
      input.resolution || null,
      JSON.stringify({ reportId, reportStatus: input.status }),
    ],
  );
  return result.rows[0];
});

const listDesires = async ({ limit = 50, offset = 0 }) => {
  const result = await db.query(
    `SELECT d.id,d.title,d.status,d.deleted_at,d.created_at,u.username,u.status AS user_status,
            count(r.id)::int AS report_count
     FROM wants.desires d
     JOIN wants.users u ON u.id=d.user_id
     LEFT JOIN wants.moderation_reports r
       ON r.desire_id=d.id AND r.status IN ('open','reviewing')
     GROUP BY d.id,u.username,u.status
     ORDER BY report_count DESC,d.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
};

const moderateDesire = async (adminUserId, desireId, input) => db.withTransaction(async (client) => {
  const remove = input.action === "remove";
  const result = await client.query(
    `UPDATE wants.desires
     SET deleted_at=CASE WHEN $1 THEN COALESCE(deleted_at,now()) ELSE NULL END,
         updated_at=now()
     WHERE id=$2
     RETURNING id,title,status,deleted_at,updated_at`,
    [remove, desireId],
  );
  if (!result.rows[0]) throw new AppError("Desire was not found.", 404, "DESIRE_NOT_FOUND");
  await client.query(
    `INSERT INTO wants.moderation_actions
       (moderator_user_id,target_type,target_id,action,reason,metadata)
     VALUES ($1,'desire',$2,$3,$4,$5::jsonb)`,
    [
      adminUserId,
      desireId,
      remove ? "remove" : "restore",
      input.reason,
      JSON.stringify({ desireId, removed: remove }),
    ],
  );
  return result.rows[0];
});

const listUsers = async ({ limit = 50, offset = 0 }) => {
  const result = await db.query(
    `SELECT u.id,u.username,u.email,u.status,u.created_at,u.last_login_at,
            p.display_name,p.profile_image_url,p.country_code,
            count(DISTINCT d.id)::int AS desires_posted,
            count(DISTINCT r.id) FILTER (WHERE r.status IN ('open','reviewing'))::int AS open_report_count,
            a.role AS admin_role,
            latest.action AS latest_moderation_action,
            latest.reason AS latest_moderation_reason,
            latest.created_at AS latest_moderation_at
     FROM wants.users u
     LEFT JOIN wants.user_profiles p ON p.user_id=u.id
     LEFT JOIN wants.desires d ON d.user_id=u.id
     LEFT JOIN wants.moderation_reports r
       ON (r.reported_user_id=u.id OR r.desire_id=d.id)
     LEFT JOIN wants.admin_users a ON a.user_id=u.id AND a.revoked_at IS NULL
     LEFT JOIN LATERAL (
       SELECT ma.action,ma.reason,ma.created_at
       FROM wants.moderation_actions ma
       WHERE ma.target_type='user' AND ma.target_id=u.id
       ORDER BY ma.created_at DESC
       LIMIT 1
     ) latest ON true
     GROUP BY u.id,p.display_name,p.profile_image_url,p.country_code,a.role,
              latest.action,latest.reason,latest.created_at
     ORDER BY open_report_count DESC,u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows;
};

const enforceUser = async (adminUserId, targetUserId, input) => db.withTransaction(async (client) => {
  if (adminUserId === targetUserId) {
    throw new AppError("You cannot moderate your own administrator account.", 409, "ADMIN_SELF_ACTION_BLOCKED");
  }

  const targetResult = await client.query(
    `SELECT u.id,u.username,u.email,u.status,a.role AS admin_role
     FROM wants.users u
     LEFT JOIN wants.admin_users a ON a.user_id=u.id AND a.revoked_at IS NULL
     WHERE u.id=$1 AND u.deleted_at IS NULL
     LIMIT 1
     FOR UPDATE OF u`,
    [targetUserId],
  );
  const target = targetResult.rows[0];
  if (!target) throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
  if (target.admin_role) {
    throw new AppError("Protected administrator accounts cannot be terminated here.", 403, "PROTECTED_ADMIN_ACCOUNT");
  }

  if (input.reportId) {
    const report = await client.query(
      `SELECT id,reported_user_id,desire_id
       FROM wants.moderation_reports
       WHERE id=$1
       LIMIT 1
       FOR UPDATE`,
      [input.reportId],
    );
    if (!report.rows[0]) throw new AppError("Report was not found.", 404, "REPORT_NOT_FOUND");
    if (report.rows[0].reported_user_id && report.rows[0].reported_user_id !== targetUserId) {
      throw new AppError("The report does not belong to this user.", 409, "REPORT_TARGET_MISMATCH");
    }
    if (report.rows[0].desire_id) {
      const owner = await client.query(`SELECT user_id FROM wants.desires WHERE id=$1`, [report.rows[0].desire_id]);
      if (owner.rows[0]?.user_id !== targetUserId) {
        throw new AppError("The reported desire does not belong to this user.", 409, "REPORT_TARGET_MISMATCH");
      }
    }
  }

  const terminate = input.action === "terminate";
  if (terminate && target.status === "suspended") {
    throw new AppError("This account is already terminated.", 409, "USER_ALREADY_TERMINATED");
  }
  if (!terminate && target.status === "active") {
    throw new AppError("This account is already active.", 409, "USER_ALREADY_ACTIVE");
  }

  const updated = await client.query(
    `UPDATE wants.users
     SET status=$2::wants.user_status,updated_at=now()
     WHERE id=$1
     RETURNING id,username,email,status,updated_at`,
    [targetUserId, terminate ? "suspended" : "active"],
  );

  if (terminate) {
    await client.query(
      `UPDATE wants.user_sessions
       SET revoked_at=COALESCE(revoked_at,now())
       WHERE user_id=$1`,
      [targetUserId],
    );
    await client.query(
      `UPDATE wants.desires
       SET deleted_at=COALESCE(deleted_at,now()),updated_at=now()
       WHERE user_id=$1 AND deleted_at IS NULL`,
      [targetUserId],
    );
    await client.query(
      `UPDATE wants.password_reset_codes
       SET used_at=COALESCE(used_at,now())
       WHERE user_id=$1 AND used_at IS NULL`,
      [targetUserId],
    ).catch((error) => {
      if (error.code !== "42P01") throw error;
    });
  }

  await client.query(
    `INSERT INTO wants.moderation_actions
       (moderator_user_id,target_type,target_id,action,reason,metadata)
     VALUES ($1,'user',$2,$3,$4,$5::jsonb)`,
    [
      adminUserId,
      targetUserId,
      terminate ? "suspend" : "unsuspend",
      input.reason,
      JSON.stringify({
        reportId: input.reportId || null,
        previousStatus: target.status,
        nextStatus: terminate ? "suspended" : "active",
      }),
    ],
  );

  if (input.reportId) {
    await client.query(
      `UPDATE wants.moderation_reports
       SET status='resolved',resolution=$2,assigned_admin_id=$3,
           resolved_by=$3,resolved_at=now(),updated_at=now()
       WHERE id=$1`,
      [input.reportId, input.reason, adminUserId],
    );
  }

  return {
    ...updated.rows[0],
    sessionsRevoked: terminate,
    contentRemoved: terminate,
  };
});

module.exports = {
  createReport,
  listReports,
  decideReport,
  listDesires,
  moderateDesire,
  listUsers,
  enforceUser,
};
