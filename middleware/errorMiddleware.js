const env=require("../config/env");
const logger=require("../utils/logger");
const {normalizeError}=require("../utils/errorNormalizer");

class AppError extends Error {
  constructor(message,statusCode=500,code="INTERNAL_SERVER_ERROR",details=undefined){
    super(message);
    this.name="AppError";
    this.statusCode=statusCode;
    this.code=code;
    this.details=details;
    this.isOperational=true;
    Error.captureStackTrace?.(this,AppError);
  }
}

const notFoundMiddleware=(req,res,next)=>next(new AppError(`Route ${req.method} ${req.originalUrl} was not found.`,404,"ROUTE_NOT_FOUND"));

const errorMiddleware=(error,req,res,next)=>{
  if(res.headersSent) return next(error);

  const normalized=error instanceof AppError ? null : normalizeError(error);
  const statusCode=error.statusCode || normalized?.statusCode || 500;
  const code=error.code && error instanceof AppError ? error.code : normalized?.code || "INTERNAL_SERVER_ERROR";
  const isExpected=Boolean(error instanceof AppError || normalized || (statusCode>=400 && statusCode<500));
  const production=env.nodeEnv==="production";
  const message=production && !isExpected
    ? "An unexpected server error occurred."
    : (normalized?.message || error.message || "An unexpected server error occurred.");

  logger.error("request_error",{
    requestId:req.requestId,method:req.method,path:req.originalUrl,status:statusCode,code,
    error:{name:error.name,message:error.message,code:error.code,stack:error.stack}
  });

  const payload={success:false,error:{code,message},requestId:req.requestId};
  if(error.details) payload.error.details=error.details;
  if(!production && error.stack) payload.error.stack=error.stack;
  res.status(statusCode).json(payload);
};

module.exports={AppError,notFoundMiddleware,errorMiddleware};
