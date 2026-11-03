require("dotenv").config();
require("../services/mailService").verifyMailConnection().then(()=>{console.log("SMTP connection verified.");process.exit(0)}).catch(error=>{console.error(error);process.exit(1)});
