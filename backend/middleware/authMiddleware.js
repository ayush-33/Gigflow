import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
    console.log("🔐 AUTH HEADER:", authHeader); // ← add this temporarily


  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
req.userId = decoded.id;
    next();

  } catch (error) {
    // ✅ Distinguish between expired and invalid
    // Frontend checks for code: "TOKEN_EXPIRED" to trigger a refresh
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
        code: "TOKEN_EXPIRED"
      });
    }
    return res.status(401).json({
      message: "Invalid token",
      code: "TOKEN_INVALID",
        detail: error.message  // ← ADD THIS

    });
  }
};