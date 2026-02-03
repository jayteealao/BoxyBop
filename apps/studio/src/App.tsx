/**
 * BoxyBop Studio - Main Application.
 *
 * Provides routing and layout structure:
 * - /workspace: Screenshot parser and component generator
 * - /design-systems: Browse generated UI packages
 * - /design-systems/:setSlug: View a specific design system
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/ui/Shell";
import { ToastProvider } from "./components/ui/Toast";
import { WorkspacePage } from "./pages/WorkspacePage";
import { DesignSystemsPage } from "./pages/DesignSystemsPage";
import { DesignSystemDetailPage } from "./pages/DesignSystemDetailPage";

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Shell layout wraps all routes via Outlet */}
          <Route element={<Shell />}>
            <Route path="/" element={<Navigate to="/workspace" replace />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/design-systems" element={<DesignSystemsPage />} />
            <Route path="/design-systems/:setSlug" element={<DesignSystemDetailPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
