const calculateEngagementScore = (post) => {
  if (!post.engagementMetrics) return 0;
  
  const { views = 0, shares = 0, commentCount = 0 } = post.engagementMetrics;
  const likes = post.likes?.length || 0;
  
  // Normalize each metric (assumed max values)
  const normalizedViews = Math.min(views / 200, 1);
  const normalizedLikes = Math.min(likes / 50, 1);
  const normalizedShares = Math.min(shares / 30, 1);
  const normalizedComments = Math.min(commentCount / 20, 1);
  
  // Weighted sum (total = 100)
  return (
    normalizedViews * 25 +
    normalizedLikes * 30 +
    normalizedShares * 25 +
    normalizedComments * 20
  );
};

const calculateRecencyScore = (post) => {
  const now = new Date();
  const postDate = new Date(post.createdAt);
  const hoursSincePost = (now - postDate) / (1000 * 60 * 60);
  
  // Score decreases linearly over 7 days
  return Math.max(0, 1 - (hoursSincePost / (24 * 7)));
};

const calculateImplicitScore = (post, implicitPrefs) => {
  if (!post.tags || !implicitPrefs) {
    console.log('Debug - Missing tags or prefs');
    return 0;
  }
  
  // Ensure implicitPrefs is an object
  const prefs = implicitPrefs instanceof Map ? 
    Object.fromEntries(implicitPrefs) : 
    (typeof implicitPrefs === 'object' ? implicitPrefs : {});
  
  console.log('Debug - Normalized Prefs:', prefs);
  console.log('Debug - Post Tags:', post.tags);
  
  let totalScore = 0;
  let matchCount = 0;
  
  post.tags.forEach(tag => {
    if (tag in prefs) {
      totalScore += Number(prefs[tag]) || 0;
      matchCount++;
    }
  });

  const score = matchCount > 0 ? totalScore / matchCount : 0;
  console.log('Debug - Implicit Score:', score);
  return score;
};

const calculateInterestScore = (post, userTags) => {
  if (!post.tags || !userTags || !Array.isArray(userTags)) {
    console.log('Debug - Invalid input');
    return 0;
  }
  
  // Normalize tags for comparison
  const normalizedUserTags = userTags.map(t => t.toLowerCase());
  const normalizedPostTags = post.tags.map(t => t.toLowerCase());
  
  console.log('Debug - Normalized User Tags:', normalizedUserTags);
  console.log('Debug - Normalized Post Tags:', normalizedPostTags);
  
  const matchingTags = normalizedPostTags.filter(tag => 
    normalizedUserTags.includes(tag)
  );
  
  const score = matchingTags.length / 
    Math.max(normalizedPostTags.length, normalizedUserTags.length);
  
  console.log('Debug - Matching Tags:', matchingTags);
  console.log('Debug - Interest Score:', score);
  
  return score;
};

module.exports = {
  calculateEngagementScore,
  calculateRecencyScore,
  calculateInterestScore,
  calculateImplicitScore
};