const env=require("./config/env");
const {closePool}=require("./config/db");
const storageConfig=require("./config/storage");
const logger=require("./utils/logger");
const app=require("./app");

const server=app.listen(env.port,()=>{
  logger.info("server_started",{port:env.port,environment:env.nodeEnv,storageProvider:storageConfig.provider,cloudName:storageConfig.provider==="cloudinary"?storageConfig.cloudinary.config().cloud_name:undefined});
});

let shuttingDown=false;
const shutdown=(signal,exitCode=0)=>{
  if(shuttingDown) return;
  shuttingDown=true;
  logger.warn("server_shutdown_started",{signal});

  const timer=setTimeout(()=>{
    logger.fatal("server_shutdown_timeout",{signal});
    process.exit(1);
  },env.shutdownTimeoutMs);
  timer.unref();

  server.close(async(serverError)=>{
    try{
      if(serverError) throw serverError;
      await closePool();
      clearTimeout(timer);
      logger.info("server_shutdown_complete",{signal});
      process.exit(exitCode);
    }catch(error){
      logger.fatal("server_shutdown_failed",{signal,error});
      process.exit(1);
    }
  });
};

process.on("SIGINT",()=>shutdown("SIGINT",0));
process.on("SIGTERM",()=>shutdown("SIGTERM",0));
process.on("unhandledRejection",(reason)=>{
  logger.fatal("unhandled_rejection",{error:reason instanceof Error?reason:new Error(String(reason))});
  shutdown("unhandledRejection",1);
});
process.on("uncaughtException",(error)=>{
  logger.fatal("uncaught_exception",{error});
  shutdown("uncaughtException",1);
});

module.exports={server,shutdown};
