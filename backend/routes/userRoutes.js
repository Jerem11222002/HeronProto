const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const Notification = require("../models/notification");
const authenticateToken = require("../Middleware/authenticateToken");
const multer = require('multer');
const mongoose = require('mongoose');
const relationshipCache = require('../services/relationshipCache');
const notificationCache = require('../services/notificationCache');
const router = express.Router();

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'backend/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not defined in environment variables.");
  process.exit(1);
}

// Helper Functions
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "24h" });
};

const getOnlineStatus = (req, userId) => {
  const onlineUsers = req.app.get('onlineUsers');
  return onlineUsers && onlineUsers.has(userId.toString());
};

const getDefaultProfilePic = (sex) => {
  return sex === 'female' ? '/assets/person/Female.jpg' : '/assets/person/Male.jpg';
};

/**
 * Split relationships using raw following/followers id arrays (matches UserSchema virtuals).
 * Intersecting two $lookup result sets could show mutual=0 when ids overlap but lookups dropped rows
 * (deleted users, type quirks). Mutual = following ∩ followers on stored arrays, then resolve profiles.
 */
async function computeAndCacheRelationships(userId, req) {
  const user = await User.findById(userId).select('following followers').lean();
  if (!user) {
    return null;
  }

  const followingIds = (user.following || []).map((id) => String(id));
  const followerIdsRaw = user.followers || [];
  const followersSet = new Set(followerIdsRaw.map((id) => String(id)));
  const followingSet = new Set(followingIds);

  const mutualIds = followingIds.filter((id) => followersSet.has(id));
  const followingOnlyIds = followingIds.filter((id) => !followersSet.has(id));
  const followersOnlyIds = followerIdsRaw
    .map((id) => String(id))
    .filter((id) => !followingSet.has(id));

  const allIdStrs = [...new Set([...mutualIds, ...followingOnlyIds, ...followersOnlyIds])].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  const oidList = allIdStrs.map((id) => new mongoose.Types.ObjectId(id));

  let userDocs = [];
  if (oidList.length > 0) {
    userDocs = await User.find({ _id: { $in: oidList } })
      .select('_id name username sex profilePic profilePicture')
      .lean();
  }

  const byId = new Map(userDocs.map((u) => [String(u._id), u]));

  const toItem = (idStr) => {
    const u = byId.get(idStr);
    if (!u) return null;
    return {
      _id: idStr,
      name: u.name || '',
      username: u.username || '',
      sex: u.sex || null,
      profilePic: u.profilePic || u.profilePicture || getDefaultProfilePic(u.sex),
      isOnline: getOnlineStatus(req, idStr)
    };
  };

  const mutual = mutualIds.map(toItem).filter(Boolean);
  const followingOnly = followingOnlyIds.map(toItem).filter(Boolean);
  const followersOnly = followersOnlyIds.map(toItem).filter(Boolean);

  const fullResults = { mutual, followingOnly, followersOnly };
  relationshipCache.set(userId, 'both', fullResults);
  return fullResults;
}

// <-- Move this /me route BEFORE the param-based "/:id" route
router.get('/me', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching user: me');
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) {
      console.log('❌ User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found.' });
    }

    const userData = {
      ...user,
      // ensure studentId always present on /me
      studentId: user.studentId || user.studentID || user.student_number || null,
      isOnline: getOnlineStatus(req, user._id),
      profilePic: user.profilePic || user.profilePicture || getDefaultProfilePic(user.sex),
      profilePicture: user.profilePicture || user.profilePic || getDefaultProfilePic(user.sex)
    };

    console.log('✅ /me -> User found:', user._id);
    res.status(200).json(userData);
  } catch (err) {
    console.error('❌ Error fetching user (me):', err);
    res.status(500).json({ message: 'Failed to fetch user data.' });
  }
});

