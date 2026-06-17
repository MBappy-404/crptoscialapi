const httpResponse = (status, data, message) => {
  return { status, data, message };
};

module.exports = { httpResponse };
