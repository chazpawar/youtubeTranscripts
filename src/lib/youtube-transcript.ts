import { YoutubeTranscript } from "youtube-transcript";
import { Innertube } from "youtubei.js";

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface VideoInfo {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
}

const RATE_LIMIT_CONFIG = {
  baseDelay: 500,
  maxDelay: 5000,
  maxRetries: 3,
  backoffMultiplier: 1.5,
};

let lastRequestTime = 0;
let consecutiveFailures = 0;

const smartRateLimit = async () => {
  const now = Date.now();
  const dynamicDelay = Math.min(
    RATE_LIMIT_CONFIG.baseDelay *
      Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, consecutiveFailures),
    RATE_LIMIT_CONFIG.maxDelay,
  );
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < dynamicDelay) {
    const waitTime = dynamicDelay - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
};

async function fetchTranscriptWithYoutubeI(
  videoId: string,
): Promise<TranscriptSegment[]> {
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo(videoId);
    const transcript = await info.getTranscript();
    if (!transcript) {
      throw new Error("No transcript data returned from youtubei.js");
    }
    const transcriptObj = transcript as any;
    let transcriptContent: any[] = [];
    if (transcriptObj.body && Array.isArray(transcriptObj.body.content)) {
      transcriptContent = transcriptObj.body.content;
    } else if (
      transcriptObj.transcript &&
      transcriptObj.transcript.content &&
      transcriptObj.transcript.content.body &&
      Array.isArray(transcriptObj.transcript.content.body.initial_segments)
    ) {
      transcriptContent =
        transcriptObj.transcript.content.body.initial_segments;
    } else {
      if (transcriptObj.content && Array.isArray(transcriptObj.content)) {
        transcriptContent = transcriptObj.content;
      } else if (Array.isArray(transcriptObj)) {
        transcriptContent = transcriptObj;
      }
    }
    if (!transcriptContent || transcriptContent.length === 0) {
      throw new Error("No transcript content found in response");
    }
    const segments: TranscriptSegment[] = [];
    for (const item of transcriptContent) {
      if (
        item &&
        typeof item === "object" &&
        item.type === "TranscriptSegment"
      ) {
        let text = "";
        if (item.snippet?.text) {
          text = item.snippet.text;
        } else if (item.snippet?.runs && Array.isArray(item.snippet.runs)) {
          text = item.snippet.runs.map((run: any) => run.text || "").join("");
        }
        const startMs = parseInt(item.start_ms || "0");
        const endMs = parseInt(item.end_ms || "0");
        const durationMs = endMs - startMs;
        if (text && text.trim()) {
          segments.push({
            text: text.trim(),
            offset: Math.floor(startMs / 1000),
            duration: Math.floor(durationMs / 1000),
          });
        }
      }
    }
    return segments;
  } catch (error: any) {
    throw error;
  }
}

export async function getYouTubeTranscript(
  videoId: string,
): Promise<TranscriptSegment[]> {
  const startTime = Date.now();
  if (!videoId || typeof videoId !== "string") {
    throw new Error("Invalid video ID provided");
  }
  await smartRateLimit();
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcript && Array.isArray(transcript) && transcript.length > 0) {
      consecutiveFailures = Math.max(0, consecutiveFailures - 1);
      const formattedTranscript: TranscriptSegment[] = transcript.map(
        (segment) => ({
          text: segment.text?.trim() || "",
          offset: Math.max(0, segment.offset || 0),
          duration: Math.max(0, segment.duration || 0),
        }),
      );
      return formattedTranscript;
    }
  } catch (error: any) {
    if (error.message?.includes("Transcript is disabled")) {
      throw new Error("Transcripts are disabled for this video");
    } else if (error.message?.includes("Video unavailable")) {
      throw new Error("Video is unavailable or has been removed");
    } else if (error.message?.includes("private")) {
      throw new Error("Video is private or restricted");
    }
  }
  try {
    await smartRateLimit();
    const youtubeITranscript = await fetchTranscriptWithYoutubeI(videoId);
    if (youtubeITranscript && youtubeITranscript.length > 0) {
      consecutiveFailures = Math.max(0, consecutiveFailures - 1);
      return youtubeITranscript;
    }
  } catch (error: any) {}
  const urlFormats = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
  ];
  for (let i = 0; i < urlFormats.length; i++) {
    try {
      await smartRateLimit();
      const transcript = await YoutubeTranscript.fetchTranscript(urlFormats[i]);
      if (transcript && Array.isArray(transcript) && transcript.length > 0) {
        consecutiveFailures = Math.max(0, consecutiveFailures - 1);
        const formattedTranscript: TranscriptSegment[] = transcript.map(
          (segment) => ({
            text: segment.text?.trim() || "",
            offset: Math.max(0, segment.offset || 0),
            duration: Math.max(0, segment.duration || 0),
          }),
        );
        return formattedTranscript;
      }
    } catch (error: any) {}
  }
  consecutiveFailures++;
  const processingTime = Date.now() - startTime;
  const errorMessage = `No transcript available for video ${videoId}. This could be because:
- The video doesn't have captions enabled
- The video is private, restricted, or unavailable  
- Transcripts are disabled by the video owner
- There's a temporary issue with YouTube's caption service

Please try a different video or check if the video has captions available on YouTube directly.`;
  throw new Error(errorMessage);
}

export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  if (!videoId || typeof videoId !== "string") {
    throw new Error("Invalid video ID provided");
  }
  const videoInfo: VideoInfo = {
    videoId,
    title: `Video ${videoId}`,
    duration: 0,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
  return videoInfo;
}

export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([^#\&\?]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

export function getYouTubeUrlType(
  url: string,
): "video" | "playlist" | "unknown" {
  if (!url || typeof url !== "string") return "unknown";
  if (url.includes("list=")) return "playlist";
  if (extractVideoId(url)) return "video";
  return "unknown";
}

export function extractPlaylistId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const regExp = /[&?]list=([a-zA-Z0-9_-]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}