// Consolidated relationships endpoint (mutual, following-only, followers-only)
// OPTIMIZED: Uses aggregation pipeline with pagination and caching
router.get("/relationships/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const cacheKey = `${userId}:full`;
    
    // Check cache first
    const cachedResult = relationshipCache.get(userId, 'both');
    if (cachedResult && !cachedResult.expired) {
      console.log(`📦 [CACHE HIT] Relationships for ${userId}`);
      // Apply pagination to cached data
      const fullData = cachedResult.data;
      const paginated = {
        success: true,
        data: {
          mutualFriends: fullData.mutual.slice(skip, skip + limit),
          following: fullData.followingOnly.slice(skip, skip + limit),
          followers: fullData.followersOnly.slice(skip, skip + limit)
        },
        pagination: {
          page,
          limit,
          totalMutual: fullData.mutual.length,
          totalFollowing: fullData.followingOnly.length,
          totalFollowers: fullData.followersOnly.length,
          cached: true,
          cacheAge: cachedResult.age
        }
      };
      return res.status(200).json(paginated);
    }

    console.log("📥 Fetching relationships for:", userId);

    const fullResults = await computeAndCacheRelationships(userId, req);
    if (!fullResults) {
      console.log("❌ User not found for relationships:", userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { mutual, followingOnly, followersOnly } = fullResults;

    console.log(`✅ Relationships: mutual=${mutual.length}, following=${followingOnly.length}, followers=${followersOnly.length}`);
    
    // Return paginated results
    return res.status(200).json({
      success: true,
      data: {
        mutualFriends: mutual.slice(skip, skip + limit),
        following: followingOnly.slice(skip, skip + limit),
        followers: followersOnly.slice(skip, skip + limit)
      },
      pagination: {
        page,
        limit,
        totalMutual: mutual.length,
        totalFollowing: followingOnly.length,
        totalFollowers: followersOnly.length,
        cached: false
      }
    });
  } catch (err) {
    console.error("❌ Error fetching relationships:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch relationships", error: err.message });
  }
});

// Add compatibility endpoints expected by frontend (keep BEFORE the "/:id" param route)
// OPTIMIZED: Using aggregation pipeline with pagination and caching
router.get("/:id/following", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20)); // Max 50, default 20
    const skip = (page - 1) * limit;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Check cache first
    const cachedResult = relationshipCache.get(id, 'following');
    if (cachedResult && !cachedResult.expired) {
      console.log(`📦 [CACHE HIT] Following for ${id}`);
      const following = cachedResult.data;
      const paginated = following.slice(skip, skip + limit).map(f => ({
        _id: String(f._id),
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, String(f._id))
      }));

      return res.status(200).json({
        success: true,
        data: paginated,
        pagination: {
          page,
          limit,
          total: following.length,
          cached: true,
          cacheAge: cachedResult.age
        }
      });
    }

    const results = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "users",
          let: { followingIds: "$following" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$followingIds"] } } },
            { $project: { _id: 1, name: 1, username: 1, sex: 1, profilePic: 1, profilePicture: 1 } }
          ],
          as: "followingList"
        }
      }
    ]);

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const followingList = results[0].followingList || [];
    
    // Cache the full results
    relationshipCache.set(id, 'following', followingList);

    const following = followingList
      .slice(skip, skip + limit)
      .map(f => ({
        _id: String(f._id),
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, String(f._id))
      }));

    return res.status(200).json({
      success: true,
      data: following,
      pagination: {
        page,
        limit,
        total: followingList.length,
        cached: false
      }
    });
  } catch (err) {
    console.error("❌ Error fetching following:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch following", error: err.message });
  }
});

// OPTIMIZED: Using aggregation pipeline with pagination and caching
router.get("/:id/followers", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20)); // Max 50, default 20
    const skip = (page - 1) * limit;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Check cache first
    const cachedResult = relationshipCache.get(id, 'followers');
    if (cachedResult && !cachedResult.expired) {
      console.log(`📦 [CACHE HIT] Followers for ${id}`);
      const followers = cachedResult.data;
      const paginated = followers.slice(skip, skip + limit).map(f => ({
        _id: String(f._id),
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, String(f._id))
      }));

      return res.status(200).json({
        success: true,
        data: paginated,
        pagination: {
          page,
          limit,
          total: followers.length,
          cached: true,
          cacheAge: cachedResult.age
        }
      });
    }

    const results = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "users",
          let: { followerIds: "$followers" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$followerIds"] } } },
            { $project: { _id: 1, name: 1, username: 1, sex: 1, profilePic: 1, profilePicture: 1 } }
          ],
          as: "followersList"
        }
      }
    ]);

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const followersList = results[0].followersList || [];
    
    // Cache the full results
    relationshipCache.set(id, 'followers', followersList);

    const followers = followersList
      .slice(skip, skip + limit)
      .map(f => ({
        _id: String(f._id),
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, String(f._id))
      }));

    return res.status(200).json({
      success: true,
      data: followers,
      pagination: {
        page,
        limit,
        total: followersList.length,
        cached: false
      }
    });
  } catch (err) {
    console.error("❌ Error fetching followers:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch followers", error: err.message });
  }
});

