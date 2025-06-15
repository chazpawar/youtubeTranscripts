import { NextResponse } from "next/server";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { formatTranscript } from "@/lib/transcript-formatter";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");
    const format = searchParams.get("format") || "txt";
    const title = searchParams.get("title") || "transcript";

    console.log("📥 Download request received:", { videoId, format, title });

    if (!videoId) {
      console.error("❌ Missing videoId parameter");
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 },
      );
    }

    // Validate video ID format
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      console.error("❌ Invalid video ID format:", videoId);
      return NextResponse.json(
        { error: "Invalid video ID format" },
        { status: 400 },
      );
    }

    // Validate format
    const validFormats = ["txt", "json", "csv", "srt", "vtt"];
    if (!validFormats.includes(format.toLowerCase())) {
      console.error("❌ Invalid format:", format);
      return NextResponse.json(
        {
          error: "Invalid format. Supported formats: txt, json, csv, srt, vtt",
        },
        { status: 400 },
      );
    }

    // Fetch transcript with error handling
    console.log("📝 Fetching transcript for video:", videoId);
    const transcript = await getYouTubeTranscript(videoId);

    // The updated function already validates transcript data internally
    // This check is redundant but kept for safety
    if (!transcript || transcript.length === 0) {
      console.error("❌ Empty transcript received for video:", videoId);
      return NextResponse.json(
        { error: "No transcript available for this video" },
        { status: 404 },
      );
    }

    console.log("✅ Transcript fetched successfully:", {
      segments: transcript.length,
      firstSegment: transcript[0],
    });

    // Format transcript
    console.log("🔧 Formatting transcript as:", format);
    const formattedTranscript = formatTranscript(transcript, format);

    // Validate formatted transcript
    if (!formattedTranscript || formattedTranscript.trim().length === 0) {
      console.error("❌ Empty formatted transcript for video:", videoId);
      return NextResponse.json(
        { error: "Failed to format transcript" },
        { status: 500 },
      );
    }

    console.log(
      "✅ Transcript formatted successfully, length:",
      formattedTranscript.length,
    );

    // Set appropriate content type and headers
    const contentType = getContentType(format);
    const filename = `${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.${format}`; // Sanitize filename

    console.log("📤 Sending response with headers:", {
      contentType,
      filename,
      contentLength: formattedTranscript.length,
    });

    return new NextResponse(formattedTranscript, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": formattedTranscript.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("💥 Download API Error:", {
      error: error.message,
      videoId: new URL(request.url).searchParams.get("videoId"),
    });

    // Enhanced error handling consistent with transcript route
    const errorMessage = error.message?.toLowerCase() || "";

    // Video unavailable/private/restricted errors
    if (
      errorMessage.includes("video is unavailable") ||
      errorMessage.includes("video is private") ||
      errorMessage.includes("video is restricted") ||
      errorMessage.includes("video has been removed")
    ) {
      return NextResponse.json(
        {
          error: "Video unavailable",
          message: error.message,
        },
        { status: 404 },
      );
    }

    // No transcript available errors
    if (
      errorMessage.includes("no transcript available") ||
      errorMessage.includes("captions are disabled") ||
      errorMessage.includes("captions or transcripts enabled") ||
      errorMessage.includes("transcript is disabled")
    ) {
      return NextResponse.json(
        {
          error: "No transcript",
          message: error.message,
        },
        { status: 404 },
      );
    }

    // Live stream errors
    if (
      errorMessage.includes("live stream") ||
      errorMessage.includes("live video")
    ) {
      return NextResponse.json(
        {
          error: "Live video",
          message: error.message,
        },
        { status: 400 },
      );
    }

    // YouTube Shorts errors
    if (errorMessage.includes("shorts")) {
      return NextResponse.json(
        {
          error: "Shorts",
          message: error.message,
        },
        { status: 400 },
      );
    }

    // Rate limiting errors
    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests")
    ) {
      return NextResponse.json(
        {
          error: "Rate limited",
          message: error.message,
        },
        { status: 429 },
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        error: "Failed to download transcript",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

function getContentType(format: string): string {
  switch (format.toLowerCase()) {
    case "json":
      return "application/json";
    case "csv":
      return "text/csv";
    case "srt":
      return "application/x-subrip";
    case "vtt":
      return "text/vtt";
    default:
      return "text/plain";
  }
}
