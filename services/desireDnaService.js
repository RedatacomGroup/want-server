const db = require("../config/db");
const { AppError } = require("../middleware/errorMiddleware");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value, places = 2) => Number(Number(value || 0).toFixed(places));

const getUser = async ({ userId = null, username = null }) => {
  const result = userId
    ? await db.query(
        `SELECT u.id,u.username,p.display_name,p.profile_image_url,p.country_code,
                p.favorite_colors,p.profile_visibility,p.onboarding_completed_at
         FROM wants.users u JOIN wants.user_profiles p ON p.user_id=u.id
         WHERE u.id=$1 AND u.status='active' AND u.deleted_at IS NULL LIMIT 1`,
        [userId]
      )
    : await db.query(
        `SELECT u.id,u.username,p.display_name,p.profile_image_url,p.country_code,
                p.favorite_colors,p.profile_visibility,p.onboarding_completed_at
         FROM wants.users u JOIN wants.user_profiles p ON p.user_id=u.id
         WHERE lower(u.username)=lower($1) AND u.status='active' AND u.deleted_at IS NULL LIMIT 1`,
        [String(username || "").trim()]
      );
  if (!result.rows[0]) throw new AppError("User was not found.",404,"USER_NOT_FOUND");
  return result.rows[0];
};

const getCategorySignals = async (userId) => {
  const result = await db.query(
    `WITH declared AS (
       SELECT i.category_id,MAX(ui.weight)::numeric AS declared_weight
       FROM wants.user_interests ui
       JOIN wants.interests i ON i.id=ui.interest_id
       WHERE ui.user_id=$1 AND i.category_id IS NOT NULL
       GROUP BY i.category_id
     ), behavior AS (
       SELECT d.category_id,
              count(*)::integer AS decisions,
              count(*) FILTER (WHERE s.decision='want')::integer AS wants,
              count(*) FILTER (WHERE s.decision='pass')::integer AS passes
       FROM wants.swipes s JOIN wants.desires d ON d.id=s.desire_id
       WHERE s.user_id=$1 AND d.deleted_at IS NULL
       GROUP BY d.category_id
     ), combined AS (
       SELECT c.id,c.slug,c.name,c.icon_key,
              COALESCE(d.declared_weight,0)::numeric AS declared_weight,
              COALESCE(b.decisions,0)::integer AS decisions,
              COALESCE(b.wants,0)::integer AS wants,
              COALESCE(b.passes,0)::integer AS passes,
              (COALESCE(d.declared_weight,0)*1.5 + COALESCE(b.wants,0)*3.0 + COALESCE(b.passes,0)*0.25)::numeric AS raw_score
       FROM wants.categories c
       LEFT JOIN declared d ON d.category_id=c.id
       LEFT JOIN behavior b ON b.category_id=c.id
       WHERE c.is_active=true AND (d.category_id IS NOT NULL OR b.category_id IS NOT NULL)
     )
     SELECT *,CASE WHEN sum(raw_score) OVER()=0 THEN 0
                   ELSE round(raw_score*100/sum(raw_score) OVER(),2) END AS percentage
     FROM combined
     ORDER BY raw_score DESC,name ASC`,
    [userId]
  );
  return result.rows.map((row,index)=>({
    rank:index+1,
    id:row.id,
    slug:row.slug,
    name:row.name,
    iconKey:row.icon_key,
    percentage:Number(row.percentage || 0),
    score:round(row.raw_score),
    declaredWeight:round(row.declared_weight),
    decisions:Number(row.decisions),
    wants:Number(row.wants),
    passes:Number(row.passes),
    wantRate:Number(row.decisions) ? round(Number(row.wants)/Number(row.decisions),4) : null
  }));
};

