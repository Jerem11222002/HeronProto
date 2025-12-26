const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const Notification = require("../models/notification");
const authenticateToken = require("../Middleware/authenticateToken");
const router = express.Router();

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
router.get("/relationships/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📥 Fetching relationships for:", userId);

    const user = await User.findById(userId)
      .populate("followers", "_id name username profilePic profilePicture sex")
      .populate("following", "_id name username profilePic profilePicture sex")
      .lean();

    if (!user) {
      console.log("❌ User not found for relationships:", userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const followerMap = new Map((user.followers || []).map(f => [String(f._id), f]));
    const followingMap = new Map((user.following || []).map(f => [String(f._id), f]));

    const mutual = [];
    const followingOnly = [];
    const followersOnly = [];

    (user.following || []).forEach(f => {
      const id = String(f._id);
      const isMutual = followerMap.has(id);
      const item = {
        _id: id,
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || f.profilePicture || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, id)
      };
      if (isMutual) mutual.push(item);
      else followingOnly.push(item);
    });

    (user.followers || []).forEach(f => {
      const id = String(f._id);
      if (followingMap.has(id)) return;
      const item = {
        _id: id,
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || f.profilePicture || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, id)
      };
      followersOnly.push(item);
    });

    console.log(`✅ Relationships: mutual=${mutual.length}, following=${followingOnly.length}, followers=${followersOnly.length}`);
    return res.status(200).json({
      success: true,
      data: {
        mutualFriends: mutual,
        following: followingOnly,
        followers: followersOnly
      }
    });
  } catch (err) {
    console.error("❌ Error fetching relationships:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch relationships", error: err.message });
  }
});

// Add compatibility endpoints expected by frontend (keep BEFORE the "/:id" param route)
router.get("/:id/following", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id).populate("following", "_id name username profilePic profilePicture sex").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const following = (user.following || []).map(f => ({
      _id: String(f._id),
      name: f.name || "",
      username: f.username || "",
      sex: f.sex || null,
      profilePic: f.profilePic || f.profilePicture || getDefaultProfilePic(f.sex),
      isOnline: getOnlineStatus(req, String(f._id))
    }));

    return res.status(200).json(following);
  } catch (err) {
    console.error("❌ Error fetching following:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch following", error: err.message });
  }
});

router.get("/:id/followers", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id).populate("followers", "_id name username profilePic profilePicture sex").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const followers = (user.followers || []).map(f => ({
      _id: String(f._id),
      name: f.name || "",
      username: f.username || "",
      sex: f.sex || null,
      profilePic: f.profilePic || f.profilePicture || getDefaultProfilePic(f.sex),
      isOnline: getOnlineStatus(req, String(f._id))
    }));

    return res.status(200).json(followers);
  } catch (err) {
    console.error("❌ Error fetching followers:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch followers", error: err.message });
  }
});

router.get("/:id/mutual-friends", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id)
      .populate("followers", "_id")
      .populate("following", "_id name username profilePic profilePicture sex")
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const followerIds = new Set((user.followers || []).map(f => String(f._id)));
    const mutual = (user.following || [])
      .filter(f => followerIds.has(String(f._id)))
      .map(f => ({
        _id: String(f._id),
        name: f.name || "",
        username: f.username || "",
        sex: f.sex || null,
        profilePic: f.profilePic || f.profilePicture || getDefaultProfilePic(f.sex),
        isOnline: getOnlineStatus(req, String(f._id))
      }));

    return res.status(200).json(mutual);
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
      notificationCreated: true
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

    // Emit socket event for unfollow
    const io = req.app.get('io');
    io.emit('follow:updated', {
      followerId: currentUser._id,
      followedId: userToUnfollow._id,
      action: 'unfollow'
    });

    console.log("✅ Unfollow successful:", {
      unfollower: currentUser._id,
      unfollowed: userToUnfollow._id
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

module.exports = router;