require("dotenv").config();

const {
  sendPasswordResetCode,
} = require("../services/mailService");

sendPasswordResetCode({
  to: "surteesuhail@outlook.com",
  code: "482731",
  expiresMinutes: 10,
})
  .then(() => {
    console.log(
      "DESCRAVE test recovery email accepted by SMTP.",
    );

    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "DESCRAVE test recovery email failed:",
      error,
    );

    process.exit(1);
  });