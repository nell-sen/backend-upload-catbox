const auth = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      status: false,
      error: "Missing API key. Provide x-api-key header.",
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({
      status: false,
      error: "Invalid API key.",
    });
  }

  next();
};

module.exports = auth;
