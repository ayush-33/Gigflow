import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/* ── Token Helpers ── */

const generateAccessToken = (userId) =>
  jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

const generateRefreshToken = (userId) =>
  jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

// Sends refresh token as a secure httpOnly cookie
const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",   // ✅ FIXED
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

/* ---------- Register ---------- */
// ✅ FIXED authController.js — register function
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    // ✅ declare the variable properly
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser)
      return res.status(400).json({ message: "An account with this email already exists." });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
    });

    res.status(201).json({ message: "Account created successfully." });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------- Login ---------- */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password +refreshToken");
    if (!user)
      return res.status(401).json({ message: "No account found with this email." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Incorrect password." });

    // ✅ Use the helpers (consistent { id } payload)
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // ✅ Persist refresh token so refresh/logout can verify it
    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: { _id: user._id, name: user.name, email: user.email },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
/* ---------- Refresh Access Token ---------- */
export const refreshAccessToken = async (req, res) => {
  console.log("🔄 Token expired, attempting refresh...");  // ← add this

  try {
    const token = req.cookies?.refreshToken;

    if (!token)
      return res.status(401).json({ message: "No refresh token provided" });

    // Verify the refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    // Check it matches what's stored in DB (catches revoked tokens)
    const user = await User.findById(decoded.id).select("+refreshToken");
    if (!user || user.refreshToken !== token)
      return res.status(403).json({ message: "Refresh token revoked or not found" });

    // Rotate refresh token (new one each time — limits replay attacks)
    const newAccessToken  = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    setRefreshCookie(res, newRefreshToken);

    res.json({ accessToken: newAccessToken });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- Logout ---------- */
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      // Clear from DB so the token can never be reused
      await User.findOneAndUpdate(
        { refreshToken: token },
        { refreshToken: null }
      );
    }

    // Clear the cookie from browser
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });

    res.json({ message: "Logged out successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};