import { VideoInfo, TranscriptSegment } from "@/lib/youtube-transcript";

export interface ApiResponse {
  success: boolean;
  type: "video" | "playlist" | "channel";
  videoId?: string;
  playlistId?: string;
  totalVideos?: number;
  data: VideoInfo | VideoInfo[];
}

export interface PlaylistVideo extends VideoInfo {
  transcript: TranscriptSegment[] | null;
  error: string | null;
}

export interface TranscriptResponse {
  success: boolean;
  videoId: string;
  transcript: TranscriptSegment[];
  error?: string;
}
