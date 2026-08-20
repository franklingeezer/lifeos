import { Suspense } from "react";
import ProjectsPage from "@/components/projects/ProjectsPage";

// Same Suspense requirement as app/tasks/page.tsx, for the same reason:
// ProjectsPage now reads useSearchParams() for the ?open=<id> deep link
// from Calendar's project-deadline chips.
export default function Projects() {
  return (
    <main className="min-h-screen p-6">
      <Suspense fallback={null}>
        <ProjectsPage />
      </Suspense>
    </main>
  );
}