import { createBrowserRouter } from "react-router-dom"

import { AuthCallbackPage } from "@/pages/auth-callback-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { RootLayout } from "@/pages/root-layout"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "auth/callback",
        element: <AuthCallbackPage />,
      },
    ],
  },
])
