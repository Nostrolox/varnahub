export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error(error);
  res.status(error.status || 500).json({
    error: error.expose ? error.message : "Server error",
  });
}
