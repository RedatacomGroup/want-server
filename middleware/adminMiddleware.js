const db=require("../config/db");
const {AppError}=require("./errorMiddleware");

const requireAdmin=(roles=["moderator","admin","super_admin"])=>async(req,res,next)=>{
  const result=await db.query(
    `SELECT role FROM wants.admin_users WHERE user_id=$1 AND revoked_at IS NULL LIMIT 1`,
    [req.user.id]
  );
  if(!result.rows[0] || !roles.includes(result.rows[0].role)) {
    return next(new AppError("Administrator access is required.",403,"ADMIN_REQUIRED"));
  }
  req.admin={userId:req.user.id,role:result.rows[0].role};
  next();
};
module.exports={requireAdmin};
