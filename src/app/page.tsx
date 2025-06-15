import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import {
  ArrowUpRight,
  Download,
  FileText,
  Search,
  Settings,
  Video,
  Zap,
} from "lucide-react";
import { createClient } from "../../supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Navbar />
      <Hero />

      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Everything you need to extract, process, and download YouTube
              transcripts efficiently.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Search className="w-6 h-6" />,
                title: "Smart Search",
                description:
                  "Search by channel username, playlist link, or video URL with validation",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Batch Processing",
                description:
                  "Extract transcripts from multiple videos simultaneously",
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Multiple Formats",
                description:
                  "Export in TXT, JSON, CSV, SRT, VTT formats with preview",
              },
              {
                icon: <Download className="w-6 h-6" />,
                title: "Easy Download",
                description:
                  "Single or batch download with clear success indicators",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border"
              >
                <div className="text-red-600 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Simple 4-step process to get your YouTube transcripts
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                icon: <Video className="w-8 h-8" />,
                title: "Enter URL",
                description: "Paste YouTube channel, playlist, or video URL",
              },
              {
                step: "2",
                icon: <Settings className="w-8 h-8" />,
                title: "Select Videos",
                description: "Choose which videos to extract transcripts from",
              },
              {
                step: "3",
                icon: <FileText className="w-8 h-8" />,
                title: "Choose Format",
                description: "Pick your preferred export format and preview",
              },
              {
                step: "4",
                icon: <Download className="w-8 h-8" />,
                title: "Download",
                description: "Get your transcripts individually or as a batch",
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="text-red-600">{step.icon}</div>
                </div>
                <div className="text-sm font-semibold text-red-600 mb-2">
                  Step {step.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-red-600 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">10K+</div>
              <div className="text-red-100">Videos Processed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">5</div>
              <div className="text-red-100">Export Formats</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">99%</div>
              <div className="text-red-100">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Extract Transcripts?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Start extracting YouTube transcripts in multiple formats with our
            intuitive interface.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Start Extracting Now
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
