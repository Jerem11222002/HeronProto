const VALID_INTERESTS = [
  'music','dance','theatre','cultural-arts','performance',
  'visual-arts','painting','artwork','digital-art','multimedia',
  'band','choir','vocal','contemporary','traditional-arts',
  'instrumental','workshop','competition','exhibition','design',
  'photography','film','fashion','writing','animation'
];

// keep existing org->tags but normalize keys to uppercase for lookup
const ORGANIZATION_CATEGORIES = {
  'UTPC': ['visual-arts', 'painting', 'artwork', 'digital-art', 'multimedia'],
  'CAST': ['theatre', 'drama', 'performing-arts'],
  'CULTURA': ['cultural-arts', 'traditional-arts', 'heritage'],
  'UMAK JAMMERS': ['music', 'band', 'contemporary'],
  'UMAK CHORALE': ['music', 'vocal', 'choir'],
  'UMAK DANCE EXTREME': ['dance', 'contemporary', 'modern'],
  'UMAK SIGLAHI': ['dance', 'cultural', 'traditional'],
  'UMAK BRASS BAND': ['music', 'instrumental', 'band']
};

const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const EVENT_CATEGORIES = [
  'music',
  'dance',
  'theatre',
  'cultural-arts',
  'performance',
  'workshop',
  'competition',
  'exhibition'
];

module.exports = {
  VALID_INTERESTS,
  ORGANIZATION_CATEGORIES,
  EVENT_STATUS,
  EVENT_CATEGORIES
};