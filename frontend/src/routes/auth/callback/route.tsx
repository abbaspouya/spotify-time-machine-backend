import { useEffect } from "react"
import { CheckCircle2, LoaderCircle, OctagonAlert } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const status = searchParams.get("status") ?? "error"
  const detail = searchParams.get("detail")
  const isSuccess = status === "success"

  useEffect(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["authStatus"] }),
      queryClient.invalidateQueries({ queryKey: ["whoami"] }),
    ])

    const timeout = window.setTimeout(() => {
      navigate(isSuccess ? "/app" : "/", { replace: true })
    }, isSuccess ? 1400 : 2800)

    return () => window.clearTimeout(timeout)
  }, [isSuccess, navigate, queryClient])

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="max-w-xl animate-fade-up">
        <CardHeader>
          <div
            className={cn(
              "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
              isSuccess ? "bg-primary/12 text-primary" : "bg-destructive/10 text-destructive",
            )}
          >
            {isSuccess ? <CheckCircle2 className="h-7 w-7" /> : <OctagonAlert className="h-7 w-7" />}
          </div>
          <CardTitle>{isSuccess ? "Spotify connection complete" : "Spotify connection failed"}</CardTitle>
          <CardDescription>
            {isSuccess
              ? "Your Spotify connection is ready and the app is refreshing."
              : detail || "Spotify did not return a usable authorization code."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
            {isSuccess ? "Redirecting into the dashboard now." : "Redirecting back to the homepage now."}
          </div>
          <Link to={isSuccess ? "/app" : "/"} className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
            {isSuccess ? "Open dashboard now" : "Return to homepage"}
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
