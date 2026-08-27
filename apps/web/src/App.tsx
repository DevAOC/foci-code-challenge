import { TodosPage } from "./components/TodosPage.js";
import { Toaster } from "./components/ui/sonner.js";

/** The whole application. Providers live in main.tsx (and the test harness) so this stays renderable anywhere. */
export function App() {
  return (
    <>
      <TodosPage />
      <Toaster position="bottom-center" />
    </>
  );
}
