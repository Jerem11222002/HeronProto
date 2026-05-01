const jwt = require("jsonwebtoken");
const User = require("../models/users");
const logger = require('../utils/logger');

/**
 * Define paths that don't require authentication
 */
const PUBLIC_PATHS = [
  '/login',
  '/favicon.ico',
  '/api/auth/login',
  '/api/admin/auth/login', // Added admin login path
  '/static',
  '/assets',
  '/manifest.json'
];

/**
 * Check if path should skip authentication
 */
const isPublicPath = (path) => {
  return PUBLIC_PATHS.some(publicPath => 
    path === publicPath || path.startsWith(publicPath + '/')
  );
};

/**
 * Middleware to authenticate and authorize admin users
 */
const adminAuthMiddleware = async (req, res, next) => {
  try {
    // Skip auth check for public paths
    if (isPublicPath(req.path)) {
      console.log("🔓 Skipping auth for public path:", req.path);
      return next();
    }

    // Handle favicon.ico specifically
    if (req.path === '/favicon.ico') {
      return res.status(204).end();
    }

    // lightweight request debug
    logger.info('adminAuth.check', { path: req.path, method: req.method, hasAuthHeader: !!req.headers.authorization });

    // Log request details
    console.log("👤 Admin auth request:", {
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      hasAuth: !!req.headers.authorization
    });

    // Validate authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("❌ Admin access denied: No valid token provided");
      return res.status(401).json({ 
        success: false,
        message: "Please login to access admin features",
        type: 'admin'
      });
    }

    // Extract and validate token
    const token = authHeader.split(" ")[1];
    if (!token || token.length < 10) {
      console.error("❌ Admin access denied: Invalid token format");
      return res.status(401).json({ 
        success: false,
        message: "Invalid authentication token format",
        type: 'admin'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔑 Token verified for user:", decoded.id);
    } catch (jwtError) {
      console.error("❌ JWT verification failed:", jwtError.message);
      return res.status(401).json({
        success: false,
        message: jwtError.name === 'TokenExpiredError' 
          ? "Authentication token has expired"
          : "Invalid authentication token",
        type: 'admin'
      });
    }

    // Find and validate user
    const user = await User.findById(decoded.id)
      .select("-password")
      .lean();

    if (!user) {
      console.error("❌ User not found:", decoded.id);
      return res.status(404).json({ 
        success: false,
        message: "User account not found",
        type: 'admin'
      });
    }

    // Verify admin privileges
    if (!user.isAdmin) {
      console.error("❌ Non-admin access attempt:", {
        email: user.email,
        userId: user._id
      });
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
        type: 'admin'
      });
    }

    // Update last admin activity
    try {
      await User.findByIdAndUpdate(user._id, {
        lastAdminLogin: new Date(),
        lastActiveIP: req.ip
      });
    } catch (updateError) {
      console.warn("⚠️ Failed to update admin activity:", updateError.message);
      // Continue despite update failure
    }

    // Attach user data to request
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      isAdmin: true,
      adminRole: user.adminRole || 'basic',
      adminOrganization: user.adminOrganization || null,
      permissions: user.adminPermissions || [],
      lastLogin: user.lastAdminLogin
    };

    // maintain backward compatibility: some routes expect req.admin
    req.admin = req.user;

    // Log successful authentication
    logger.info('adminAuth.success', {
      email: user.email,
      role: user.adminRole || user.role,
      permissionsCount: (user.adminPermissions || user.permissions)?.length || 0
    });
    
    next();

  } catch (error) {
    logger.error('adminAuth.error', { name: error.name, message: error.message, stack: error.stack });

    res.status(500).json({ 
      success: false,
      message: "Authentication failed",
      type: 'admin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to check specific admin roles
 */
const requireAdminRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        console.error("❌ No user data found in request");
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      if (!req.user.isAdmin) {
        console.error("❌ Non-admin access attempt for role:", requiredRole);
        return res.status(403).json({
          success: false,
          message: "Admin privileges required"
        });
      }

      const hasRequiredRole = 
        req.user.adminRole === requiredRole || 
        req.user.adminRole === 'super';

      if (!hasRequiredRole) {
        console.error("❌ Insufficient admin role:", {
          required: requiredRole,
          actual: req.user.adminRole,
          timestamp: new Date().toISOString()
        });
        return res.status(403).json({
          success: false,
          message: `Required role: ${requiredRole}`
        });
      }

      next();
    } catch (error) {
      console.error("🚨 Role check error:", {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({
        success: false,
        message: "Role verification failed"
      });
    }
  };
};

module.exports = {
  adminAuthMiddleware,
  requireAdminRole,
  isPublicPath
};