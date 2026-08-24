import { Suspense } from "react";
import AIAssistantPage from "@/components/ai-assistant/AIAssistantPage";

export default function AIAssistant() {
  return (
    <main className="min-h-screen p-6">
      <Suspense fallback={null}>
        <AIAssistantPage />
      </Suspense>
    </main>
  );
}