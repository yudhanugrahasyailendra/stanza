import { trpc } from "@/lib/trpc";
import { createQueryClient, createTrpcClient } from "@/lib/trpcClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const queryClient = createQueryClient();
const trpcClient = createTrpcClient();

async function mountApp() {
  try { await fetch("/api/csrf", { credentials: "include", cache: "no-store" }); } catch {}
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
void mountApp();
