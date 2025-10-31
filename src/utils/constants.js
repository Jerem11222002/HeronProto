// Organization categories from backend
export const ORGANIZATION_CATEGORIES = {
  'CAST': ['theatre', 'drama', 'performing-arts'],
  'CULTURA': ['cultural', 'traditional-arts', 'heritage'],
  'UMAK Jammers': ['music', 'band', 'contemporary'],
  'UMAK Chorale': ['music', 'vocal', 'choir'],
  'UMAK Dance Extreme': ['dance', 'contemporary', 'modern'],
  'UMAK Siglahi': ['dance', 'cultural', 'traditional'],
  'UMAK Brass Band': ['music', 'instrumental', 'band']
};

// Frontend-specific organization colors
export const ORGANIZATION_COLORS = {
  'CAST': '#FF5722', // Deep Orange
  'CULTURA': '#9C27B0', // Purple
  'UMAK Jammers': '#2196F3', // Blue
  'UMAK Chorale': '#4CAF50', // Green
  'UMAK Dance Extreme': '#F44336', // Red
  'UMAK Siglahi': '#FF9800', // Orange
  'UMAK Brass Band': '#607D8B' // Blue Grey
};

// Event status constants
export const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Event categories
export const EVENT_CATEGORIES = [
  'music',
  'dance',
  'theatre',
  'cultural-arts',
  'performance',
  'workshop',
  'competition',
  'exhibition'
];

// Participant status colors
export const STATUS_COLORS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error'
};

// Registration status options
export const REGISTRATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};