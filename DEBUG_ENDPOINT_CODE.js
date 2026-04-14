// Add this temporary debug endpoint to test feeds without auth
// This should go in the posts.js file, at the end before the final router.post routes

const tempDebugCode = `
// TEMPORARY DEBUG: Test feed endpoints without authentication
router.get("/debug/test-feed/:feedType", async (req, res) => {
  try {
    const { feedType } = req.params;
    const page = req.query.page || 1;
    
    console.log(\`[DEBUG] Testing \${feedType} feed\`);
    
    // Get first user from database
    const testUser = await User.findOne()
      .select('interests implicitPreferences following followers friends organizations interestsSelected interestsSkipped contentPreferences _id')
      .lean();
    
    if (!testUser) {
      return res.status(404).json({ error: 'No test user found' });
    }
    
    console.log(\`[DEBUG] Using test user: \${testUser._id}\`);
    
    let feed;
    switch (feedType) {
      case 'friends':
        console.log('[DEBUG] Calling getFriendsFeed');
        feed = await RecommendationService.getFriendsFeed(testUser, { page: parseInt(page), limit: 5 });
        break;
      case 'following':
        console.log('[DEBUG] Calling getFollowingFeed');
        feed = await RecommendationService.getFollowingFeed(testUser, { page: parseInt(page), limit: 5 });
        break;
      case 'my-feed':
        console.log('[DEBUG] Calling getMyFeed');
        feed = await RecommendationService.getMyFeed(testUser, { page: parseInt(page), limit: 5 });
        break;
      default:
        return res.status(400).json({ error: 'Unknown feedType' });
    }
    
    console.log(\`[DEBUG] Feed returned \${feed.items.length} items\`);
    
    res.json({
      status: 'success',
      feedType,
      itemsCount: feed.items.length,
      pagination: feed.pagination,
      testUserId: testUser._id,
      firstItemId: feed.items[0]?._id,
      debug: {
        following: testUser.following?.length || 0,
        followers: testUser.followers?.length || 0
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
`;

console.log(tempDebugCode);
