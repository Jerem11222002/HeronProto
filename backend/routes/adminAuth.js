const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const path = require("path");
const { 
  adminAuthMiddleware, 
  requireAdminRole 
} = require(path.join(__dirname, "../Middleware/adminAuthMiddleware"));

// Helper: Generate Admin JWT Token
const generateAdminToken = (admin) => {
  const payload = { 
    id: admin._id,
    isAdmin: true,
    role: admin.adminRole || admin.role,
    permissions: admin.adminPermissions || admin.permissions
  };
  
  console.log("🔑 Generating admin token with payload:", payload);
  
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
  
  console.log("📜 Token details:", {
    token: `${token.substring(0, 10)}...`,
    decoded: jwt.decode(token)
  });
  
  return token;
};

// Public Admin Routes
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('👤 Admin login attempt:', {
      username,
      timestamp: new Date().toISOString()
    });

    // Validate input
    if (!username || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
        type: 'admin'
      });
    }

    // Find admin user with updated query to match your DB structure
    try {
      const admin = await User.findOne({
        username: username.toLowerCase(),
        $or: [
          { isAdmin: true },
          { role: { $in: ['admin', 'super_admin'] } },
          { adminRole: { $in: ['admin', 'super'] } }
        ]
      }).select('+password +adminRole +adminPermissions +role +permissions');

      console.log('🔍 Admin lookup result:', {
        found: !!admin,
        hasPassword: !!admin?.password,
        role: admin?.adminRole || admin?.role,
        permissions: !!admin?.adminPermissions || !!admin?.permissions
      });

      if (!admin) {
        console.log('❌ Admin not found:', username);
        return res.status(401).json({
          success: false,
          message: "Invalid admin credentials",
          type: 'admin'
        });
      }

      // Verify password with detailed error handling
      try {
        const validPassword = await bcrypt.compare(password, admin.password);
        console.log('🔑 Password verification:', { 
          isValid: validPassword,
          passwordLength: password.length,
          hashedLength: admin.password.length
        });

        if (!validPassword) {
          console.log('❌ Invalid password for admin:', username);
          return res.status(401).json({
            success: false,
            message: "Invalid admin credentials",
            type: 'admin'
          });
        }

        // Verify admin role
        if (!admin.adminRole && !admin.role) {
          console.error('❌ Admin role not set for user:', username);
          return res.status(403).json({
            success: false,
            message: "Invalid admin account configuration",
            type: 'admin'
          });
        }

        // Generate token with error handling
        let token;
        try {
          token = generateAdminToken(admin);
        } catch (tokenError) {
          console.error('🚨 Token generation failed:', tokenError);
          throw new Error('Authentication failed - Token generation error');
        }

        // Update last login time without triggering full schema validation
        try {
          await User.findByIdAndUpdate(
            admin._id,
            { $set: { lastAdminLogin: new Date() } },
            { runValidators: false }
          );
        } catch (updateErr) {
          // Log but do not fail the login for update issues
          console.warn('⚠️ Failed to update admin last login (non-fatal):', updateErr && (updateErr.message || updateErr));
        }

        console.log('✅ Admin login successful:', {
           username: admin.username,
           role: admin.adminRole || admin.role,
           loginTime: admin.lastAdminLogin
         });
 
         return res.status(200).json({
           success: true,
           token,
           user: {
             _id: admin._id,
             username: admin.username,
             email: admin.email,
             name: admin.name,
             isAdmin: true,
             adminRole: admin.adminRole || admin.role,
             adminPermissions: admin.adminPermissions || admin.permissions
           }
         });
 
      } catch (bcryptError) {
        // Treat bcrypt.compare and immediate verification errors separately
        console.error('🚨 Password verification / login error:', {
          message: bcryptError?.message || bcryptError,
          stack: process.env.NODE_ENV === 'development' ? bcryptError?.stack : undefined
        });
        throw new Error('Authentication failed - Password verification error');
      }

    } catch (dbError) {
      console.error('🚨 Database lookup failed:', dbError);
      throw new Error('Authentication failed - Database error');
    }

  } catch (err) {
    console.error("🚨 Admin login error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
      type: err.constructor.name
    });
    
    // Send appropriate error response
    res.status(500).json({
      success: false,
      message: err.message || "Server error during admin login",
      type: 'admin',
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Protected Admin Routes
router.get("/profile", adminAuthMiddleware, async (req, res) => {
  try {
    const adminId = (req.admin && req.admin.id) || (req.user && req.user.id);
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    res.json({
      success: true,
      admin: {
        ...admin.toJSON(),
        adminAccess: admin.getAdminAccess()
      }
    });
  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin profile"
    });
  }
});

// Admin logout route
router.post("/logout", adminAuthMiddleware, async (req, res) => {
  try {
    const adminId = (req.admin && req.admin.id) || (req.user && req.user.id);
    if (adminId) {
      const adminDoc = await User.findById(adminId);
      if (adminDoc && typeof adminDoc.logAdminAction === 'function') {
        await adminDoc.logAdminAction('logout');
      }
    }
    
    res.json({
      success: true,
      message: "Admin logged out successfully"
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout"
    });
  }
});

// Super admin only routes
router.post("/update-role", 
  adminAuthMiddleware, 
  requireAdminRole('super'), 
  async (req, res) => {
    try {
      const { userId, newRole } = req.body;
      
      const targetUser = await User.findById(userId);
      if (!targetUser || (!targetUser.isAdmin && !targetUser.role && !targetUser.adminRole)) {
        return res.status(404).json({
          success: false,
          message: "Admin user not found"
        });
      }

      await targetUser.updateAdminRole(newRole);
      
      res.json({
        success: true,
        message: "Admin role updated successfully",
        admin: targetUser.getAdminAccess()
      });
    } catch (error) {
      console.error("Update admin role error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update admin role"
      });
    }
});

module.exports = router;