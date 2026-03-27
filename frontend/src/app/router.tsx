import { Navigate, createBrowserRouter } from "react-router-dom"

import { AdvancedPage } from "@/pages/advanced-page"
import { AuthCallbackPage } from "@/pages/auth-callback-page"
import { ConnectPage } from "@/pages/connect-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { RootLayout } from "@/pages/root-layout"
import { TimeMachinePage } from "@/pages/time-machine-page"
import { TransferLibraryPage } from "@/pages/transfer-library-page"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="connect" replace />,
      },
      {
        path: "connect",
        element: <ConnectPage />,
      },
      {
        path: "time-machine",
        element: <TimeMachinePage />,
      },
      {
        path: "transfer-library",
        element: <TransferLibraryPage />,
      },
      {
        path: "advanced",
        element: <AdvancedPage />,
      },
      {
        path: "workspace",
        element: <DashboardPage />,
      },
      {
        path: "auth/callback",
        element: <AuthCallbackPage />,
      },
    ],
  },
])
