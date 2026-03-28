type AuthRequiredNoticeProps = {
  message: string
}

export function AuthRequiredNotice({ message }: AuthRequiredNoticeProps) {
  return (
    <p className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
      {message}
    </p>
  )
}
