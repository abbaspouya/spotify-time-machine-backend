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
  const accountRole = searchParams.get("account_role") ?? "source"
  const returnTo = searchParams.get("return_to")
  const isSuccess = status === "success"

  useEffect(() => {
    void Promise.all(
      ["authStatus", "whoami"].map((queryRoot) =>
        queryClient.invalidateQueries({
          predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === queryRoot,
        }),
      ),
    )

    const timeout = window.setTimeout(() => {
      navigate(isSuccess ? returnTo || "/app" : returnTo || "/", { replace: true })
    }, isSuccess ? 1400 : 2800)

    return () => window.clearTimeout(timeout)
  }, [isSuccess, navigate, queryClient, returnTo])

  const successTitle = accountRole === "target" ? "Import account connection complete" : "Spotify connection complete"
  const successDescription =
    accountRole === "target"
      ? "Your import account is ready and the transfer page is refreshing."
      : "Your Spotify connection is ready and the app is refreshing."

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
          <CardTitle>{isSuccess ? successTitle : "Spotify connection failed"}</CardTitle>
          <CardDescription>
            {isSuccess
              ? successDescription
              : detail || "Spotify did not return a usable authorization code."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
            {isSuccess
              ? `Redirecting back to ${returnTo || "/app"} now.`
              : `Redirecting back to ${returnTo || "/"} now.`}
          </div>
          <Link
            to={isSuccess ? returnTo || "/app" : returnTo || "/"}
            className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          >
            {isSuccess ? "Open destination now" : "Return now"}
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
