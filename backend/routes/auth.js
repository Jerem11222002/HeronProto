const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require("../models/users");
const Interest = require('../models/interest');
const authenticateToken = require('../Middleware/authenticateToken');
const router = express.Router();

// Determine frontend URL based on environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';


const VALID_INTERESTS = [
  'music',
  'dance',
  'theatre',
  'cultural-arts',
  'vocal-arts',
  'modern-music',
  'traditional-arts',
  'instruments',
  'visual-arts',
  'painting',
  'artwork',
  'canvas',
  'digital-art',
  'technical-production',
  'creatives',
  'multimedia',
  'design',
  'graphics',
  'performance',
  // new ones to match frontend
  'photography',
  'film',
  'fashion',
  'writing',
  'sculpture',
  'animation',
  'photogrammetry'
];

const ORGANIZATION_INTERESTS = {
  'UMAK Chorale': ['music', 'vocal-arts'],
  'UMAK Jammers': ['music', 'modern-music'],
  'CAST': ['theatre'],
  'CULTURA': ['cultural-arts', 'dance'],
  'UMAK Dance Extreme': ['dance'],
  'UMAK Siglahi': ['dance', 'traditional-arts'],
  'UMAK Brass Band': ['music', 'instruments']
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not defined in environment variables.");
  process.exit(1);
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/profiles");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Only JPEG, PNG and GIF allowed."), false);
    }
    cb(null, true);
  }
});

// Configure email transporter (prefer SMTP config, fall back to Gmail or JSON for dev)
let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: (process.env.SMTP_SECURE === 'true') || false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.info('Email transporter: using SMTP host', process.env.SMTP_HOST);
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  console.info('Email transporter: using Gmail service for', process.env.EMAIL_USER);
} else {
  // No real email credentials — use jsonTransport so code paths work in dev
  transporter = nodemailer.createTransport({ jsonTransport: true });
  console.warn('Email transporter: no SMTP/EMAIL credentials found — using jsonTransport (dev only)');
}

// Optional: verify transporter at startup and log result
transporter.verify()
  .then(() => console.info('✅ Email transporter verified'))
  .catch((err) => console.warn('⚠️ Email transporter verification failed:', err && err.message));

// Helper: Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "24h" });
};

// Helper: Sanitize User Data
const getDefaultProfilePic = (sex) => 
  sex === 'female' ? '/assets/person/Female.jpg' : '/assets/person/Male.jpg';

const sanitizeUser = (user) => {
  if (!user) return null;
  // normalize student id aliases
  const studentId = user.studentId || user.studentID || user.student_id || user.student_number || null;
  return {
    id: user._id,
    _id: user._id,
    username: user.username,
    email: user.email,
    name: user.name,
    gender: user.gender,
    studentId,
    profilePicture: user.profilePicture || getDefaultProfilePic(user.gender),
    profilePic: user.profilePic || user.profilePicture || getDefaultProfilePic(user.gender),
    profileSetup: Boolean(user.profileSetup),
    interests: user.interests,
    relatedOrganizations: user.relatedOrganizations,
    interestsSelected: Boolean(user.interestsSelected),
    // include customization so client can read saved theme/language
    customization: user.customization || {}
  };
};

// Register Route
// First, let's update the validation part in the interests route
router.post("/interests", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { interests } = req.body;
    if (!interests || !Array.isArray(interests)) {
      return res.status(400).json({ success: false, message: "Invalid interests format" });
    }

    // Normalize requested slugs
    const requested = interests.map(i => (typeof i === 'object' ? i.id : i).toString().trim().toLowerCase());

    // Fetch approved interests from DB
    const approved = await Interest.find({ slug: { $in: requested }, approved: true }).lean();
    const approvedSlugs = new Set(approved.map(a => a.slug));

    // Determine which requested are not yet in approved list
    const missing = requested.filter(s => !approvedSlugs.has(s));

    // Option: auto-create missing as proposals so users can still select them
    if (missing.length > 0) {
      const upserts = missing.map(s => ({
        updateOne: {
          filter: { slug: s },
          update: { $setOnInsert: { slug: s, name: s, approved: false, createdBy: req.user.id } },
          upsert: true
        }
      }));
      await Interest.bulkWrite(upserts);
      // optionally notify admins or set auto-approve rules
    }

    // Final interests to save on user: keep requested (server trusts user choice)
    const interestValues = requested;

    // Update user safely
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.interests = interestValues;
    user.relatedOrganizations = user.relatedOrganizations || [];
    user.interestsSelected = true;
    await user.save();

    // invalidate interests cache (optional)
    // ...existing code...
    return res.status(200).json({ success: true, message: "Interests saved successfully", user: sanitizeUser(user) });
  } catch (error) {
    console.error("Error saving interests:", error);
    return res.status(500).json({ success: false, message: "Failed to save interests", error: error.message });
  }
});