router.get("/:id/mutual-friends", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    let cached = relationshipCache.get(id, "both");
    let mutual;
    if (cached && !cached.expired) {
      mutual = cached.data.mutual;
    } else {
      const full = await computeAndCacheRelationships(id, req);
      if (!full) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      mutual = full.mutual;
    }

    const out = mutual.map((m) => ({
      _id: String(m._id),
      name: m.name || "",
      username: m.username || "",
      sex: m.sex || null,
      profilePic: m.profilePic || getDefaultProfilePic(m.sex),
      isOnline: getOnlineStatus(req, String(m._id))
    }));

    return res.status(200).json(out);
  } catch (err) {
    console.error("❌ Error fetching mutual friends:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch mutual friends", error: err.message });
  }
});

// --- keep the param-based route AFTER the relationships route ---
// Get user by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching user:", req.params.id);
    const id = req.params.id.trim();

    const user = await User.findById(id)
      // Add coverPic to selected fields
      .select("studentId name username profilePic profilePicture sex followers following bio coverPic")
      .lean();

    if (!user) {
      console.log("❌ User not found:", id);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData = {
      ...user,
      studentId: user.studentId || user.studentID || user.student_number || null,
      isOnline: getOnlineStatus(req, user._id || id),
      profilePic: user.profilePic || user.profilePicture || getDefaultProfilePic(user.sex),
      profilePicture: user.profilePicture || user.profilePic || getDefaultProfilePic(user.sex),
      // Ensure bio and cover are included
      bio: user.bio || "",
      coverPic: user.coverPic || "" 
    };

    return res.status(200).json({ success: true, data: userData });
  } catch (err) {
    console.error("❌ Error fetching user:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch user", error: err.message });
  }
});

// Follow user
router.post("/follow/:userId", authenticateToken, async (req, res) => {
  try {
    if (req.params.userId === req.user._id) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const [userToFollow, currentUser] = await Promise.all([
      User.findById(req.params.userId),
      User.findById(req.user._id)
    ]);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already following
    if (currentUser.following.includes(userToFollow._id)) {
      return res.status(200).json({ 
        success: true,
        message: "Already following this user",
        isMutualFollow: userToFollow.following.includes(currentUser._id)
      });
    }

    // Perform follow action
    await Promise.all([
      currentUser.updateOne({ $push: { following: userToFollow._id } }),
      userToFollow.updateOne({ $push: { followers: currentUser._id } })
    ]);

    // INVALIDATE CACHE: Clear relationship caches for both users
    relationshipCache.invalidateOnChange(String(currentUser._id), String(userToFollow._id));

    // Create follow notification
    const notification = await Notification.create({
      userId: userToFollow._id,
      senderId: currentUser._id,
      type: 'follow',
      message: `started following you`,
      category: 'social',
      data: {
        followerName: currentUser.name,
        followerPicture: currentUser.profilePicture || getDefaultProfilePic(currentUser.sex)
      }
    });

    // INVALIDATE CACHE: Clear notification cache for the follower
    notificationCache.invalidateOnNewNotification(String(userToFollow._id));

    // Check for mutual follow
    const isMutualFollow = userToFollow.following.includes(currentUser._id);

    // If it's a mutual follow, create another notification
    if (isMutualFollow) {
      const mutualNotification = await Notification.create({
        userId: currentUser._id,
        senderId: userToFollow._id,
        type: 'follow_accept',
        message: `accepted your follow request`,
        category: 'social',
        data: {
          followerName: userToFollow.name,
          followerPicture: userToFollow.profilePicture || getDefaultProfilePic(userToFollow.sex)
        }
      });

      // INVALIDATE CACHE: Clear notification cache for current user
      notificationCache.invalidateOnNewNotification(String(currentUser._id));
    }

    // Prepare user data for response
    const userData = {
      _id: userToFollow._id,
      name: userToFollow.name,
      profilePicture: userToFollow.profilePicture || getDefaultProfilePic(userToFollow.sex),
      sex: userToFollow.sex,
      isOnline: getOnlineStatus(req, userToFollow._id)
    };

    // Emit socket events
    const io = req.app.get('io');
    
    // Follow update event
    io.emit('follow:updated', {
      followerId: currentUser._id,
      followedId: userToFollow._id,
      action: 'follow',
      userData,
      isMutualFollow
    });

    // Emit notification events
    io.emit('notification:new', {
      userId: userToFollow._id,
      notification
    });

    if (isMutualFollow) {
      io.emit('notification:new', {
        userId: currentUser._id,
        type: 'follow_accept',
        notification: mutualNotification
      });
    }

    console.log("✅ Follow successful:", {
      follower: currentUser._id,
      following: userToFollow._id,
      isMutualFollow,
      notificationCreated: true,
      cacheInvalidated: true
    });

    res.status(200).json({ 
      success: true,
      message: "User followed successfully",
      user: userData,
      isMutualFollow
    });
  } catch (error) {
    console.error("❌ Follow error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to follow user",
      error: error.message 
    });
  }
});

