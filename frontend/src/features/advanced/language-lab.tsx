import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Download, Languages, ExternalLink, LoaderCircle } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { createPlaylistByLanguage, getLanguageGroups } from "@/lib/api"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
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

  const languageGroupsQuery = useQuery({
    queryKey: ["languageGroups"],
    queryFn: getLanguageGroups,
    enabled: false,
  })

  useEffect(() => {
    const languages = Object.keys(languageGroupsQuery.data?.groups ?? {})
    if (!languages.length) {
      setSelectedLanguage("")
      return
    }

    if (!selectedLanguage || !(selectedLanguage in (languageGroupsQuery.data?.groups ?? {}))) {
      setSelectedLanguage(languages[0])
    }
  }, [languageGroupsQuery.data, selectedLanguage])

  const languagePlaylistMutation = useMutation({
    mutationFn: () =>
      createPlaylistByLanguage({
        language_code: selectedLanguage,
        playlist_name: languagePlaylistName || undefined,
        min_songs: Number(languageMinSongs) || 5,
      }),
  })

  const handleCreateLanguagePlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void languagePlaylistMutation.mutateAsync()
  }

  const languageEntries = Object.entries(languageGroupsQuery.data?.groups ?? {}).sort((left, right) => {
    return right[1].length - left[1].length
  })

  return (
    <section id="language-lab" className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      <Card className="animate-fade-up [animation-delay:180ms]">
        <CardHeader>
          <CardTitle>Language-based playlist builder</CardTitle>
          <CardDescription>
            Detect likely languages from track and artist names, then inspect the grouped results before creating a
            playlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button
            className="w-full sm:w-auto"
            disabled={!isAuthenticated || languageGroupsQuery.isFetching}
            onClick={() => void languageGroupsQuery.refetch()}
            variant="secondary"
          >
            {languageGroupsQuery.isFetching ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
            Load language groups
          </Button>

          {!isAuthenticated ? (
            <AuthRequiredNotice message="Connect Spotify first to inspect language group suggestions." />
          ) : null}

          {languageGroupsQuery.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(languageGroupsQuery.error)}
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
          ) : (
            <p className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
              Load language groups to inspect the current results.
            </p>
          )}
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
              <Button className="w-full" disabled={!selectedLanguage || languagePlaylistMutation.isPending} type="submit">
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
