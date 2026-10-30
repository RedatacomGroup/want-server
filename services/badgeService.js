const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const mapBadge = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  iconKey: row.icon_key,
  iconUrl: row.icon_url,
  rarity: row.rarity,
  ruleType: row.rule_type,
  ruleConfig: row.rule_config || {},
  sortOrder: Number(row.sort_order || 0),
  earned: Boolean(row.user_badge_id),
  userBadgeId: row.user_badge_id || null,
  awardedAt: row.awarded_at || null,
  awardReason: row.award_reason || null,
  revokedAt: row.revoked_at || null,
  equipped: Boolean(row.equipped),
  progress: row.progress === null || row.progress === undefined ? null : Number(row.progress),
  target: row.target_value === null || row.target_value === undefined ? null : Number(row.target_value),
  current: row.current_value === null || row.current_value === undefined ? null : Number(row.current_value)
});

const getCatalog = async (userId = null) => {
  const result = await db.query(
    `SELECT
       b.id,b.code,b.name,b.description,b.icon_key,b.icon_url,b.rarity,
       b.rule_type,b.rule_config,b.sort_order,
       ub.id AS user_badge_id,ub.awarded_at,ub.award_reason,ub.revoked_at,
       CASE WHEN eb.user_badge_id=ub.id THEN true ELSE false END AS equipped,
       bp.current_value,bp.target_value,
       CASE
         WHEN b.rule_type='threshold' AND (b.rule_config->>'threshold') IS NOT NULL THEN
           LEAST(100,
             100 *
             CASE b.rule_config->>'metric'
               WHEN 'desires_posted' THEN COALESCE(us.desires_posted,0)::numeric
               WHEN 'total_wants_generated' THEN COALESCE(us.total_wants_generated,0)::numeric
               ELSE COALESCE(bp.current_value,0)
             END /
             NULLIF((b.rule_config->>'threshold')::numeric,0)
           )
         WHEN ub.id IS NOT NULL THEN 100
         ELSE COALESCE(bp.current_value,0)
       END AS progress
     FROM wants.badges b
     LEFT JOIN wants.user_badges ub
       ON ub.badge_id=b.id AND ub.user_id=$1 AND ub.revoked_at IS NULL
     LEFT JOIN wants.user_equipped_badges eb
       ON eb.user_id=$1 AND eb.user_badge_id=ub.id
     LEFT JOIN wants.badge_progress bp
       ON bp.user_id=$1 AND bp.badge_id=b.id
     LEFT JOIN wants.user_stats us ON us.user_id=$1
     WHERE b.is_active=true
     ORDER BY b.sort_order ASC,b.name ASC`,
    [userId]
  );
  return result.rows.map(mapBadge);
};

const getMine = async (userId) => {
  const badges = await getCatalog(userId);
  return {
    equipped: badges.find((badge) => badge.equipped) || null,
    earned: badges.filter((badge) => badge.earned),
    locked: badges.filter((badge) => !badge.earned)
  };
};

const getPublicBadges = async (username) => {
  const user = await db.query(
    `SELECT user_id,username FROM wants.v_public_profiles WHERE lower(username)=lower($1) LIMIT 1`,
    [String(username || "").trim()]
  );
  if (!user.rows[0]) throw new AppError("Public profile was not found.",404,"PUBLIC_PROFILE_NOT_FOUND");
  const result = await db.query(
    `SELECT
       b.id,b.code,b.name,b.description,b.icon_key,b.icon_url,b.rarity,b.rule_type,
       b.rule_config,b.sort_order,ub.id AS user_badge_id,ub.awarded_at,
       ub.award_reason,ub.revoked_at,
       CASE WHEN eb.user_badge_id=ub.id THEN true ELSE false END AS equipped,
       NULL::numeric AS current_value,NULL::numeric AS target_value,100::numeric AS progress
     FROM wants.user_badges ub
     JOIN wants.badges b ON b.id=ub.badge_id AND b.is_active=true
     LEFT JOIN wants.user_equipped_badges eb ON eb.user_id=ub.user_id AND eb.user_badge_id=ub.id
     WHERE ub.user_id=$1 AND ub.revoked_at IS NULL
     ORDER BY equipped DESC,ub.awarded_at DESC,b.sort_order ASC`,
    [user.rows[0].user_id]
  );
  return { username:user.rows[0].username, items:result.rows.map(mapBadge) };
};

const refreshThresholdBadges = async (userId) => {
  const result = await db.query(`SELECT wants.award_threshold_badges($1)::integer AS awarded`,[userId]);
  return { awarded:Number(result.rows[0]?.awarded || 0), ...(await getMine(userId)) };
};

const equipBadge = async (userId, code) => db.withTransaction(async (client) => {
  const normalized=String(code || "").trim().toUpperCase();
  const result=await client.query(
    `SELECT ub.id,b.code,b.name,b.description,b.icon_key,b.icon_url,b.rarity
     FROM wants.user_badges ub
     JOIN wants.badges b ON b.id=ub.badge_id
     WHERE ub.user_id=$1 AND b.code=$2 AND ub.revoked_at IS NULL AND b.is_active=true
     LIMIT 1`,[userId,normalized]
  );
  const row=result.rows[0];
  if(!row) throw new AppError("You have not earned this badge.",409,"BADGE_NOT_EARNED");
  await client.query(
    `INSERT INTO wants.user_equipped_badges(user_id,user_badge_id,equipped_at)
     VALUES($1,$2,now())
     ON CONFLICT(user_id) DO UPDATE SET user_badge_id=EXCLUDED.user_badge_id,equipped_at=now()`,
    [userId,row.id]
  );
  return { id:row.id,code:row.code,name:row.name,description:row.description,iconKey:row.icon_key,iconUrl:row.icon_url,rarity:row.rarity,equipped:true };
});

const unequipBadge = async (userId) => {
  const result=await db.query(`DELETE FROM wants.user_equipped_badges WHERE user_id=$1 RETURNING user_badge_id`,[userId]);
  return { unequipped:result.rowCount>0 };
};

const awardComputedBadge = async ({ userId, code, reason, metadata = {} }) => db.withTransaction(async (client) => {
  const badge=await client.query(
    `SELECT id,code,name,rule_type FROM wants.badges WHERE code=$1 AND is_active=true LIMIT 1`,
    [String(code || "").trim().toUpperCase()]
  );
  if(!badge.rows[0]) throw new AppError("Badge was not found.",404,"BADGE_NOT_FOUND");
  if(!["computed","ranking","manual"].includes(badge.rows[0].rule_type)) {
    throw new AppError("This badge is awarded by threshold rules.",409,"BADGE_RULE_MISMATCH");
  }
  const inserted=await client.query(
    `INSERT INTO wants.user_badges(user_id,badge_id,award_reason,metadata)
     VALUES($1,$2,$3,$4::jsonb)
     ON CONFLICT(user_id,badge_id) DO NOTHING
     RETURNING id`,
    [userId,badge.rows[0].id,reason || "Achievement unlocked",JSON.stringify(metadata)]
  );
  if(inserted.rowCount>0){
    await client.query(
      `INSERT INTO wants.notifications(user_id,type,title,body,data)
       VALUES($1,'badge_unlocked','Badge unlocked',$2,$3::jsonb)`,
      [userId,badge.rows[0].name,JSON.stringify({badgeId:badge.rows[0].id,code:badge.rows[0].code})]
    );
  }
  return { awarded:inserted.rowCount>0, code:badge.rows[0].code, name:badge.rows[0].name };
});

module.exports={getCatalog,getMine,getPublicBadges,refreshThresholdBadges,equipBadge,unequipBadge,awardComputedBadge};
