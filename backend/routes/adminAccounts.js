const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { adminAuthMiddleware, requireAdminRole } = require('../Middleware/adminAuthMiddleware');
const User = require('../models/users');
const logger = require('../utils/logger');

/**
 * GET /api/admin/accounts
 * Fetch all admin accounts (super admin only)
 */
router.get('/', adminAuthMiddleware, requireAdminRole('super'), async (req, res) => {
  try {
    console.log('📋 adminAccounts.list - req.user:', {
      userId: req.user?.id || req.user?._id,
      email: req.user?.email,
      adminRole: req.user?.adminRole
    });

    logger.info('adminAccounts.list.start', { userId: req.user.id || req.user._id });

    const admins = await User.find({ isAdmin: true })
      .select('_id username email name adminRole adminPermissions lastAdminLogin createdAt')
      .sort({ createdAt: -1 })
      .lean();

    console.log('✅ Found admins:', admins.length);

    const formatted = admins.map(admin => ({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      adminRole: admin.adminRole,
      adminPermissions: admin.adminPermissions || {},
      lastAdminLogin: admin.lastAdminLogin,
      createdAt: admin.createdAt,
      isActive: !!admin.lastAdminLogin && (Date.now() - new Date(admin.lastAdminLogin)) < 30 * 24 * 60 * 60 * 1000 // active within 30 days
    }));

    logger.info('adminAccounts.list.success', { count: formatted.length });
    res.json(formatted);
  } catch (error) {
    console.error('❌ adminAccounts.list.error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id || req.user?._id
    });

    logger.error('adminAccounts.list.error', { message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch admin accounts', error: error.message });
  }
});

/**
 * GET /api/admin/accounts/:id
 * Fetch single admin account (super admin only)
 */
router.get('/:id', adminAuthMiddleware, requireAdminRole('super'), async (req, res) => {
  try {
    const admin = await User.findById(req.params.id)
      .select('_id username email name adminRole adminPermissions lastAdminLogin createdAt')
      .lean();

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    res.json({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      adminRole: admin.adminRole,
      adminPermissions: admin.adminPermissions || {},
      lastAdminLogin: admin.lastAdminLogin,
      createdAt: admin.createdAt
    });
  } catch (error) {
    logger.error('adminAccounts.get.error', { message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch admin account', error: error.message });
  }
});

/**
 * POST /api/admin/accounts
 * Create new admin account (super admin only)
 */
router.post('/', adminAuthMiddleware, requireAdminRole('super'), async (req, res) => {
  try {
    const { username, email, name, password, adminRole, adminPermissions } = req.body;

    // Validate required fields
    if (!username || !email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: username, email, password, name'
      });
    }

    // Validate adminRole
    if (!['super', 'admin', 'moderator', 'editor'].includes(adminRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin role. Must be: super, admin, moderator, or editor'
      });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.username === username.toLowerCase() 
          ? 'Username already exists' 
          : 'Email already exists'
      });
    }

    // Validate and set default permissions based on role
    const defaultPermissions = {
      super: { canManageUsers: true, canManageEvents: true, canModerateContent: true, canAccessAnalytics: true, canManageSettings: true },
      admin: { canManageUsers: false, canManageEvents: true, canModerateContent: true, canAccessAnalytics: true, canManageSettings: false },
      moderator: { canManageUsers: false, canManageEvents: true, canModerateContent: true, canAccessAnalytics: true, canManageSettings: false },
      editor: { canManageUsers: false, canManageEvents: true, canModerateContent: false, canAccessAnalytics: false, canManageSettings: false }
    };

    const finalPermissions = adminRole === 'super' 
      ? defaultPermissions.super 
      : { ...defaultPermissions[adminRole], ...(adminPermissions || {}) };

    // Create new admin user
    const newAdmin = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      name,
      password, // Will be hashed by pre-save hook
      isAdmin: true,
      adminRole,
      adminPermissions: finalPermissions
    });

    await newAdmin.save();

    // Log admin action
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          adminActionLog: {
            action: 'created_admin_account',
            details: { newAdminId: newAdmin._id, username: newAdmin.username, role: adminRole },
            timestamp: new Date()
          }
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
      // Don't fail the request if logging fails
    }

    logger.info('adminAccounts.create.success', {
      createdAdminId: newAdmin._id,
      username: newAdmin.username,
      role: adminRole,
      createdBy: req.user.email
    });

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        _id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        name: newAdmin.name,
        adminRole: newAdmin.adminRole,
        adminPermissions: newAdmin.adminPermissions,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (error) {
    logger.error('adminAccounts.create.error', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create admin account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/admin/accounts/:id
 * Update admin account (super admin only)
 */
router.put('/:id', adminAuthMiddleware, requireAdminRole('super'), async (req, res) => {
  try {
    const { email, name, adminRole, adminPermissions } = req.body;
    const adminId = req.params.id;

    // Prevent self-demotion from super admin
    if (adminId === req.user._id.toString() && req.body.adminRole !== 'super') {
      return res.status(403).json({
        success: false,
        message: 'Cannot change your own admin role'
      });
    }

    // Find the admin account
    const admin = await User.findById(adminId);

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found'
      });
    }

    // Update allowed fields
    if (name) admin.name = name;
    if (email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: adminId }
      });
      if (emailExists) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
      admin.email = email.toLowerCase();
    }

    // Update role and permissions
    if (adminRole && ['super', 'admin', 'moderator', 'editor'].includes(adminRole)) {
      admin.adminRole = adminRole;

      // Apply default permissions for role if not custom
      const defaultPermissions = {
        super: { canManageUsers: true, canManageEvents: true, canModerateContent: true, canAccessAnalytics: true, canManageSettings: true },
        admin: { canManageUsers: false, canManageEvents: true, canModerateContent: true, canAccessAnalytics: true, canManageSettings: false },
        moderator: { canManageUsers: false, canManageEvents: true, canModerateContent: true, canAccessAnalytics: true, canManageSettings: false },
        editor: { canManageUsers: false, canManageEvents: true, canModerateContent: false, canAccessAnalytics: false, canManageSettings: false }
      };

      admin.adminPermissions = adminRole === 'super' 
        ? defaultPermissions.super 
        : { ...defaultPermissions[adminRole], ...(adminPermissions || {}) };
    } else if (adminPermissions && typeof adminPermissions === 'object') {
      // Update only specific permissions if provided
      admin.adminPermissions = { ...admin.adminPermissions, ...adminPermissions };
    }

    await admin.save();

    // Log action
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          adminActionLog: {
            action: 'updated_admin_account',
            details: { adminId, username: admin.username, newRole: adminRole },
            timestamp: new Date()
          }
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    logger.info('adminAccounts.update.success', {
      adminId,
      updatedBy: req.user.email,
      newRole: adminRole
    });

    res.json({
      success: true,
      message: 'Admin account updated successfully',
      admin: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        adminRole: admin.adminRole,
        adminPermissions: admin.adminPermissions,
        lastAdminLogin: admin.lastAdminLogin
      }
    });
  } catch (error) {
    logger.error('adminAccounts.update.error', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update admin account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/admin/accounts/:id
 * Delete admin account (super admin only)
 */
router.delete('/:id', adminAuthMiddleware, requireAdminRole('super'), async (req, res) => {
  try {
    const adminId = req.params.id;

    // Prevent self-deletion
    if (adminId === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own admin account'
      });
    }

    const admin = await User.findById(adminId);

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found'
      });
    }

    // Remove admin privileges instead of deleting user
    admin.isAdmin = false;
    admin.adminRole = null;
    admin.adminPermissions = {
      canManageUsers: false,
      canManageEvents: false,
      canModerateContent: false,
      canAccessAnalytics: false,
      canManageSettings: false
    };
    admin.lastAdminLogin = null;

    await admin.save();

    // Log action
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          adminActionLog: {
            action: 'removed_admin_privileges',
            details: { adminId, username: admin.username, previousRole: admin.adminRole },
            timestamp: new Date()
          }
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    logger.info('adminAccounts.delete.success', {
      adminId,
      username: admin.username,
      deletedBy: req.user.email
    });

    res.json({
      success: true,
      message: 'Admin account privileges removed successfully',
      admin: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        isAdmin: false
      }
    });
  } catch (error) {
    logger.error('adminAccounts.delete.error', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to remove admin privileges',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;