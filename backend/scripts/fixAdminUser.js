require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/users');

async function fixAdminUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // --- Update superadmin ---
    const superAdmin = await User.findOne({ username: 'superadmin' });
    if (superAdmin) {
      const superUpdates = {
        isAdmin: true,
        adminRole: 'super',
        adminPermissions: {
          canManageUsers: true,
          canManageEvents: true,
          canModerateContent: true,
          canAccessAnalytics: true,
          canManageSettings: true
        },
        interestsSelected: true,
        profileSetup: true,
        gender: 'prefer-not-to-say',
        interests: [],
        customization: {
          theme: 'system',
          language: 'en',
          visibility: 'public'
        },
        profilePic: '/assets/person/Default.jpg',
        coverPic: '/default-cover.png'
      };

      const updatedSuper = await User.findByIdAndUpdate(
        superAdmin._id,
        { $set: superUpdates },
        { new: true, runValidators: true }
      );

      console.log('✅ Superadmin updated:', {
        username: updatedSuper.username,
        role: updatedSuper.adminRole,
        permissions: updatedSuper.adminPermissions
      });
    } else {
      console.warn('⚠️ Superadmin user not found');
    }

    // --- Update admin ---
    const admin = await User.findOne({ username: 'admin' });
    if (admin) {
      const adminUpdates = {
        isAdmin: true,
        adminRole: 'admin',
        adminPermissions: {
          canManageUsers: true,      // participants
          canManageEvents: true,     // events
          canModerateContent: false, // cannot moderate content
          canAccessAnalytics: false, // cannot access analytics
          canManageSettings: true    // can access settings
        },
        interestsSelected: true,
        profileSetup: true,
        gender: 'prefer-not-to-say',
        interests: [],
        customization: {
          theme: 'system',
          language: 'en',
          visibility: 'public'
        },
        profilePic: '/assets/person/Default.jpg',
        coverPic: '/default-cover.png'
      };

      const updatedAdmin = await User.findByIdAndUpdate(
        admin._id,
        { $set: adminUpdates },
        { new: true, runValidators: true }
      );

      console.log('✅ Admin updated:', {
        username: updatedAdmin.username,
        role: updatedAdmin.adminRole,
        permissions: updatedAdmin.adminPermissions
      });
    } else {
      console.warn('⚠️ Admin user not found');
    }

    // --- Update admin1 ---
    const admin1 = await User.findOne({ username: 'admin1' });
    if (admin1) {
      const admin1Updates = {
        isAdmin: true,
        adminRole: 'admin',
        adminPermissions: {
          canManageUsers: true,      // participants
          canManageEvents: true,     // events
          canModerateContent: false, // cannot moderate content
          canAccessAnalytics: false, // cannot access analytics
          canManageSettings: true    // can access settings
        },
        interestsSelected: true,
        profileSetup: true,
        gender: 'prefer-not-to-say',
        customization: {
          theme: 'system',
          language: 'en',
          visibility: 'public'
        },
        profilePic: '/assets/person/Default.jpg',
        coverPic: '/default-cover.png'
      };

      const updatedAdmin1 = await User.findByIdAndUpdate(
        admin1._id,
        { $set: admin1Updates },
        { new: true, runValidators: true }
      );

      console.log('✅ Admin1 updated:', {
        username: updatedAdmin1.username,
        role: updatedAdmin1.adminRole,
        permissions: updatedAdmin1.adminPermissions
      });
    } else {
      console.warn('⚠️ Admin1 user not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('📝 Disconnected from MongoDB');
    }
  }
}

fixAdminUsers().catch(console.error);