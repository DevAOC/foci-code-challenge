import { TodosPage } from "./components/TodosPage.js";

/** The whole application. Providers live in main.tsx (and the test harness) so this stays renderable anywhere. */
export function App() {
  return <TodosPage />;
}
