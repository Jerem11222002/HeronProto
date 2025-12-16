const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/users'); // Assuming User model exists
const { adminAuthMiddleware, requireAdminRole } = require('../Middleware/adminAuthMiddleware');
const bcrypt = require('bcrypt');

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
    const { username, email, name, password, adminRole, adminPermissions } = req.body;
    
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
    const { email, name, adminRole, adminPermissions } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    user.email = email;
    user.name = name;
    user.adminRole = adminRole;
    user.adminPermissions = adminPermissions;
    
    await user.save();
    res.json({ 
      admin: { 
        _id: user._id, 
        username: user.username, 
        email: user.email, 
        name: user.name, 
        adminRole: user.adminRole, 
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
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin deleted' });
  } catch (err) {
    console.error('Failed to delete admin:', err);
    res.status(500).json({ message: 'Failed to delete admin' });
  }
});

module.exports = router;