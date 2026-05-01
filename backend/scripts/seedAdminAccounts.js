require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/users');

// Validate MongoDB URI
if (!process.env.MONGO_URI) {
  console.error('❌ Error: MONGO_URI not found in environment variables');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Admin accounts to seed with organizations
const ADMIN_ACCOUNTS = [
  {
    username: 'superadmin',
    password: 'superadmin',
    name: 'System Administrator',
    email: 'superadmin@heronfusion.local',
    adminRole: 'super',
    adminOrganization: 'admin@all',
    description: 'Superadmin - Full system access'
  },
  {
    username: 'umakjammers',
    password: 'umakjammers',
    name: 'UMAK Jammers Administrator',
    email: 'admin@umakjammers.local',
    adminRole: 'admin',
    adminOrganization: 'UMAK Jammers',
    description: 'UMAK Jammers Admin'
  },
  {
    username: 'udx',
    password: 'udx',
    name: 'UMAK Dance Extreme Administrator',
    email: 'admin@udx.local',
    adminRole: 'admin',
    adminOrganization: 'UMAK Dance Extreme',
    description: 'UMAK Dance Extreme Admin'
  },
  {
    username: 'utpc',
    password: 'utpc',
    name: 'UTPC Administrator',
    email: 'admin@utpc.local',
    adminRole: 'admin',
    adminOrganization: 'UTPC',
    description: 'UTPC Admin'
  },
  {
    username: 'cast_admin',
    password: 'cast_admin',
    name: 'CAST Administrator',
    email: 'admin@cast.local',
    adminRole: 'admin',
    adminOrganization: 'CAST',
    description: 'CAST Admin'
  },
  {
    username: 'cultura_admin',
    password: 'cultura_admin',
    name: 'CULTURA Administrator',
    email: 'admin@cultura.local',
    adminRole: 'admin',
    adminOrganization: 'CULTURA',
    description: 'CULTURA Admin'
  },
  {
    username: 'umakchorale_admin',
    password: 'umakchorale_admin',
    name: 'UMAK Chorale Administrator',
    email: 'admin@umakchorale.local',
    adminRole: 'admin',
    adminOrganization: 'UMAK Chorale',
    description: 'UMAK Chorale Admin'
  },
  {
    username: 'umaksiglahi_admin',
    password: 'umaksiglahi_admin',
    name: 'UMAK Siglahi Administrator',
    email: 'admin@umaksiglahi.local',
    adminRole: 'admin',
    adminOrganization: 'UMAK Siglahi',
    description: 'UMAK Siglahi Admin'
  },
  {
    username: 'umakbrassband_admin',
    password: 'umakbrassband_admin',
    name: 'UMAK Brass Band Administrator',
    email: 'admin@umakbrassband.local',
    adminRole: 'admin',
    adminOrganization: 'UMAK Brass Band',
    description: 'UMAK Brass Band Admin'
  }
];

// Default admin permissions
const DEFAULT_ADMIN_PERMISSIONS = {
  canManageUsers: false,
  canManageEvents: true,
  canAccessUserMonitoring: true,
  canAccessAnalytics: true,
  canManageSettings: false
};

// Superadmin permissions (all enabled)
const SUPERADMIN_PERMISSIONS = {
  canManageUsers: true,
  canManageEvents: true,
  canAccessUserMonitoring: true,
  canAccessAnalytics: true,
  canManageSettings: true
};

async function seedAdminAccounts() {
  try {
    console.log('\n📋 Starting Admin Accounts Seeding...\n');
    console.log('='.repeat(70));
    console.log('Admin Accounts to be created:');
    console.log('='.repeat(70) + '\n');

    let createdCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const account of ADMIN_ACCOUNTS) {
      try {
        // Check if admin already exists
        const existingUser = await User.findOne({
          $or: [
            { username: account.username.toLowerCase() },
            { email: account.email.toLowerCase() }
          ]
        });

        if (existingUser) {
          console.log(`⏭️  SKIPPED: ${account.username} (already exists)`);
          results.push({
            username: account.username,
            status: 'SKIPPED',
            reason: 'Account already exists'
          });
          skippedCount++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(account.password, 10);

        // Create admin user (admin accounts don't need studentId)
        const adminUser = new User({
          username: account.username.toLowerCase(),
          email: account.email.toLowerCase(),
          password: hashedPassword,
          name: account.name,
          isAdmin: true,
          adminRole: account.adminRole,
          adminOrganization: account.adminOrganization,
          adminPermissions:
            account.adminRole === 'super'
              ? SUPERADMIN_PERMISSIONS
              : DEFAULT_ADMIN_PERMISSIONS,
          interestsSelected: true,
          profileSetup: true,
          gender: 'prefer-not-to-say',
          lastAdminLogin: new Date(),
          bio: account.description
          // Note: studentId is not set for admin accounts - schema allows null when isAdmin=true
        });

        await adminUser.save();

        console.log(
          `✅ CREATED: ${account.username} (${account.adminOrganization})`
        );
        results.push({
          username: account.username,
          status: 'CREATED',
          organization: account.adminOrganization,
          role: account.adminRole
        });
        createdCount++;
      } catch (error) {
        console.log(
          `❌ ERROR: ${account.username} - ${error.message}`
        );
        results.push({
          username: account.username,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Created: ${createdCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${results.filter(r => r.status === 'ERROR').length}`);

    // Print login credentials
    console.log('\n' + '='.repeat(70));
    console.log('🔐 LOGIN CREDENTIALS');
    console.log('='.repeat(70) + '\n');

    for (const account of ADMIN_ACCOUNTS) {
      const result = results.find(r => r.username === account.username);
      if (result?.status === 'CREATED') {
        console.log(`📌 ${account.name}`);
        console.log(`   Username: ${account.username}`);
        console.log(`   Password: ${account.password}`);
        console.log(`   Organization: ${account.adminOrganization}`);
        console.log(`   Role: ${account.adminRole}`);
        console.log('');
      }
    }

    console.log('='.repeat(70));
    console.log('\n✨ Admin seeding completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the seeding function
seedAdminAccounts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
