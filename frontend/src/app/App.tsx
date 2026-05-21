import AppRouter from "./router";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary context="Application">
      <Toaster position="top-right" />
      <AppRouter />
    </ErrorBoundary>
  );
}
