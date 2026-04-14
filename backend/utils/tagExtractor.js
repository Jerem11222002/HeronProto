/**
 * Tag Extraction & Generation Utility
 * Generates tags from post descriptions when they're missing
 * Also handles fallback strategies for recommendation scoring
 */

const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

// Organization primary interests mapping
const ORG_PRIMARY_INTERESTS = {
  'UTPC': 'visual-arts',
  'CAST': 'theatre',
  'CULTURA': 'cultural',
  'UMAK Jammers': 'music',
  'UMAK Chorale': 'music',
  'UMAK Dance Extreme': 'dance',
  'UMAK Siglahi': 'cultural',
  'UMAK Brass Band': 'music'
};

// Common keywords for interest detection
const INTEREST_KEYWORDS = {
  'music': ['concert', 'song', 'band', 'performance', 'music', 'sing', 'orchestra', 'musician', 'instrument', 'jam', 'compose'],
  'dance': ['dance', 'choreography', 'dancer', 'movement', 'hip-hop', 'ballet', 'contemporary', 'performance'],
  'theatre': ['theatre', 'drama', 'play', 'acting', 'actor', 'stage', 'script', 'act', 'dramatic'],
  'visual-arts': ['art', 'painting', 'draw', 'design', 'poster', 'canvas', 'visual', 'graphic', 'illustr'],
  'cultural': ['culture', 'tradition', 'folk', 'heritage', 'ethnic', 'indigenous', 'cultural'],
  'performance': ['show', 'perform', 'live', 'presentation', 'concert', 'display', 'exhibition'],
  'photography': ['photo', 'photography', 'picture', 'image', 'camera'],
  'film': ['film', 'movie', 'video', 'cinema', 'documentary'],
  'technical-production': ['production', 'technical', 'lighting', 'sound', 'multimedia', 'audio']
};

class TagExtractor {
  /**
   * Extract tags from post description
   * Uses keyword matching and NLP tokenization
   */
  static extractFromDescription(text) {
    if (!text || text.trim().length === 0) return [];

    const lowerText = text.toLowerCase();
    const tokens = tokenizer.tokenize(lowerText);
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
      'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'so', 'as'
    ]);

    // Get meaningful words
    const meaningfulWords = tokens
      .filter(word => !stopWords.has(word) && word.length > 2)
      .map(word => word.toLowerCase());

    // Match against interest keywords
    const detectedInterests = new Set();
    const detectedTags = new Set();

    // First pass: detect interests from keywords
    Object.entries(INTEREST_KEYWORDS).forEach(([interest, keywords]) => {
      const hasKeyword = keywords.some(keyword =>
        lowerText.includes(keyword) || meaningfulWords.some(word => word.includes(keyword))
      );
      if (hasKeyword) {
        detectedInterests.add(interest);
      }
    });

    // Second pass: add meaningful words as tags (if > 3 chars and not in stopwords)
    meaningfulWords.forEach(word => {
      if (word.length > 3 && !detectedTags.has(word)) {
        detectedTags.add(word);
      }
    });

    // Combine: interests first, then tags
    const result = [
      ...Array.from(detectedInterests),
      ...Array.from(detectedTags).slice(0, 5) // Limit additional tags to 5
    ];

    return [...new Set(result)].slice(0, 10); // Max 10 tags
  }

  /**
   * Fallback tag strategy when post has no tags or description
   */
  static generateFallbackTags(item) {
    const tags = [];

    // Strategy 1: Use organization's primary interest
    if (item.organization && ORG_PRIMARY_INTERESTS[item.organization]) {
      tags.push(ORG_PRIMARY_INTERESTS[item.organization]);
    }

    // Strategy 2: Use media type
    if (item.mediaType) {
      tags.push(item.mediaType);
    }

    // Strategy 3: Use content type
    if (item.contentType && item.contentType !== 'regular') {
      tags.push(item.contentType);
    }

    // NOTE: REMOVED Strategy 4 (adding user interests as tags)
    // Posts should be scored on WHAT THEY SAY, not on wishful matching
    // If a post has no real tags, it should not artificially get user interests added
    // This preserves content-based filtering integrity per hybrid filtering documentation

    // Ensure at least one tag for organization/media matching
    if (tags.length === 0) {
      tags.push('general');
    }

    return [...new Set(tags)];
  }

  /**
   * Generate smart tags for event
   * Combines keyword extraction from title and description
   */
  static extractEventTags(event) {
    try {
      const titleTags = this.extractFromDescription(event.title || '');
      const descTags = this.extractFromDescription(event.description || '');
      
      // Get organization's primary interests
      const orgInterests = [];
      if (event.organization && ORG_PRIMARY_INTERESTS[event.organization]) {
        orgInterests.push(ORG_PRIMARY_INTERESTS[event.organization]);
      }

      // Combine all and deduplicate
      const allTags = [...new Set([
        ...titleTags,
        ...descTags,
        ...orgInterests
      ])];

      return allTags.slice(0, 10);
    } catch (error) {
      console.error('Error extracting event tags:', error.message);
      return [];
    }
  }

  /**
   * Score quality of tag set
   * Returns 0-1 indicating how good tags are for recommendations
   */
  static scoreTagQuality(tags) {
    if (!tags || tags.length === 0) return 0;
    if (tags.length < 2) return 0.3;
    if (tags.length < 5) return 0.6;
    return 1.0;
  }
}

module.exports = TagExtractor;