const getCreatorSignals = async (userId) => {
  const result=await db.query(
    `SELECT owner.id AS user_id,owner.username,p.display_name,p.profile_image_url,
            count(*)::integer AS wanted_count
     FROM wants.swipes s
     JOIN wants.desires d ON d.id=s.desire_id
     JOIN wants.users owner ON owner.id=d.user_id
     JOIN wants.user_profiles p ON p.user_id=owner.id
     WHERE s.user_id=$1 AND s.decision='want' AND d.deleted_at IS NULL
     GROUP BY owner.id,owner.username,p.display_name,p.profile_image_url
     ORDER BY wanted_count DESC,owner.username ASC LIMIT 10`,[userId]
  );
  return result.rows.map((row)=>({userId:row.user_id,username:row.username,displayName:row.display_name,profileImageUrl:row.profile_image_url,wantedCount:Number(row.wanted_count)}));
};

const getBehavior = async (userId) => {
  const result=await db.query(
    `SELECT
       count(*)::integer AS total_decisions,
       count(*) FILTER(WHERE decision='want')::integer AS wants,
       count(*) FILTER(WHERE decision='pass')::integer AS passes,
       count(DISTINCT d.category_id)::integer AS category_breadth,
       count(DISTINCT d.user_id)::integer AS creator_breadth,
       min(s.created_at) AS first_decision_at,
       max(s.updated_at) AS last_decision_at
     FROM wants.swipes s JOIN wants.desires d ON d.id=s.desire_id
     WHERE s.user_id=$1`,[userId]
  );
  const row=result.rows[0];
  const total=Number(row.total_decisions || 0);
  const wants=Number(row.wants || 0);
  const categoryBreadth=Number(row.category_breadth || 0);
  const creatorBreadth=Number(row.creator_breadth || 0);
  const diversityScore=round(clamp(((categoryBreadth/17)*60)+((creatorBreadth/20)*40),0,100));
  const confidenceScore=round(clamp((total/50)*100,0,100));
  return {
    totalDecisions:total,wants,passes:Number(row.passes || 0),
    wantRate:total ? round(wants/total,4) : null,
    categoryBreadth,creatorBreadth,diversityScore,confidenceScore,
    firstDecisionAt:row.first_decision_at,lastDecisionAt:row.last_decision_at
  };
};

const buildSummary = ({categories,behavior,colors}) => {
  if (!behavior.totalDecisions) return "Your Desire DNA is forming. Keep choosing WANT or PASS to sharpen it.";
  const top=categories.slice(0,3).map((item)=>item.name);
  const taste=top.length ? top.join(", ") : "emerging categories";
  const selectivity=behavior.wantRate === null ? "still emerging" : behavior.wantRate < 0.35 ? "highly selective" : behavior.wantRate < 0.65 ? "balanced" : "want-forward";
  const colorText=colors.length ? ` Your colour signals lean toward ${colors.slice(0,3).join(", ")}.` : "";
  return `A ${selectivity} taste profile led by ${taste}.${colorText}`;
};

const getDnaByUser = async (user) => {
  const [categories,creators,behavior]=await Promise.all([
    getCategorySignals(user.id),getCreatorSignals(user.id),getBehavior(user.id)
  ]);
  const colors=Array.isArray(user.favorite_colors) ? user.favorite_colors : [];
  return {
    user:{userId:user.id,username:user.username,displayName:user.display_name,profileImageUrl:user.profile_image_url,countryCode:user.country_code},
    summary:buildSummary({categories,behavior,colors}),
    confidence:{score:behavior.confidenceScore,label:behavior.totalDecisions>=50?"strong":behavior.totalDecisions>=15?"developing":"early",decisions:behavior.totalDecisions,nextStrongSignalAt:Math.max(0,50-behavior.totalDecisions)},
    categories,
    colors,
    behavior,
    topCreators:creators,
    generatedAt:new Date().toISOString()
  };
};

const getMine=async(userId)=>getDnaByUser(await getUser({userId}));
const getPublic=async(username)=>{
  const user=await getUser({username});
  if(user.profile_visibility!=="public") throw new AppError("Desire DNA is private.",403,"DESIRE_DNA_PRIVATE");
  return getDnaByUser(user);
};

module.exports={getMine,getPublic};
