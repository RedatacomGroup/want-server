const normalizeError=(error)=>{
  const code=error?.code;

  if(code==="23505") return {statusCode:409,code:"CONFLICT",message:"That value already exists."};
  if(code==="23503") return {statusCode:409,code:"REFERENCE_CONFLICT",message:"The requested operation conflicts with related data."};
  if(code==="22P02") return {statusCode:400,code:"INVALID_IDENTIFIER",message:"A supplied identifier is invalid."};
  if(["ECONNREFUSED","ECONNRESET","ETIMEDOUT","57P01","57P02","57P03","08000","08001","08003","08006"].includes(code)) {
    return {statusCode:503,code:"DEPENDENCY_UNAVAILABLE",message:"A required service is temporarily unavailable."};
  }

  if(error?.http_code && error?.message && /cloud|signature|api_key|upload/i.test(error.message)) {
    const status=Number(error.http_code)>=500?503:502;
    return {statusCode:status,code:"MEDIA_SERVICE_ERROR",message:"Media processing is temporarily unavailable."};
  }

  if(error?.type==="entity.too.large") return {statusCode:413,code:"PAYLOAD_TOO_LARGE",message:"Request payload is too large."};
  if(error instanceof SyntaxError && error?.status===400 && "body" in error) return {statusCode:400,code:"INVALID_JSON",message:"Request body contains invalid JSON."};

  return null;
};
module.exports={normalizeError};
