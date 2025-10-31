const express = require('express');
const router = express.Router();
const User = require('../models/users');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const auth = require('../Middleware/authenticateToken'); // Make sure you have authentication middleware

// Multer setup for profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// GET /settings - return only saved user settings (theme, language, notifications, visibility)
router.get('/settings', auth, async (req, res) => {
  try {
    // accept multiple token payload shapes
    const userId = req.user?.id || req.user?._id || req.user?.userId || null;
    if (!userId) {
      console.error('[settings] missing req.user on /settings', { reqUser: req.user });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use model helper so the shape is consistent across callers
    const settings = await User.getSettingsById(userId);
    if (!settings) return res.status(404).json({ error: 'User not found' });
    return res.json(settings);
  } catch (err) {
    console.error('❌ Settings.fetch error:', err, 'req.user=', req.user);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /settings - Update user settings (use atomic update to avoid validating whole document)
router.post('/settings', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.userId || null;
    if (!userId) {
      console.error('[settings] missing req.user on POST /settings', { reqUser: req.user });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('📥 Settings.update request', {
      userId: req.user?.id,
      theme: req.body?.theme,
      hasFile: !!req.file,
      bodyKeys: Object.keys(req.body || {})
    });

    // Build $set object for only the fields we want to change
    const setObj = {};

    if (req.body.username) setObj.username = req.body.username;
    if (req.body.email) setObj.email = req.body.email;
    if (req.body.name) setObj.name = req.body.name;
    if (req.body.bio) setObj.bio = req.body.bio;

    // customization fields
    if (req.body.theme) setObj['customization.theme'] = req.body.theme;
    if (req.body.language) setObj['customization.language'] = req.body.language;
    if (req.body.privacy) setObj['customization.visibility'] = req.body.privacy;

    // notifications (sent as JSON string)
    if (req.body.notifications) {
      try {
        setObj.notifications = JSON.parse(req.body.notifications);
      } catch (e) {
        // ignore parse error and skip notifications update
      }
    }

    // profile picture
    if (req.file) {
      setObj.profilePic = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Password change: must verify current password first — load only password field
    if (req.body.currentPassword && req.body.newPassword) {
      const user = await User.findById(req.user.id).select('+password');
      if (!user) return res.status(404).json({ error: 'User not found' });
      const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });
      const salt = await bcrypt.genSalt(10);
      setObj.password = await bcrypt.hash(req.body.newPassword, salt);
    }

    if (Object.keys(setObj).length === 0) {
      return res.status(400).json({ message: 'No valid settings provided to update.' });
    }

    // Atomic update
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: setObj }, { new: true });
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    // Return canonical settings object so client has a single source of truth
    const settings = await User.getSettingsById(updatedUser._id);
    return res.json({
      message: 'Settings updated successfully',
      settings,
      profilePic: updatedUser.profilePic,
      profilePicture: updatedUser.profilePic,
      theme: updatedUser.customization?.theme || null
    });
  } catch (err) {
    console.error('❌ Settings.update error:', err, 'req.user=', req.user);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /delete-account - Delete user account
router.delete('/delete-account', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;