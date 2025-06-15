import { NextResponse } from "next/server";
import {
  getVideoInfo,
  extractVideoId,
  extractPlaylistId,
  isValidYouTubeUrl,
  getYouTubeUrlType,
} from "@/lib/youtube-transcript";
import { ApiResponse } from "@/types/youtube";

interface SearchRequest {
  url: string;
}

export async function POST(req: Request) {
  try {
    const { url }: SearchRequest = await req.json();

    console.log("🔍 Search request received for URL:", url);

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube URL" },
        { status: 400 },
      );
    }

    const urlType = getYouTubeUrlType(url);
    console.log("🎯 Detected URL type:", urlType);

    if (urlType === "playlist") {
      // Temporarily disable playlist support
      return NextResponse.json(
        {
          error: "Playlist support is temporarily disabled",
          message:
            "Please extract videos individually. Copy the video URL from the playlist and paste it here.",
        },
        { status: 400 },
      );
    } else if (urlType === "video") {
      // Handle single video
      const videoId = extractVideoId(url);
      if (!videoId) {
        return NextResponse.json(
          { error: "Invalid video URL - could not extract video ID" },
          { status: 400 },
        );
      }

      console.log("📹 Processing video ID:", videoId);

      try {
        // Get basic video info
        const videoInfo = await getVideoInfo(videoId);

        console.log("✅ Video info retrieved:", videoInfo);

        return NextResponse.json({
          success: true,
          type: "video",
          videoId,
          data: {
            success: true,
            videoId,
            title: videoInfo.title,
            url: url,
            duration: videoInfo.duration,
            thumbnail: videoInfo.thumbnail,
          },
        });
      } catch (error: any) {
        console.error("❌ Error getting video info:", error.message);

        // Still return basic info even if getVideoInfo fails
        return NextResponse.json({
          success: true,
          type: "video",
          videoId,
          data: {
            success: true,
            videoId,
            title: `Video ${videoId}`,
            url: url,
            duration: 0,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          },
        });
      }
    } else if (urlType === "channel") {
      return NextResponse.json(
        {
          error: "Channel URLs are not supported",
          message:
            "Please provide a direct link to a specific video instead of a channel URL",
        },
        { status: 400 },
      );
    } else {
      return NextResponse.json(
        { error: "Unsupported YouTube URL type" },
        { status: 400 },
      );
    }
  } catch (error: any) {
    console.error("💥 Search API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process YouTube URL",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
