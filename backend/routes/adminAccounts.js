const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/users'); // Assuming User model exists
const { adminAuthMiddleware, requireAdminRole } = require('../Middleware/adminAuthMiddleware');
const bcrypt = require('bcrypt');
const { createPermissionUpdateNotification, createSuperadminAlert } = require('./adminNotifications');

const router = express.Router();

// Replace verifyAdmin with standard middleware
router.use(adminAuthMiddleware);
router.use(requireAdminRole('super'));

// GET /api/admin/accounts - List admin accounts
router.get('/', async (req, res) => {
  try {
    const admins = await User.find({ isAdmin: true }).select('-password');
    const formattedAdmins = admins.map(admin => ({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      name: admin.name,
      adminRole: admin.adminRole,
      adminOrganization: admin.adminOrganization,
      adminPermissions: admin.adminPermissions || {}
    }));
    res.json(formattedAdmins);
  } catch (err) {
    console.error('Failed to fetch admins:', err);
    res.status(500).json({ message: 'Failed to fetch admins' });
  }
});

// POST /api/admin/accounts - Create new admin
router.post('/', async (req, res) => {
  try {
    const { username, email, name, password, adminRole, adminOrganization, adminPermissions } = req.body;
    
    // Check if username or email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      name,
      password: hashedPassword,
      isAdmin: true,
      adminRole,
      adminOrganization,
      adminPermissions
    });
    
    await newUser.save();
    res.status(201).json({ 
      admin: { 
        _id: newUser._id, 
        username: newUser.username, 
        email: newUser.email, 
        name: newUser.name, 
        adminRole: newUser.adminRole, 
        adminOrganization: newUser.adminOrganization,
        adminPermissions: newUser.adminPermissions 
      } 
    });
  } catch (err) {
    console.error('Failed to create admin:', err);
    res.status(500).json({ message: 'Failed to create admin' });
  }
});

// PUT /api/admin/accounts/:id - Update admin
router.put('/:id', async (req, res) => {
  try {
    const { email, name, adminRole, adminOrganization, adminPermissions } = req.body;
    const updatedById = req.user?.id;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Track permission changes for notification
    const previousPermissions = user.adminPermissions || {};
    const hasPermissionChanges = adminPermissions &&
      JSON.stringify(previousPermissions) !== JSON.stringify(adminPermissions);

    user.email = email;
    user.name = name;
    user.adminRole = adminRole;
    user.adminOrganization = adminOrganization;
    user.adminPermissions = adminPermissions;

    await user.save();

    // Create permission update notification if permissions changed
    if (hasPermissionChanges && updatedById) {
      try {
        // Calculate what changed
        const changes = {};
        Object.keys(adminPermissions).forEach(key => {
          if (previousPermissions[key] !== adminPermissions[key]) {
            changes[key] = adminPermissions[key];
          }
        });

        await createPermissionUpdateNotification(user._id, updatedById, changes);

        // Also notify superadmins about the permission change
        await createSuperadminAlert(
          `Admin ${user.username} (${user.adminOrganization || 'no org'}) permissions were updated by ${req.user?.name || 'system'}`,
          {
            adminId: user._id,
            adminUsername: user.username,
            adminOrganization: user.adminOrganization,
            updatedBy: updatedById,
            changes
          },
          'medium'
        );

        console.log(`[ADMIN ACCOUNTS] Permission update notification sent to ${user.username}`);
      } catch (notifError) {
        // Log but don't fail the update if notification fails
        console.error('[ADMIN ACCOUNTS] Failed to send permission notification:', notifError);
      }
    }

    res.json({
      admin: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        adminRole: user.adminRole,
        adminOrganization: user.adminOrganization,
        adminPermissions: user.adminPermissions
      }
    });
  } catch (err) {
    console.error('Failed to update admin:', err);
    res.status(500).json({ message: 'Failed to update admin' });
  }
});

// DELETE /api/admin/accounts/:id - Delete admin
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // SECURITY: Prevent deletion of superadmin accounts
    if (user.adminRole === 'super') {
      return res.status(403).json({ 
        message: 'Cannot delete superadmin account. Superadmin accounts can only be managed by system administrators.',
        isSuperadmin: true
      });
    }
    
    // Audit logging
    console.log('🔏 Admin deletion:', {
      deletedAdmin: user.username,
      deletedId: user._id,
      deletedRole: user.adminRole,
      deletedBy: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin deleted successfully' });
  } catch (err) {
    console.error('Failed to delete admin:', err);
    res.status(500).json({ message: 'Failed to delete admin' });
  }
});

module.exports = router;