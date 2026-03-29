import { Navigate, createBrowserRouter } from "react-router-dom"

import { AdvancedPage } from "@/routes/advanced/route"
import { AuthCallbackPage } from "@/routes/auth/callback/route"
import { HomePage } from "@/routes/home/route"
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
