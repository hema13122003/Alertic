const formattedResponse = (res, success, status, message, data = null) => {
  return res.status(status).json({
    Success: success ? "Success" : "Failure",
    "Status code": status,
    Message: message,
    Data: data
  });
};

module.exports = formattedResponse;
