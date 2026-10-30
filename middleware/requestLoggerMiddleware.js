const logger=require("../utils/logger");

const requestLoggerMiddleware=(req,res,next)=>{
  const started=process.hrtime.bigint();
  res.on("finish",()=>{
    const durationMs=Number(process.hrtime.bigint()-started)/1e6;
    const meta={requestId:req.requestId,method:req.method,path:req.originalUrl,status:res.statusCode,durationMs:Number(durationMs.toFixed(2)),ip:req.ip};
    if(res.statusCode>=500) logger.error("http_request",meta);
    else if(res.statusCode>=400) logger.warn("http_request",meta);
    else logger.info("http_request",meta);
  });
  next();
};
module.exports={requestLoggerMiddleware};
