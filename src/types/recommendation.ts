export type OrganizationName = 
  | 'CAST'
  | 'CULTURA'
  | 'UMAK Jammers'
  | 'UMAK Chorale'
  | 'UMAK Dance Extreme'
  | 'UMAK Siglahi'
  | 'UMAK Brass Band';

export type EventCategory = 'workshop' | 'seminar' | 'conference' | 'meetup';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface RecommendationScore {
  base: number;
  recency: number;
  interest: number;
  final: number;
}

export interface BaseItem {
  _id: string;
  type: 'post' | 'event';
  scores: RecommendationScore;
  metadata: {
    matchedInterests: string[];
    organization?: boolean;
    status?: string;
  };
}

export interface EventItem extends BaseItem {
  type: 'event';
  title: string;
  description: string;
  date: string;
  location: string;
  image: string;
  organization: OrganizationName;
  category: EventCategory;
  status: EventStatus;
  tags?: string[];
  badge?: {
    type: string;
    label: string;
    color: string;
  };
  engagementMetrics?: {
    views: number;
    interested: number;
    registrations: number;
  };
}

export interface PostItem extends BaseItem {
  type: 'post';
  userId: string;
  desc: string;
  media?: string;
  mediaType?: 'image' | 'video';
  likes: string[];
  createdAt: string;
  engagementMetrics?: {
    views: number;
    shares: number;
    commentCount: number;
    popularity: number;
    recency: number;
  };
  user?: {
    name: string;
    profilePicture: string;
  };
}

export type FeedItem = EventItem | PostItem;

export interface FeedResponse {
  items: FeedItem[];
  hasMore: boolean;
  nextPage: number | null;
  total: number;
}

export interface FeedFilters {
  sortBy: 'hybrid' | 'recent' | 'relevance';
  timeRange: 'all' | 'today' | 'week' | 'month';
  page: number;
  limit?: number;
  includeEvents?: boolean;
}

export interface EventFormData {
  title: string;
  description: string;
  date: string;
  image: string;
  organization: OrganizationName;
  location: string;
  category: EventCategory;
  status: EventStatus;
}

export interface EventCardProps {
  event: EventItem;
  onJoin?: (event: EventItem) => void;
  onShare?: (event: EventItem) => void;
  isAdmin?: boolean;
  onEdit?: (event: EventItem) => void;
  onDelete?: (eventId: string) => void;
  isHomePage?: boolean;
  currentUserInterests?: string[];
}