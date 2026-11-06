export interface VideoItem {
  id: string; // videoId
  title: string;
  channelName: string;
  channelId?: string;
  channelIconUrl?: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  durationFormatted: string; // e.g. "14:53"
  viewCount: string; // e.g. "38K views"
  uploadedDate?: string; // e.g. "2 hours ago"
  description?: string;
  badge?: string; // e.g. "Members only"
  isMembersOnly?: boolean;
  isVerified?: boolean;
  watchedPercentage?: number; // e.g. 68 for 68% watched
  watchedProgressFormatted?: string;
}

export interface TopicChip {
  id: string;
  title: string;
  params?: string;
  continuationToken?: string;
}

export interface VideoFeedResult {
  videos: VideoItem[];
  chips: TopicChip[];
  selectedChipId?: string;
  continuationToken?: string;
}

export interface SubscribedChannel {
  id: string; // channelId (UC...)
  name: string;
  avatarUrl?: string;
  hasNewVideos?: boolean;
}

export interface SubscriptionsFeedResult {
  videos: VideoItem[];
  channels: SubscribedChannel[];
  continuationToken?: string;
}

export interface VideoNotification {
  id: string;
  title: string;
  channelName: string;
  channelIconUrl?: string;
  timeAgo: string;
  thumbnailUrl?: string;
  videoId?: string;
  read?: boolean;
}

export interface VideoCommentItem {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorChannelId?: string;
  text: string;
  publishedTime: string;
  likeCount?: string;
  replyCount?: number;
  isHeartedByCreator?: boolean;
}

export interface VideoWatchDetails {
  videoId: string;
  title: string;
  description: string;
  viewCount: string;
  likeCount?: string;
  publishedDate?: string;
  channel: {
    id?: string;
    name: string;
    avatarUrl?: string;
    subscriberCount?: string;
    isVerified?: boolean;
  };
  comments?: {
    countText?: string;
    topComment?: {
      authorName?: string;
      authorAvatarUrl?: string;
      text?: string;
    };
  };
  relatedVideos: VideoItem[];
}

export type VideoSearchCategory = 'all' | 'videos' | 'channels' | 'playlists';
export type VideoSearchSort = 'relevance' | 'newest' | 'views' | 'rating';
export type VideoSearchDateFilter = 'any' | 'today' | 'week' | 'month' | 'year';

export interface VideoPlaylist {
  id: string; // playlistId (VL...)
  title: string;
  thumbnailUrl?: string;
  videoCountText?: string; // e.g. "24 videos"
  channelName?: string;
}

export interface VideoSearchResult {
  videos: VideoItem[];
  channels: SubscribedChannel[];
  playlists: VideoPlaylist[];
  continuationToken?: string;
}
