import { Suspense } from "react";
import TasksPage from "@/components/tasks/TasksPage";

// TasksPage now reads useSearchParams() (for the ?open=<id> deep link from
// Calendar) — Next.js requires that be wrapped in Suspense or `next build`
// fails while trying to statically prerender this route. Dev mode doesn't
// enforce this, so it can pass locally and only break on a real build —
// same gotcha already noted in app/login/page.tsx.
export default function Tasks() {
  return (
    <main className="min-h-screen p-6">
      <Suspense fallback={null}>
        <TasksPage />
      </Suspense>
    </main>
  );
}