// Unfollow user
router.post("/unfollow/:userId", authenticateToken, async (req, res) => {
  try {
    if (req.params.userId === req.user._id) {
      return res.status(400).json({ message: "Cannot unfollow yourself" });
    }

    const [userToUnfollow, currentUser] = await Promise.all([
      User.findById(req.params.userId),
      User.findById(req.user._id)
    ]);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!currentUser.following.includes(userToUnfollow._id)) {
      return res.status(400).json({ message: "Not following this user" });
    }

    await Promise.all([
      currentUser.updateOne({ $pull: { following: userToUnfollow._id } }),
      userToUnfollow.updateOne({ $pull: { followers: currentUser._id } })
    ]);

    // INVALIDATE CACHE: Clear relationship caches for both users
    relationshipCache.invalidateOnChange(String(currentUser._id), String(userToUnfollow._id));

    // Emit socket event for unfollow
    const io = req.app.get('io');
    io.emit('follow:updated', {
      followerId: currentUser._id,
      followedId: userToUnfollow._id,
      action: 'unfollow'
    });

    console.log("✅ Unfollow successful:", {
      unfollower: currentUser._id,
      unfollowed: userToUnfollow._id,
      cacheInvalidated: true
    });

    res.status(200).json({ 
      success: true,
      message: "User unfollowed successfully" 
    });
  } catch (error) {
    console.error("❌ Unfollow error:", error);
    res.status(500).json({ message: "Failed to unfollow user" });
  }
});

