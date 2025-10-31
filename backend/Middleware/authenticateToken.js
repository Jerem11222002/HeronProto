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
    const user = await User.findById(decoded.id)
      .select("-password");

    if (!user) {
      console.error("User not found:", decoded.id);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // --- AUTO-FIX USER FIELDS ---
    let changed = false;
    // Ensure interests is always an array of strings
    if (!Array.isArray(user.interests)) {
      user.interests = [];
      changed = true;
    } else if (user.interests.some(i => typeof i !== 'string')) {
      user.interests = user.interests.map(i => i && i.toString ? i.toString() : '');
      changed = true;
    }
    // Ensure interestsSelected and interestsSkipped are set
    if (typeof user.interestsSelected !== 'boolean') {
      user.interestsSelected = user.interests.length > 0 || !!user.interestsSkipped;
      changed = true;
    }
    if (typeof user.interestsSkipped !== 'boolean') {
      user.interestsSkipped = false;
      changed = true;
    }
    // Optionally: ensure profileSetup is set
    if (typeof user.profileSetup !== 'boolean') {
      user.profileSetup = !!(
        user.name && 
        (user.bio || user.profilePic !== '/assets/person/Default.jpg')
      );
      changed = true;
    }
    // Save if changed
    if (changed) await user.save();

    // Attach user data to request
    req.user = {
      id: user._id,
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      interestsSelected: user.interestsSelected,
      interests: user.interests
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