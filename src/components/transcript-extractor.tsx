"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Progress } from "./ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Download,
  Search,
  Video,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { VideoInfo } from "@/lib/youtube-transcript";

interface VideoItem extends VideoInfo {
  selected: boolean;
}

interface ProcessingStatus {
  videoId: string;
  title: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
}

interface DownloadError {
  videoId: string;
  message: string;
}

const BATCH_SIZE = 5;
const BATCH_DELAY = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Utility function to validate YouTube URLs
const isValidYouTubeUrl = (url: string): boolean => {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
};

// Utility function to sanitize filename
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim()
    .substring(0, 100); // Limit length
};

// Utility function for API requests with retry logic
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES,
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY * (i + 1)),
      );
    }
  }
  throw new Error("Max retries exceeded");
};

export default function TranscriptExtractor() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("txt");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [processing, setProcessing] = useState<ProcessingStatus[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [downloadErrors, setDownloadErrors] = useState<DownloadError[]>([]);

  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Cleanup function
  const cleanup = useCallback(() => {
    isMountedRef.current = false;
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setSearchError("Please enter a valid YouTube URL");
      return;
    }

    if (!isValidYouTubeUrl(trimmedUrl)) {
      setSearchError(
        "Please enter a valid YouTube URL (channel, playlist, or video)",
      );
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setVideos([]);
    setProcessing([]);
    setDownloadErrors([]);

    try {
      const response = await fetchWithRetry("/api/youtube/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search videos");
      }

      if (!isMountedRef.current) return;

      if (data.type === "video") {
        setVideos([
          {
            ...data.data,
            selected: true,
          },
        ]);
      } else if (data.type === "playlist") {
        if (!data.data || data.data.length === 0) {
          throw new Error("No videos found in playlist");
        }
        setVideos(
          data.data.map((video: VideoInfo) => ({
            ...video,
            selected: true,
          })),
        );
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setSearchError(error.message || "Failed to search videos");
      }
    } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
      }
    }
  }, [url]);

  const updateProcessingStatus = useCallback(
    (videoId: string, updates: Partial<ProcessingStatus>) => {
      if (!isMountedRef.current) return;

      setProcessing((prev) =>
        prev.map((p) => (p.videoId === videoId ? { ...p, ...updates } : p)),
      );
    },
    [],
  );

  const processVideoTranscript = useCallback(
    async (video: VideoItem, index: number): Promise<void> => {
      const statusId = video.videoId;

      try {
        updateProcessingStatus(statusId, {
          status: "processing",
          progress: 10,
        });

        const response = await fetchWithRetry(
          `/api/youtube/transcript?videoId=${encodeURIComponent(video.videoId)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch transcript");
        }

        updateProcessingStatus(statusId, { progress: 100 });
        updateProcessingStatus(statusId, {
          status: "completed",
          progress: 100,
        });
      } catch (error: any) {
        updateProcessingStatus(statusId, {
          status: "error",
          progress: 0,
          error: error.message,
        });
      }
    },
    [updateProcessingStatus],
  );

  const handleExtract = useCallback(async () => {
    const selectedVideos = videos.filter((v) => v.selected);

    if (selectedVideos.length === 0) {
      setSearchError("Please select at least one video");
      return;
    }

    setIsExtracting(true);
    setDownloadErrors([]);

    const processingStatuses: ProcessingStatus[] = selectedVideos.map(
      (video) => ({
        videoId: video.videoId,
        title: video.title,
        status: "pending" as const,
        progress: 0,
      }),
    );

    setProcessing(processingStatuses);

    try {
      // Process videos in batches
      for (let i = 0; i < selectedVideos.length; i += BATCH_SIZE) {
        if (!isMountedRef.current) break;

        const batch = selectedVideos.slice(i, i + BATCH_SIZE);

        await Promise.allSettled(
          batch.map((video, batchIndex) =>
            processVideoTranscript(video, i + batchIndex),
          ),
        );

        // Add delay between batches if not the last batch
        if (i + BATCH_SIZE < selectedVideos.length && isMountedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      }
    } catch (error: any) {
      console.error("Batch processing error:", error);
    } finally {
      if (isMountedRef.current) {
        setIsExtracting(false);
      }
    }
  }, [videos, processVideoTranscript]);

  const handleDownload = useCallback(
    async (videoId: string, title: string) => {
      try {
        const sanitizedTitle = sanitizeFilename(title);
        const downloadUrl = `/api/youtube/download?videoId=${encodeURIComponent(videoId)}&format=${encodeURIComponent(format)}&title=${encodeURIComponent(sanitizedTitle)}`;

        const response = await fetchWithRetry(downloadUrl);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Server error: ${response.status}`,
          );
        }

        const contentType = response.headers.get("content-type");
        if (!contentType) {
          throw new Error("No content type received from server");
        }

        const blob = await response.blob();

        if (blob.size === 0) {
          throw new Error("Received empty transcript file");
        }

        // Create and trigger download
        const downloadBlobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadBlobUrl;
        link.download = `${sanitizedTitle}.${format}`;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadBlobUrl);

        // Remove any existing error for this video
        setDownloadErrors((prev) =>
          prev.filter((err) => err.videoId !== videoId),
        );
      } catch (error: any) {
        console.error("Download error:", error);
        setDownloadErrors((prev) => [
          ...prev.filter((err) => err.videoId !== videoId),
          { videoId, message: error.message },
        ]);
      }
    },
    [format],
  );

  const toggleVideoSelection = useCallback((videoId: string) => {
    setVideos((prev) =>
      prev.map((video) =>
        video.videoId === videoId
          ? { ...video, selected: !video.selected }
          : video,
      ),
    );
  }, []);

  const toggleAllVideos = useCallback(() => {
    const allSelected = videos.every((v) => v.selected);
    setVideos((prev) =>
      prev.map((video) => ({ ...video, selected: !allSelected })),
    );
  }, [videos]);

  const clearSearch = useCallback(() => {
    setUrl("");
    setVideos([]);
    setProcessing([]);
    setSearchError("");
    setDownloadErrors([]);
  }, []);

  const dismissDownloadError = useCallback((videoId: string) => {
    setDownloadErrors((prev) => prev.filter((err) => err.videoId !== videoId));
  }, []);

  const selectedCount = videos.filter((v) => v.selected).length;
  const completedCount = processing.filter(
    (p) => p.status === "completed",
  ).length;
  const errorCount = processing.filter((p) => p.status === "error").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 bg-white p-4">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search YouTube Content
          </CardTitle>
          <CardDescription>
            Enter a YouTube channel username, playlist link, or video URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/@channel or https://youtube.com/playlist?list=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !isSearching && handleSearch()
              }
              className="flex-1"
              disabled={isSearching}
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !url.trim()}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </Button>
            {(videos.length > 0 || searchError) && (
              <Button
                variant="outline"
                onClick={clearSearch}
                disabled={isSearching}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {searchError && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Selection */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Select Videos ({selectedCount} of {videos.length} selected)
                </CardTitle>
                <CardDescription>
                  Choose which videos to extract transcripts from
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllVideos}
                disabled={isExtracting}
              >
                {videos.every((v) => v.selected)
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {videos.map((video) => (
                <div
                  key={video.videoId}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    video.selected
                      ? "bg-red-50 border-red-200"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    !isExtracting && toggleVideoSelection(video.videoId)
                  }
                >
                  <input
                    type="checkbox"
                    checked={video.selected}
                    onChange={() => toggleVideoSelection(video.videoId)}
                    disabled={isExtracting}
                    className="w-4 h-4 text-red-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-medium text-gray-900 truncate"
                      title={video.title}
                    >
                      {video.title}
                    </div>
                    <div className="text-sm text-gray-500">
                      Duration: {Math.floor(video.duration / 60)}:
                      {(video.duration % 60).toString().padStart(2, "0")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Format Selection */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Format
            </CardTitle>
            <CardDescription>
              Choose the format for your transcripts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={format}
              onValueChange={setFormat}
              disabled={isExtracting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">Text (TXT)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="srt">SubRip (SRT)</SelectItem>
                <SelectItem value="vtt">WebVTT (VTT)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Extract Button */}
      {videos.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleExtract}
            disabled={isExtracting || selectedCount === 0}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Extract Transcripts ({selectedCount})
              </>
            )}
          </Button>
        </div>
      )}

      {/* Processing Status */}
      {processing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Status</CardTitle>
            <CardDescription>
              {completedCount} completed, {errorCount} errors,{" "}
              {processing.length - completedCount - errorCount} remaining
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {processing.map((status) => {
                const downloadError = downloadErrors.find(
                  (err) => err.videoId === status.videoId,
                );

                return (
                  <div key={status.videoId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div
                        className="font-medium truncate flex-1 mr-4"
                        title={status.title}
                      >
                        {status.title}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {status.status === "completed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDownload(status.videoId, status.title)
                            }
                            className="text-green-600 hover:text-green-700"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        )}
                        <Badge
                          variant={
                            status.status === "completed"
                              ? "default"
                              : status.status === "error"
                                ? "destructive"
                                : "secondary"
                          }
                          className={
                            status.status === "completed"
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : ""
                          }
                        >
                          {status.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                          ) : status.status === "error" ? (
                            <AlertCircle className="w-4 h-4 mr-1" />
                          ) : (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          )}
                          {status.status}
                        </Badge>
                      </div>
                    </div>

                    <Progress value={status.progress} />

                    {status.status === "error" && status.error && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        Error: {status.error}
                      </div>
                    )}

                    {downloadError && (
                      <div className="flex items-center justify-between bg-red-50 p-2 rounded text-sm text-red-600">
                        <span>Download failed: {downloadError.message}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissDownloadError(status.videoId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
