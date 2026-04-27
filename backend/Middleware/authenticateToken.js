const jwt = require("jsonwebtoken");
const User = require("../models/users");

const publicPaths = [
  '/',
  '/favicon.ico',
  '/assets',            // Allow assets folder
  '/uploads',           // Allow uploaded files
  '/static',            // If you use /static for React build
  '/api/auth/login',
  '/api/auth/register',
  '/api/admin/auth/login',
  '/api/interests',
  '/socket.io'
];

module.exports = async function authenticate(req, res, next) {
  console.log('[authenticate] ENTRY', { path: req.path, method: req.method, hasAuth: !!req.headers.authorization });
  try {
    const authHeader = req.headers.authorization;
    console.log("Authorization header:", authHeader ? "Present" : "Missing");

    if (!authHeader) {
      console.error("Access denied: No authorization header");
      return res.status(401).json({ 
        success: false,
        message: "Access denied. No token provided." 
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.error("Access denied: No token in header");
      return res.status(401).json({ 
        success: false,
        message: "Access denied. No token provided." 
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token verified for user ID:", decoded.id);

    // Fetch user from database
    // 🎯 OPTIMIZED: Only select minimal fields, NOT the huge followers/following/posts arrays
    const user = await User.findById(decoded.id)
      .select('_id username email name profilePicture profilePic gender customization notifications interestsSelected interests relatedOrganizations studentId profileSetup')
      .lean() // 🚀 Use .lean() for read-only - ~10x faster than hydrated document
      .exec();

    if (!user) {
      console.error("User not found:", decoded.id);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // ⚡ Since we're using .lean(), user is a plain JavaScript object, not a Mongoose document
    // Data validation is handled at the model level, so no need for runtime fixes here
    
    // Attach user data to request (minimal fields to avoid memory bloat)
    req.user = {
      id: user._id,
      _id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      profilePic: user.profilePic,
      interestsSelected: user.interestsSelected,
      interests: user.interests || []
    };

    // after token validated and req.user set:
    console.log('[authenticate] token valid for user:', req.user?.id || req.user?._id || req.user?.username);
    return next();
  } catch (err) {
    console.error('[authenticate] ERROR', err && (err.stack || err.message || err));
    return res.status(401).json({ error: 'Unauthorized' });
  } finally {
    console.log('[authenticate] EXIT', { path: req.path, method: req.method });
  }
};