import { TranscriptSegment } from "./youtube-transcript";

export function formatTranscript(
  transcript: TranscriptSegment[],
  format: string,
): string {
  if (!transcript || transcript.length === 0) {
    throw new Error("Empty transcript provided");
  }

  transcript.forEach((segment, index) => {
    if (!segment.text || typeof segment.text !== "string") {
      throw new Error(`Invalid text in segment ${index}`);
    }
    if (typeof segment.duration !== "number" || segment.duration < 0) {
      throw new Error(`Invalid duration in segment ${index}`);
    }
    if (typeof segment.offset !== "number" || segment.offset < 0) {
      throw new Error(`Invalid offset in segment ${index}`);
    }
  });

  switch (format.toLowerCase()) {
    case "txt":
      return formatAsTxt(transcript);
    case "json":
      return formatAsJson(transcript);
    case "csv":
      return formatAsCsv(transcript);
    case "srt":
      return formatAsSrt(transcript);
    case "vtt":
      return formatAsVtt(transcript);
    default:
      return formatAsTxt(transcript);
  }
}

function formatAsTxt(transcript: TranscriptSegment[]): string {
  return transcript.map((segment) => segment.text.trim()).join("\n\n");
}

function formatAsJson(transcript: TranscriptSegment[]): string {
  return JSON.stringify(transcript, null, 2);
}

function formatAsCsv(transcript: TranscriptSegment[]): string {
  const headers = "Start Time,Duration,Text\n";
  const rows = transcript.map((segment) => {
    const startTime = formatTime(segment.offset);
    const duration = formatTime(segment.duration);
    const text = segment.text.replace(/"/g, '""').replace(/\n/g, " ").trim();
    return `${startTime},${duration},"${text}"`;
  });
  return headers + rows.join("\n");
}

function formatAsSrt(transcript: TranscriptSegment[]): string {
  return transcript
    .map((segment, index) => {
      const startTime = formatTime(segment.offset);
      const endTime = formatTime(segment.offset + segment.duration);
      const text = segment.text.trim();
      return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
    })
    .join("\n");
}

function formatAsVtt(transcript: TranscriptSegment[]): string {
  const header = "WEBVTT\n\n";
  const cues = transcript.map((segment, index) => {
    const startTime = formatTime(segment.offset, true);
    const endTime = formatTime(segment.offset + segment.duration, true);
    const text = segment.text.trim();
    return `${startTime} --> ${endTime}\n${text}`;
  });
  return header + cues.join("\n\n");
}

function formatTime(seconds: number, vtt: boolean = false): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (vtt) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}
