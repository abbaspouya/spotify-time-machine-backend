import { Navigate, createBrowserRouter } from "react-router-dom"

import { AppLayout } from "@/routes/app/layout"
import { AdvancedPage } from "@/routes/advanced/route"
import { AuthCallbackPage } from "@/routes/auth/callback/route"
import { HomePage } from "@/routes/home/route"
import { LandingPage } from "@/routes/landing/route"
import { RootLayout } from "@/routes/root/layout"
import { TimeMachinePage } from "@/routes/time-machine/route"
import { TransferLibraryPage } from "@/routes/transfer-library/route"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "connect",
        element: <Navigate to="/" replace />,
      },
      {
        path: "time-machine",
        element: <Navigate to="/app/time-machine" replace />,
      },
      {
        path: "transfer-library",
        element: <Navigate to="/app/transfer-library" replace />,
      },
      {
        path: "advanced",
        element: <Navigate to="/app/advanced" replace />,
      },
      {
        path: "dashboard",
        element: <Navigate to="/app" replace />,
      },
      {
        path: "auth/callback",
        element: <AuthCallbackPage />,
      },
    ],
  },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
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
    ],
  },
])