// Batch fetch users by IDs
router.post("/batch", authenticateToken, async (req, res) => {
  console.log("Batch endpoint called with IDs:", req.body.ids);
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No user IDs provided." });
    }

    // include studentId in the returned fields
    const users = await User.find({ _id: { $in: ids } })
      .select("_id name username profilePic profilePicture sex studentId")
      .lean();

    // Add online status and default profile picture
    const usersWithStatus = users.map(user => ({
      ...user,
      studentId: user.studentId || user.studentID || null,
      isOnline: getOnlineStatus(req, user._id),
      profilePic: user.profilePic || user.profilePicture || getDefaultProfilePic(user.sex)
    }));

    res.status(200).json(usersWithStatus);
  } catch (error) {
    console.error("❌ Batch fetch error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Update user settings (username, email, password, theme, language, etc.)
router.post('/settings', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    console.log('\n📥 ============ SETTINGS.UPDATE REQUEST ============');
    console.log('📥 Request received at:', new Date().toISOString());
    console.log('📥 User ID:', req.user.id);
    console.log('📥 Has file:', !!req.file);
    if (req.file) {
      console.log('📥 File info:', { fieldname: req.file.fieldname, filename: req.file.filename, size: req.file.size });
    }
    console.log('📥 Body keys:', Object.keys(req.body || {}));
    console.log('📥 Raw body:', {
      username: req.body.username || '(not provided)',
      email: req.body.email || '(not provided)',
      currentPassword: req.body.currentPassword ? '(provided)' : '(not provided)',
      newPassword: req.body.newPassword ? '(provided)' : '(not provided)',
      confirmPassword: req.body.confirmPassword ? '(provided)' : '(not provided)',
      theme: req.body.theme || '(not provided)',
      language: req.body.language || '(not provided)',
      privacy: req.body.privacy || '(not provided)',
      notifications: req.body.notifications || '(not provided)'
    });

    const userId = req.user.id;
    let { username, email, currentPassword, newPassword, theme, language, privacy, notifications } = req.body;

    // Trim all string inputs immediately
    username = username ? String(username).trim() : '';
    email = email ? String(email).trim() : '';
    currentPassword = currentPassword ? String(currentPassword).trim() : '';
    newPassword = newPassword ? String(newPassword).trim() : '';
    
    console.log('📥 After trimming:', {
      username: username || '(empty)',
      email: email || '(empty)',
      currentPassword: currentPassword ? '(provided, length: ' + currentPassword.length + ')' : '(empty)',
      newPassword: newPassword ? '(provided, length: ' + newPassword.length + ')' : '(empty)',
      theme,
      language,
      privacy,
      notifications: notifications ? '(provided)' : '(not provided)'
    });

    // Fetch current user
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ message: 'User not found.' });
    }
    console.log('✅ User found:', userId);

    // If password change is requested, validate current password
    if (newPassword) {
      console.log('🔐 ========== PASSWORD CHANGE REQUESTED ==========');
      
      if (!currentPassword) {
        console.warn('⚠️ Password change requested without current password');
        return res.status(400).json({ message: 'Current password is required to change password.' });
      }

      if (!user.password) {
        console.error('❌ User has no password hash stored');
        return res.status(500).json({ message: 'Password validation failed: no password on file.' });
      }

      try {
        console.log('🔐 Starting bcrypt comparison...');
        console.log('🔐 currentPassword type:', typeof currentPassword);
        console.log('🔐 currentPassword length:', currentPassword.length);
        console.log('🔐 user.password type:', typeof user.password);
        console.log('🔐 user.password length:', user.password.length);
        console.log('🔐 user.password starts with:', user.password.substring(0, 20) + '...');
        
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        console.log('✅ bcrypt.compare() returned:', isPasswordValid);
        
        if (!isPasswordValid) {
          console.warn('⚠️ Current password incorrect for user:', userId);
          return res.status(401).json({ message: 'Current password is incorrect.' });
        }
        
        console.log('✅ Password verified successfully');
        console.log('🔐 Setting new password (will be auto-hashed by pre-save hook)...');
        // DO NOT hash here - the pre-save hook will do it automatically
        user.password = newPassword;
        console.log('✅ New password set (will be hashed on save)');
      } catch (bcryptErr) {
        console.error('❌ Bcrypt error:', bcryptErr.message);
        console.error('❌ Bcrypt error type:', bcryptErr.constructor.name);
        console.error('❌ Bcrypt error stack:', bcryptErr.stack);
        return res.status(500).json({ message: 'Password validation failed: ' + bcryptErr.message });
      }
    }

    // Update basic fields
    console.log('📝 ========== UPDATING BASIC FIELDS ==========');
    if (username) {
      user.username = username;
      console.log('✅ Username updated to:', username);
    }
    if (email) {
      user.email = email;
      console.log('✅ Email updated to:', email);
    }

    // Handle profile picture upload
    if (req.file) {
      user.profilePic = `/uploads/${req.file.filename}`;
      console.log('✅ Profile picture updated to:', user.profilePic);
    }

    // Update customization settings
    console.log('🎨 ========== UPDATING CUSTOMIZATION ==========');
    if (!user.customization) {
      user.customization = {};
      console.log('✅ Created customization object');
    }
    if (theme) {
      user.customization.theme = theme;
      console.log('✅ Theme updated to:', theme);
    }
    if (language) {
      user.customization.language = language;
      console.log('✅ Language updated to:', language);
    }
    if (privacy) {
      user.privacy = privacy;
      console.log('✅ Privacy updated to:', privacy);
    }

    // Update notifications
    console.log('🔔 ========== UPDATING NOTIFICATIONS ==========');
    if (notifications) {
      try {
        const notifObj = typeof notifications === 'string' ? JSON.parse(notifications) : notifications;
        user.notifications = notifObj;
        console.log('✅ Notifications updated:', notifObj);
      } catch (e) {
        console.error('⚠️ Error parsing notifications:', e.message);
        console.warn('⚠️ Notifications value was:', notifications);
      }
    }

    // Save user
    console.log('💾 ========== SAVING USER ==========');
    await user.save();
    console.log('✅ User saved successfully to database');

    // Return updated user data (without password)
    const updatedUser = await User.findById(userId).select('-password').lean();
    console.log('✅ Updated user retrieved for response');
    console.log('📤 ========== SENDING RESPONSE ==========');
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully.',
      ...updatedUser,
      theme: updatedUser.customization?.theme || 'light',
      profilePic: updatedUser.profilePic || user.profilePic
    });
    console.log('✅ Response sent successfully\n');
  } catch (error) {
    console.error('❌ ========== ERROR IN SETTINGS UPDATE ==========');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ message: 'Failed to update settings.', error: error.message });
  }
});

// Delete user account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find and delete user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Failed to delete account.', error: error.message });
  }
});

module.exports = router;