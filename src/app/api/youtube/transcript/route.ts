import { NextResponse } from "next/server";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { TranscriptResponse } from "@/types/youtube";

export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      console.error("Missing videoId parameter");
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameter",
          message: "Video ID is required",
        },
        { status: 400 },
      );
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      console.error("Invalid video ID format:", videoId);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid format",
          message: "Invalid video ID format",
        },
        { status: 400 },
      );
    }

    const transcript = await getYouTubeTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      console.error("Empty transcript received for video:", videoId);
      return NextResponse.json(
        {
          success: false,
          error: "No transcript",
          message: "No captions available for this video",
        },
        { status: 404 },
      );
    }

    const response: TranscriptResponse = {
      success: true,
      videoId,
      transcript,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("Transcript API Error:", {
      error: error.message,
      name: error.name,
      videoId: new URL(request.url).searchParams.get("videoId"),
      processingTime,
    });

    const errorMessage = error.message?.toLowerCase() || "";

    if (
      errorMessage.includes("video is unavailable") ||
      errorMessage.includes("video is private") ||
      errorMessage.includes("video is restricted") ||
      errorMessage.includes("video has been removed")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Video unavailable",
          message: error.message,
        },
        { status: 404 },
      );
    }

    if (
      errorMessage.includes("no transcript available") ||
      errorMessage.includes("captions are disabled") ||
      errorMessage.includes("captions or transcripts enabled") ||
      errorMessage.includes("transcript is disabled")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No transcript",
          message: error.message,
        },
        { status: 404 },
      );
    }

    if (
      errorMessage.includes("live stream") ||
      errorMessage.includes("live video")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Live video",
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (errorMessage.includes("shorts")) {
      return NextResponse.json(
        {
          success: false,
          error: "Shorts",
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limited",
          message: error.message,
        },
        { status: 429 },
      );
    }

    if (errorMessage.includes("invalid youtube video id format")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid format",
          message: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Server error",
        message: "An unexpected error occurred while fetching the transcript",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
