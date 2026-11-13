import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/components/layout/Providers";
import { APP_ROUTES } from "@/config/routes";

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppShell>
          <Routes>
            {APP_ROUTES.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </Providers>
  );
}
