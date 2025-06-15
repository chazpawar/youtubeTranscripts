import DashboardNavbar from "@/components/dashboard-navbar";
import TranscriptExtractor from "@/components/transcript-extractor";
import { InfoIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">YouTube Transcript Extractor</h1>
            <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
              <InfoIcon size="14" />
              <span>
                Extract transcripts from YouTube videos, channels, and playlists
              </span>
            </div>
          </header>

          {/* Transcript Extractor Section */}
          <section>
            <TranscriptExtractor />
          </section>
        </div>
      </main>
    </>
  );
}
