function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  if (req.app?.get("env") !== "test") {
    // Keep logs server-side; avoid leaking internals to clients.
    // eslint-disable-next-line no-console
    console.error(error);
  }

  res.status(statusCode).json({ error: message });
}

module.exports = {
  errorHandler,
};
