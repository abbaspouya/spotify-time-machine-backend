import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Download, Languages, ExternalLink, LoaderCircle } from "lucide-react"
import { useMutation } from "@tanstack/react-query"

import { createPlaylistByLanguage, startLanguageGroupsJob } from "@/lib/api"
import type { LanguageGroupsResponse } from "@/lib/types"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { JobStatusCard } from "@/features/jobs/job-status-card"
import { isActiveJobStatus, useAsyncJob } from "@/features/jobs/use-async-job"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LanguageLab() {
  const { isAuthenticated } = useSpotifySession()

  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [languagePlaylistName, setLanguagePlaylistName] = useState("")
  const [languageMinSongs, setLanguageMinSongs] = useState("5")
  const [languageJobId, setLanguageJobId] = useState<string | null>(null)
  const [languageGroupsResult, setLanguageGroupsResult] = useState<LanguageGroupsResponse | null>(null)

  const startLanguageJobMutation = useMutation({
    mutationFn: startLanguageGroupsJob,
    onSuccess: (job) => {
      setLanguageJobId(job.job_id)
    },
  })

  const languageGroupsJobQuery = useAsyncJob<LanguageGroupsResponse>(languageJobId)

  useEffect(() => {
    if (languageGroupsJobQuery.data?.status === "completed" && languageGroupsJobQuery.data.result) {
      setLanguageGroupsResult(languageGroupsJobQuery.data.result)
    }
  }, [languageGroupsJobQuery.data])

  useEffect(() => {
    const languages = Object.keys(languageGroupsResult?.groups ?? {})
    if (!languages.length) {
      setSelectedLanguage("")
      return
    }

    if (!selectedLanguage || !(selectedLanguage in (languageGroupsResult?.groups ?? {}))) {
      setSelectedLanguage(languages[0])
    }
  }, [languageGroupsResult, selectedLanguage])

  const languagePlaylistMutation = useMutation({
    mutationFn: () =>
      createPlaylistByLanguage({
        language_code: selectedLanguage,
        playlist_name: languagePlaylistName || undefined,
        min_songs: Number(languageMinSongs) || 5,
      }),
  })

  const activeLanguageJob = languageGroupsJobQuery.data ?? startLanguageJobMutation.data ?? null
  const isLoadingLanguages = isActiveJobStatus(activeLanguageJob?.status)
  const languageEntries = Object.entries(languageGroupsResult?.groups ?? {}).sort((left, right) => {
    return right[1].length - left[1].length
  })

  const handleCreateLanguagePlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void languagePlaylistMutation.mutateAsync()
  }

  const handleLoadLanguages = () => {
    setLanguageGroupsResult(null)
    setSelectedLanguage("")
    setLanguageJobId(null)
    languagePlaylistMutation.reset()
    void startLanguageJobMutation.mutateAsync()
  }

  return (
    <section id="language-lab" className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      <Card className="animate-fade-up [animation-delay:180ms]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Language-based playlist builder</CardTitle>
            <Badge variant="outline">Beta</Badge>
          </div>
          <CardDescription>
            Detect likely languages from track and artist names, then inspect the grouped results before creating a
            playlist. Treat the suggestions as a helpful starting point, not a guaranteed classification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button
            className="w-full sm:w-auto"
            disabled={!isAuthenticated || isLoadingLanguages || startLanguageJobMutation.isPending}
            onClick={handleLoadLanguages}
            variant="secondary"
          >
            {isLoadingLanguages ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
            Load language groups
          </Button>

          {!isAuthenticated ? (
            <AuthRequiredNotice message="Connect Spotify first to inspect language group suggestions." />
          ) : null}

          <JobStatusCard
            job={activeLanguageJob}
            title="Language grouping job"
            idleMessage="Run the beta language scan when you want a creative, approximate grouping of your liked songs."
          />

          {startLanguageJobMutation.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(startLanguageJobMutation.error)}
            </p>
          ) : null}

          {languageGroupsJobQuery.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(languageGroupsJobQuery.error)}
            </p>
          ) : null}

          {languageEntries.length ? (
            <div className="grid max-h-[320px] gap-3 overflow-auto pr-1">
              {languageEntries.map(([languageCode, trackIds]) => {
                const selected = selectedLanguage === languageCode

                return (
                  <button
                    key={languageCode}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-white/80 hover:border-primary/30"
                    }`}
                    onClick={() => setSelectedLanguage(languageCode)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold uppercase">{languageCode}</p>
                        <p className="text-sm text-muted-foreground">{trackIds.length} detected tracks</p>
                      </div>
                      {selected ? <Badge>Selected</Badge> : <Badge variant="outline">Use</Badge>}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="animate-fade-up [animation-delay:220ms]">
        <CardHeader>
          <CardTitle>Create playlist by language</CardTitle>
          <CardDescription>
            Keep the selection tighter by requiring a minimum detected track count before the playlist is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-3xl border border-border bg-muted/45 p-4">
            <p className="text-sm font-medium text-foreground">Current language</p>
            <p className="mt-2 text-lg font-semibold uppercase">{selectedLanguage || "No language selected yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Beta suggestions are based on track and artist naming, so double-check the selection before creating a playlist.
            </p>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateLanguagePlaylist}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="languagePlaylistName">Playlist name</Label>
              <Input
                id="languagePlaylistName"
                placeholder="Optional custom playlist name"
                value={languagePlaylistName}
                onChange={(event) => setLanguagePlaylistName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="languageMinSongs">Minimum songs</Label>
              <Input
                id="languageMinSongs"
                min="1"
                type="number"
                value={languageMinSongs}
                onChange={(event) => setLanguageMinSongs(event.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button className="w-full" disabled={!selectedLanguage || languagePlaylistMutation.isPending || isLoadingLanguages} type="submit">
                {languagePlaylistMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Create language playlist
              </Button>
            </div>
          </form>

          {languagePlaylistMutation.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(languagePlaylistMutation.error)}
            </p>
          ) : null}

          {languagePlaylistMutation.data ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/8 p-4">
              <p className="font-semibold">{languagePlaylistMutation.data.playlist_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {languagePlaylistMutation.data.track_count} tracks added for language{" "}
                {languagePlaylistMutation.data.language?.toUpperCase()}
              </p>
              <a
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                href={languagePlaylistMutation.data.playlist_url}
                rel="noreferrer"
                target="_blank"
              >
                Open in Spotify
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
