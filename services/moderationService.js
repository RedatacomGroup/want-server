const db=require("../config/db");
const {AppError}=require("../middleware/errorMiddleware");

const createReport=async(reporterUserId,input)=>{
  if(input.desireId){
    const found=await db.query(`SELECT id,user_id FROM wants.desires WHERE id=$1 LIMIT 1`,[input.desireId]);
    if(!found.rows[0]) throw new AppError("Desire was not found.",404,"DESIRE_NOT_FOUND");
    if(found.rows[0].user_id===reporterUserId) throw new AppError("You cannot report your own desire.",409,"SELF_REPORT_NOT_ALLOWED");
  }
  if(input.reportedUserId===reporterUserId) throw new AppError("You cannot report yourself.",409,"SELF_REPORT_NOT_ALLOWED");

  try{
    const result=await db.query(
      `INSERT INTO wants.moderation_reports(reporter_user_id,desire_id,reported_user_id,reason,details)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,reason,status,created_at`,
      [reporterUserId,input.desireId||null,input.reportedUserId||null,input.reason,input.details||null]
    );
    return result.rows[0];
  }catch(error){
    if(error.code==="23505") throw new AppError("An open report already exists for this target and reason.",409,"REPORT_ALREADY_EXISTS");
    throw error;
  }
};

const listReports=async({status="open",limit=50,offset=0})=>{
  const result=await db.query(
    `SELECT r.id,r.reason,r.details,r.status,r.resolution,r.created_at,r.updated_at,
            ru.id reporter_id,ru.username reporter_username,
            d.id desire_id,d.title desire_title,d.deleted_at desire_deleted_at,
            tu.id reported_user_id,tu.username reported_username,
            au.username assigned_admin_username
     FROM wants.moderation_reports r
     JOIN wants.users ru ON ru.id=r.reporter_user_id
     LEFT JOIN wants.desires d ON d.id=r.desire_id
     LEFT JOIN wants.users tu ON tu.id=r.reported_user_id
     LEFT JOIN wants.users au ON au.id=r.assigned_admin_id
     WHERE ($1::text='all' OR r.status=$1)
     ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.created_at ASC
     LIMIT $2 OFFSET $3`,[status,limit,offset]
  );
  return result.rows;
};

const decideReport=async(adminUserId,reportId,input)=>{
  const client=await db.pool.connect();
  try{
    await client.query("BEGIN");
    const result=await client.query(
      `UPDATE wants.moderation_reports
       SET status=$1,resolution=$2,assigned_admin_id=$3,
           resolved_by=CASE WHEN $1 IN ('resolved','dismissed') THEN $3 ELSE resolved_by END,
           resolved_at=CASE WHEN $1 IN ('resolved','dismissed') THEN now() ELSE resolved_at END,
           updated_at=now()
       WHERE id=$4 RETURNING *`,[input.status,input.resolution||null,adminUserId,reportId]
    );
    if(!result.rows[0]) throw new AppError("Report was not found.",404,"REPORT_NOT_FOUND");
    await client.query(
      `INSERT INTO wants.moderation_actions(admin_user_id,report_id,target_type,target_id,action,reason)
       VALUES($1,$2,'report',$2,$3,$4)`,
      [adminUserId,reportId,input.status==="dismissed"?"dismiss":input.status==="resolved"?"resolve":"review",input.resolution||null]
    );
    await client.query("COMMIT");
    return result.rows[0];
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
};

const listDesires=async({limit=50,offset=0})=>{
  const result=await db.query(
    `SELECT d.id,d.title,d.status,d.deleted_at,d.created_at,u.username,
            count(r.id)::int AS report_count
     FROM wants.desires d JOIN wants.users u ON u.id=d.user_id
     LEFT JOIN wants.moderation_reports r ON r.desire_id=d.id AND r.status IN ('open','reviewing')
     GROUP BY d.id,u.username
     ORDER BY report_count DESC,d.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]
  );
  return result.rows;
};

const moderateDesire=async(adminUserId,desireId,input)=>{
  const remove=input.action==="remove";
  const result=await db.query(
    `UPDATE wants.desires SET deleted_at=CASE WHEN $1 THEN COALESCE(deleted_at,now()) ELSE NULL END,updated_at=now()
     WHERE id=$2 RETURNING id,title,status,deleted_at,updated_at`,[remove,desireId]
  );
  if(!result.rows[0]) throw new AppError("Desire was not found.",404,"DESIRE_NOT_FOUND");
  await db.query(
    `INSERT INTO wants.moderation_actions(admin_user_id,target_type,target_id,action,reason)
     VALUES($1,'desire',$2,$3,$4)`,[adminUserId,desireId,remove?"remove_desire":"restore_desire",input.reason]
  );
  return result.rows[0];
};

const listUsers=async({limit=50,offset=0})=>{
  const result=await db.query(
    `SELECT u.id,u.username,u.email,u.status,u.created_at,u.last_login_at,p.display_name,p.country_code,
            count(DISTINCT d.id)::int AS desires_posted,
            count(DISTINCT r.id) FILTER(WHERE r.status IN ('open','reviewing'))::int AS open_report_count,
            a.role AS admin_role
     FROM wants.users u
     LEFT JOIN wants.user_profiles p ON p.user_id=u.id
     LEFT JOIN wants.desires d ON d.user_id=u.id
     LEFT JOIN wants.moderation_reports r ON r.reported_user_id=u.id
     LEFT JOIN wants.admin_users a ON a.user_id=u.id AND a.revoked_at IS NULL
     GROUP BY u.id,p.display_name,p.country_code,a.role
     ORDER BY open_report_count DESC,u.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]
  );
  return result.rows;
};

module.exports={createReport,listReports,decideReport,listDesires,moderateDesire,listUsers};
