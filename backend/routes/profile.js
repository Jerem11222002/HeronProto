const router = require('express').Router();
const auth = require('../Middleware/authenticateToken'); // Update this path
const User = require('../models/users'); // Update model path if needed
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { validateImageFile } = require('../utils/imageValidation');


const cloudinaryConfig = {
  folder: 'heron_profiles',
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [
    { width: 500, height: 500, crop: 'fill', gravity: 'face', quality: 'auto' },
    { fetch_format: 'auto' }
  ]
};

const getSecureUrl = (path) => {
  if (!path) return null;
  // Convert to secure HTTPS URL if not already
  return path.replace('http://', 'https://');
};


// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});



// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    ...cloudinaryConfig,
    // Add custom filename
    filename: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `${req.params.userId}-${uniqueSuffix}`;
    }
  }
});

const upload = multer({
  storage: storage,
  fileFilter: validateImageFile,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Update profile picture (atomic, avoids full-document validation)
router.post('/upload/profile-pic/:userId', auth, upload.single('profilePic'), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

    // Cloudinary storage may provide path, secure_url or url depending on config
    const secureUrl = req.file?.path || req.file?.secure_url || req.file?.url || null;
    if (!secureUrl) {
      console.error('No secureUrl returned from storage for file:', req.file);
      return res.status(500).json({ success: false, message: 'Image storage returned no URL' });
    }

    // Read only the previous profilePic (no save -> avoids validation)
    const existing = await User.findById(userId).select('profilePic').lean();
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    // Build atomic update: set profilePic, push previous to history (at front)
    const update = {
      $set: { profilePic: secureUrl, updatedAt: Date.now() }
    };

    if (existing.profilePic) {
      update.$push = {
        imageHistory: {
          $each: [{ type: 'profilePic', url: existing.profilePic, uploadedAt: new Date() }],
          $position: 0
        }
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true, useFindAndModify: false });

    // Emit socket event if available
    const io = req.app.get('io');
    if (io) io.emit('profile:updated', { userId, profilePic: secureUrl });

    res.status(200).json({ success: true, profilePic: secureUrl, user: updatedUser, message: 'Profile picture updated successfully' });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update cover photo (atomic)
router.post('/upload/cover-pic/:userId', auth, upload.single('coverPic'), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

    const secureUrl = req.file?.path || req.file?.secure_url || req.file?.url || null;
    if (!secureUrl) return res.status(500).json({ success: false, message: 'Image storage returned no URL' });

    const existing = await User.findById(userId).select('coverPic').lean();
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    const update = {
      $set: { coverPic: secureUrl, updatedAt: Date.now() }
    };

    if (existing.coverPic) {
      update.$push = {
        imageHistory: {
          $each: [{ type: 'coverPic', url: existing.coverPic, uploadedAt: new Date() }],
          $position: 0
        }
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true, useFindAndModify: false });

    res.status(200).json({ success: true, coverPic: secureUrl, user: updatedUser, message: 'Cover photo updated successfully' });
  } catch (error) {
    console.error('Cover photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cover photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete profile picture
router.delete('/delete/profile-pic/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.profilePic) {
      // Extract public_id from Cloudinary URL
      const publicId = user.profilePic.split('/').slice(-1)[0].split('.')[0];
      await cloudinary.uploader.destroy(`heron_profiles/${publicId}`);

      // Emit socket event for real-time updates
      const io = req.app.get('io');
      if (io) {
        io.emit('profile:updated', {
          userId,
          profilePic: null
        });
      }
    }

    user.profilePic = null;
    user.updatedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully'
    });

  } catch (error) {
    console.error('Profile picture deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing profile picture',
      error: error.message
    });
  }
});

// Delete cover photo
router.delete('/delete/cover-pic/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.coverPic) {
      // Extract public_id from Cloudinary URL
      const publicId = user.coverPic.split('/').slice(-1)[0].split('.')[0];
      await cloudinary.uploader.destroy(`heron_profiles/${publicId}`);
    }

    user.coverPic = '';
    user.updatedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cover photo removed successfully'
    });

  } catch (error) {
    console.error('Cover photo deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing cover photo',
      error: error.message
    });
  }
});


