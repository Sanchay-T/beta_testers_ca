const IS_CAPABLE = process.env.IS_CAPABLE.toLowerCase()==="true" ? true : false;
const BASE_URL_SERVER = process.env.BASE_URL_SERVER;
const BASE_URL_DEFAULT = process.env.BASE_URL_DEFAULT;

const getBaseUrl = () => {
  return IS_CAPABLE ? BASE_URL_DEFAULT : BASE_URL_SERVER;
};

module.exports = getBaseUrl;