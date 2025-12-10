const calculateEventScore = (userInterests, event, organizationCategories) => {
  let score = 0;
  const orgInfo = organizationCategories[event.organization];

  if (!orgInfo) return score;

  // Check primary category match
  if (userInterests.includes(orgInfo.primaryCategory)) {
    score += 3; // Higher weight for primary category match
  }

  // Check organization tags match
  orgInfo.tags.forEach(tag => {
    if (userInterests.includes(tag)) {
      score += 1;
    }
  });

  // Check event specific tags
  if (event.tags) {
    event.tags.forEach(tag => {
      if (userInterests.includes(tag)) {
        score += 2;
      }
    });
  }

  // Boost score for upcoming events
  const eventDate = new Date(event.date);
  const now = new Date();
  if (eventDate > now) {
    const daysUntilEvent = (eventDate - now) / (1000 * 60 * 60 * 24);
    if (daysUntilEvent <= 7) {
      score += 2; // Boost for events within next week
    } else if (daysUntilEvent <= 30) {
      score += 1; // Small boost for events within next month
    }
  }

  return score;
};

const getRecommendedEvents = async (userInterests, userId) => {
  try {
    // Fetch all upcoming events
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events?status=upcoming`);
    const events = await response.json();

    // Score and sort events
    const scoredEvents = events.map(event => ({
      ...event,
      score: calculateEventScore(userInterests, event, ORGANIZATION_CATEGORIES)
    }));

    return scoredEvents
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 recommended events
  } catch (error) {
    console.error('Error fetching recommended events:', error);
    return [];
  }
};

export const getPersonalizedFeed = async (userId, userInterests) => {
  try {
    // Get recommended events
    const recommendedEvents = await getRecommendedEvents(userInterests, userId);

    // Get user's followed organizations
    const userResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/following`);
    const { followedOrgs } = await userResponse.json();

    // Combine and sort all content
    const combinedFeed = [
      ...recommendedEvents.map(event => ({
        ...event,
        type: 'event',
        priority: event.score
      })),
      // Add other content types here (posts, etc.)
    ];

    return combinedFeed.sort((a, b) => b.priority - a.priority);
  } catch (error) {
    console.error('Error generating personalized feed:', error);
    return [];
  }
};

export default {
  getPersonalizedFeed,
  getRecommendedEvents
};