router.get('/profile-pics', auth, async (req, res) => {
  try {
    const { userIds } = req.query;

    if (!userIds) {
      return res.status(400).json({
        success: false,
        message: 'User IDs are required'
      });
    }

    // Parse userIds from query string
    const userIdArray = userIds.split(',').map(id => id.trim());

    // Fetch users with only necessary fields
    const users = await User.find({
      _id: { $in: userIdArray }
    })
    .select('_id username name profilePic gender email')
    .lean();

    // Format response
    const profilePics = users.reduce((acc, user) => {
      acc[user._id] = {
        profilePic: getSecureUrl(user.profilePic),
        name: user.name,
        gender: user.gender,
        username: user.username || '',
        email: user.email || ''
      };
      return acc;
    }, {});

    console.log(`✅ Fetched ${users.length} profile pictures`);

    res.status(200).json({
      success: true,
      data: profilePics
    });

  } catch (error) {
    console.error('❌ Error fetching profile pictures:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile pictures',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get previous profile/cover images for a user
router.get('/history/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('imageHistory').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, images: user.imageHistory || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching image history' });
  }
});

// Update profile picture from history
router.put('/upload/profile-pic/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'Image url required' });

    const existing = await User.findById(userId).select('profilePic').lean();
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    const update = {
      $set: { profilePic: url, updatedAt: Date.now() }
    };
    if (existing.profilePic) {
      update.$push = {
        imageHistory: {
          $each: [{ type: 'profilePic', url: existing.profilePic, uploadedAt: new Date() }],
          $position: 0
        }
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true, useFindAndModify: false });
    res.status(200).json({ success: true, profilePic: url, user: updatedUser, message: 'Profile photo updated from history' });
  } catch (error) {
    console.error('Error updating profile from history:', error);
    res.status(500).json({ success: false, message: 'Error updating profile photo from history', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

router.put('/upload/cover-pic/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'Image url required' });

    const existing = await User.findById(userId).select('coverPic').lean();
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    const update = {
      $set: { coverPic: url, updatedAt: Date.now() }
    };
    if (existing.coverPic) {
      update.$push = {
        imageHistory: {
          $each: [{ type: 'coverPic', url: existing.coverPic, uploadedAt: new Date() }],
          $position: 0
        }
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true, useFindAndModify: false });
    res.status(200).json({ success: true, coverPic: url, user: updatedUser, message: 'Cover photo updated from history' });
  } catch (error) {
    console.error('Error updating cover from history:', error);
    res.status(500).json({ success: false, message: 'Error updating cover photo from history', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Add this route before module.exports = router;
router.put('/bio/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { bio } = req.body;

    if (typeof bio !== 'string') {
      return res.status(400).json({ success: false, message: 'Bio must be a string' });
    }
    const trimmed = bio.trim();
    if (trimmed.length > 1000) {
      return res.status(400).json({ success: false, message: 'Bio too long (max 1000 chars)' });
    }

    // ensure auth provided a user object / id
    const reqUser = req.user || {};
    const requesterId = reqUser.id || reqUser._id || req.userId || reqUser.userId;
    if (!requesterId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const requesterIdStr = String(requesterId);
    const paramIdStr = String(userId);
    const isAdmin = Boolean(reqUser.isAdmin);

    if (requesterIdStr !== paramIdStr && !isAdmin) {
      console.warn('Forbidden bio update attempt', { requesterId: requesterIdStr, targetUserId: paramIdStr });
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { bio: trimmed, updatedAt: Date.now() } },
      { new: true, select: '-password' }
    );

    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

    const io = req.app.get('io');
    if (io) io.emit('profile:updated', { userId, updates: { bio: updatedUser.bio } });

    res.status(200).json({ success: true, bio: updatedUser.bio, user: updatedUser, message: 'Bio updated' });
  } catch (err) {
    console.error('Error updating bio:', err);
    res.status(500).json({ success: false, message: 'Error updating bio', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

module.exports = router;