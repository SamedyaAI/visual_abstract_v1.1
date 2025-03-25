import React, { useState } from "react";
import { FileUp, FileText, Loader2 } from "lucide-react";
import OpenAI from "openai";
import { VisualAbstract } from './components/VisualAbstract';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ThemeSelector } from './components/ThemeSelector';
import { generateVisualAbstract } from './utils/llm';
import type { VisualAbstractData } from './types/abstract';

const ASSISTANT_ID = "asst_1NZLVbVABOIbObSZWYondAxd";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [abstractData, setAbstractData] = useState<VisualAbstractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState('Modern Medical');
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile?.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please upload a PDF file");
      setFile(null);
    }
  };

  const handlePDFSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setSummary("");
    setError(null);

    try {
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const fileUpload = await openai.files.create({
        file,
        purpose: "assistants",
      });

      const thread = await openai.beta.threads.create();

      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: `You are an advanced AI specializing in summarizing medical research papers while preserving essential context, statistical integrity, and visual insight potential. Analyze this paper and provide a comprehensive summary.`,
        attachments: [{ file_id: fileUpload.id, tools: [{ type: "file_search" }] }]
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: ASSISTANT_ID,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      while (runStatus.status === "queued" || runStatus.status === "in_progress") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

        if (runStatus.status === "failed") {
          throw new Error("Assistant failed to process the document");
        }
      }

      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data.find((msg) => msg.role === "assistant");

      if (!assistantMessage || !assistantMessage.content) {
        throw new Error("No response from Assistant.");
      }

      const summaryText = assistantMessage.content
        .map((item) => (item.type === 'text' ? item.text?.value || "" : ""))
        .join("\n\n");

      setSummary(summaryText);
      
      // Generate visual abstract from the summary
      const data = await generateVisualAbstract(summaryText);
      setAbstractData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAbstractData(null);
    setError(null);
    setSummary("");
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-center">Research Visual Abstract Generator</h1>
          <p className="text-center mt-2 text-blue-100">
            Transform your research papers into beautiful visual abstracts instantly
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <ThemeSelector 
            selectedTheme={selectedTheme}
            onThemeChange={setSelectedTheme}
          />
          
          <div className="bg-white shadow-xl rounded-lg overflow-hidden mb-8">
            <div className="px-6 py-8">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h2 className="mt-4 text-2xl font-bold text-gray-900">Upload Research Paper</h2>
                <p className="mt-2 text-gray-600">Upload a PDF file to generate a visual abstract</p>
              </div>

              <form onSubmit={handlePDFSubmit} className="mt-8 space-y-6">
                <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                  <div className="space-y-1 text-center">
                    <FileUp className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                        <span>Upload a file</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF up to 25MB</p>
                  </div>
                </div>

                {file && <div className="text-sm text-gray-600 text-center">Selected file: {file.name}</div>}

                <div>
                  <button
                    type="submit"
                    disabled={!file || loading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      !file || loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                        Processing...
                      </>
                    ) : (
                      "Generate Visual Abstract"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {loading && (
            <div className="mt-8">
              <LoadingSpinner />
            </div>
          )}

          {abstractData && !loading && (
            <div className="mt-8">
              <VisualAbstract 
                data={abstractData} 
                theme={selectedTheme}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}