router.post("/skip-interests", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Skipping interests for user:", userId);

    // Use findOneAndUpdate to ensure atomic update
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { 
        $set: { 
          interestsSelected: true,
          interests: [] 
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    console.log("Interests skipped successfully for user:", userId);
    
    res.status(200).json({
      success: true,
      message: "Interests selection skipped",
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error("Error skipping interests:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to skip interests",
      error: error.message 
    });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Login attempt for:", username);

    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      console.log("User not found:", username);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      console.log("Password validation failed for user:", username);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = generateToken(user._id);
    console.log("Login successful for user:", username);
    
    // sanitize user for response and use its id for settings lookup
    const sanitizedUser = sanitizeUser(user);
    // attach canonical settings so frontend can apply user preferences immediately
    const settings = await User.getSettingsById(sanitizedUser.id);
    return res.json({
      success: true,
      token,
      user: sanitizedUser,
      settings
    });
 
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Logout Route
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Logout attempt for user:", userId);

    // Optional: Add token to blacklist
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // Add to blacklist logic here if needed
      console.log("Token invalidated:", token.substring(0, 10) + "...");
    }

    res.status(200).json({ 
      success: true,
      message: "Logged out successfully" 
    });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ 
      success: false,
      message: "Logout failed",
      error: error.message 
    });
  }
});


router.post("/setup-profile", authenticateToken, upload.single("profilePicture"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio } = req.body;
    
    const updateData = {
      name: name.trim(),
      bio: bio?.trim(),
      profileSetup: true,
      interestsSelected: true // Ensure interests flag is maintained
    };

    if (req.file) {
      updateData.profilePicture = `/uploads/profiles/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    res.json({
      success: true,
      message: "Profile setup complete",
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error("Profile setup error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to setup profile",
      error: error.message 
    });
  }
});

// Verify token route
router.get("/verify", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ message: "Token verification failed" });
  }
});

router.post("/register", async (req, res) => {
  try {
    // Add studentId here
    const { username, studentId, email, password, name, gender } = req.body;
    console.log("Registration attempt for:", { username, studentId, email, name, gender });

    if (!username || !studentId || !email || !password || !name || !gender) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({
      $or:
      [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
        { studentId: studentId.trim() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        message: existingUser.username.toLowerCase() === username.toLowerCase()
          ? "Username already taken"
          : existingUser.email.toLowerCase() === email.toLowerCase()
            ? "Email already registered"
            : "Student ID already registered"
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const defaultProfilePicture = gender === 'female'
      ? '/assets/person/Female.jpg'
      : gender === 'male'
        ? '/assets/person/Male.jpg'
        : '/assets/person/Default.jpg';

    // Add studentId here
    const newUser = new User({
      username: username.toLowerCase(),
      studentId: studentId.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      gender,
      profilePicture: defaultProfilePicture,
      interestsSelected: false,
      profileSetup: false,
      interests: []
    });

    const savedUser = await newUser.save();
    const token = generateToken(savedUser._id);

    res.status(201).json({
      message: "Account successfully registered",
      user: sanitizeUser(savedUser),
      token
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Registration failed",
      error: error.message
    });
  }
});

router.post("/update-setup", authenticateToken, async (req, res) => {
  try {
    const { interestsSelected, profileSetup } = req.body;
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          interestsSelected: !!interestsSelected,
          profileSetup: !!profileSetup
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({ 
      success: true, 
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    console.error("Setup update error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update setup status" 
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * User enters email → send reset link
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordResetToken +passwordResetExpires');
    
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return res.status(200).json({ 
        success: true, 
        message: 'If an account exists, a reset link has been sent to your email.' 
      });
    }

    // Generate reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expiry (24 hours)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Verify token was saved
    const savedUser = await User.findById(user._id).select('+passwordResetToken +passwordResetExpires');
    console.log('🔐 Token saved check:', {
      tokenHash: resetTokenHash.substring(0, 10) + '...',
      savedTokenHash: savedUser.passwordResetToken ? savedUser.passwordResetToken.substring(0, 10) + '...' : 'NOT SAVED',
      expiresAt: user.passwordResetExpires,
      expiresIn: new Date(user.passwordResetExpires - Date.now()) 
    });

    // Build reset URL (frontend will handle this)
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@heronFusion.com',
      to: email,
      subject: 'Heron Fusion - Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name || user.username},</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't request this, ignore this email.</p>
        <p>Best,<br/>Heron Fusion Team</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log('✅ Password reset email sent to:', email);

    res.status(200).json({
      success: true,
      message: 'If an account exists, a reset link has been sent to your email.'
    });
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/reset-password
 * User provides token + new password → reset password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    if (!token || !email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, email, password, and confirmation are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token and unexpired expiry
    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: new Date() }
    }).select('+password +passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear reset token fields
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();

    console.log('✅ Password reset successful for:', email);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/auth/verify-reset-token
 * Check if reset token is valid (optional, for frontend validation)
 */
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Token and email are required'
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    console.log('🔍 Verifying token:', {
      email: email.toLowerCase(),
      tokenHashSearch: resetTokenHash.substring(0, 10) + '...',
      currentTime: new Date(),
      tokenLength: token.length
    });

    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');

    console.log('🔎 User found:', user ? `Yes (${user._id})` : 'No');
    
    if (user) {
      console.log('📅 Token expiry check:', {
        expiresAt: user.passwordResetExpires,
        now: new Date(),
        isExpired: user.passwordResetExpires <= new Date()
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid'
    });
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
});

/**
 * Export router
 */
module.exports = router;