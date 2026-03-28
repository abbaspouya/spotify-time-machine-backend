import { Navigate, createBrowserRouter } from "react-router-dom"

import { AdvancedPage } from "@/pages/advanced-page"
import { AuthCallbackPage } from "@/pages/auth-callback-page"
import { HomePage } from "@/pages/home-page"
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
        element: <HomePage />,
      },
      {
        path: "connect",
        element: <Navigate to="/" replace />,
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
        path: "auth/callback",
        element: <AuthCallbackPage />,
      },
    ],
  },
])
