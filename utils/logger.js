const REDACT_KEYS = new Set([
  "password","accesstoken","refreshtoken","authorization","cookie","set-cookie",
  "database_url","databaseurl","cloudinary_url","cloudinaryurl","api_secret","apisecret","secret"
]);

const sanitize = (value, depth = 0) => {
  if (depth > 6) return "[MaxDepth]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name:value.name, message:value.message, code:value.code, stack:value.stack };
  }
  if (Array.isArray(value)) return value.map((v)=>sanitize(v,depth+1));
  if (typeof value === "object") {
    const out={};
    for (const [key,item] of Object.entries(value)) {
      const normalized=key.toLowerCase().replace(/[-_]/g,"");
      out[key]=REDACT_KEYS.has(key.toLowerCase()) || REDACT_KEYS.has(normalized)
        ? "[REDACTED]" : sanitize(item,depth+1);
    }
    return out;
  }
  return value;
};

const write=(level,message,meta={})=>{
  const payload={timestamp:new Date().toISOString(),level,message,...sanitize(meta)};
  const line=JSON.stringify(payload);
  if(level==="error"||level==="fatal") console.error(line);
  else if(level==="warn") console.warn(line);
  else console.log(line);
};

module.exports={
  info:(message,meta)=>write("info",message,meta),
  warn:(message,meta)=>write("warn",message,meta),
  error:(message,meta)=>write("error",message,meta),
  fatal:(message,meta)=>write("fatal",message,meta),
  sanitize
};
