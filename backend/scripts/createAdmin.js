require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/users');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

async function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createSuperAdmin() {
  try {
    console.clear(); // Clear console for better visibility
    console.log('\n=== Create Super Admin Account for Heron Fusion ===\n');

    const username = await question('Enter admin username: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password (min 6 characters): ');
    const name = await question('Enter admin full name: ');

    // Validate inputs
    if (!username || !email || !password || !name) {
      throw new Error('All fields are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check if admin already exists
    const existingUser = await User.findOne({ 
      $or: [
        { username: username.toLowerCase() }, 
        { email: email.toLowerCase() }
      ] 
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Create super admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const adminUser = new User({
  username: username.toLowerCase(),
  email: email.toLowerCase(),
  password: hashedPassword,
  name,
  isAdmin: true,
  adminRole: 'admin', // <-- standard admin
  adminPermissions: {
    canManageUsers: false,
    canManageEvents: true,
    canModerateContent: true,
    canAccessAnalytics: true,
    canManageSettings: false
  },
  interestsSelected: true,
  profileSetup: true,
  gender: 'prefer-not-to-say',
  lastAdminLogin: new Date()
});

    await adminUser.save();
    
    console.log('\n✅ Super admin created successfully!');
    console.log('\nLogin Credentials:');
    console.log('==================');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('\nPlease save these credentials securely.');
    console.log('You can now log in to the admin dashboard.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    rl.close();
  }
}

createSuperAdmin().catch(console.error);