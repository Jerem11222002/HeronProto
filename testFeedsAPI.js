require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:5000/api';

// Test user credentials from the database
const testUser = {
  email: 'eballar041@gmail.com',
  password: 'password123' // This is a guess - adjust if needed
};

async function testFeedsWithAuth() {
  try {
    console.log('🔐 Attempting to login...');
    
    // Try to login
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      console.log(`❌ Login failed: ${loginResponse.status}`);
      console.log(`Response: ${error.substring(0, 200)}`);
      console.log('\n⚠️  Using alternative approach - checking if server responds to requests');
      
      // Just test that the server is running
      const healthResponse = await fetch(`${API_URL}/posts/feed`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log(`Server responded with status: ${healthResponse.status}`);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log(`✅ Logged in! Token: ${token.substring(0, 20)}...`);

    // Test Friends Feed
    console.log('\n📥 Testing FRIENDS feed...');
    const friendsResponse = await fetch(`${API_URL}/posts/feed?feedType=friends&page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (friendsResponse.ok) {
      const friendsData = await friendsResponse.json();
      console.log(`✅ Friends feed response:`, {
        feedType: friendsData.feedType,
        itemsCount: friendsData.items.length,
        totalCount: friendsData.pagination.totalCount,
        hasMore: friendsData.pagination.hasMore
      });
      
      if (friendsData.items.length > 0) {
        console.log(`  First item: ${friendsData.items[0]._id}`);
      } else {
        console.log(`  ⚠️  No items returned`);
      }
    } else {
      console.log(`❌ FRIENDS feed error: ${friendsResponse.status}`);
      const error = await friendsResponse.text();
      console.log(`Response: ${error.substring(0, 200)}`);
    }

    // Test Following Feed
    console.log('\n📥 Testing FOLLOWING feed...');
    const followingResponse = await fetch(`${API_URL}/posts/feed?feedType=following&page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      console.log(`✅ Following feed response:`, {
        feedType: followingData.feedType,
        itemsCount: followingData.items.length,
        totalCount: followingData.pagination.totalCount,
        hasMore: followingData.pagination.hasMore
      });
      
      if (followingData.items.length > 0) {
        console.log(`  First item: ${followingData.items[0]._id}`);
      } else {
        console.log(`  ⚠️  No items returned`);
      }
    } else {
      console.log(`❌ FOLLOWING feed error: ${followingResponse.status}`);
      const error = await followingResponse.text();
      console.log(`Response: ${error.substring(0, 200)}`);
    }

    // Test My Feed (for comparison)
    console.log('\n📥 Testing MY-FEED...');
    const myFeedResponse = await fetch(`${API_URL}/posts/feed?feedType=my-feed&page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (myFeedResponse.ok) {
      const myFeedData = await myFeedResponse.json();
      console.log(`✅ My feed response:`, {
        feedType: myFeedData.feedType,
        itemsCount: myFeedData.items.length,
        totalCount: myFeedData.pagination.totalCount,
        hasMore: myFeedData.pagination.hasMore
      });
    } else {
      console.log(`❌ MY-FEED error: ${myFeedResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFeedsWithAuth();
