import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import Index from "./pages/Index";
import TagSettings from "./pages/TagSettings";
import Archive from "./pages/Archive";
import PurchaseFrequency from "./pages/PurchaseFrequency";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('PWA registered');
    },
    onRegisterError(error) {
      console.log('PWA registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      if (confirm('有新版本可用，是否立即更新？')) {
        updateServiceWorker(true);
      }
    }
  }, [needRefresh, updateServiceWorker]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={routerBasename}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tags" element={<TagSettings />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/frequency" element={<PurchaseFrequency />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
