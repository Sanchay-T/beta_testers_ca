const AppConfig = require("./config.js");
const BASE_URL_SERVER = process.env.BASE_URL_SERVER;
const BASE_URL_DEFAULT = process.env.BASE_URL_DEFAULT;

const getBaseUrl = () => {
  return AppConfig.isCapable ? BASE_URL_DEFAULT : BASE_URL_SERVER;
};

module.exports = getBaseUrl;
