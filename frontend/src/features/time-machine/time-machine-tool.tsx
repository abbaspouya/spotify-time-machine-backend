import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Download, ExternalLink, LoaderCircle, Music4 } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { createPlaylistForGroup, getGroupedSongs } from "@/lib/api"
import type { GroupFilters } from "@/lib/types"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type GroupFilterDraft = {
  period: string
  order: string
  startYear: string
  endYear: string
}

const defaultGroupDraft: GroupFilterDraft = {
  period: "monthly",
  order: "asc",
  startYear: "",
  endYear: "",
}

const initialAppliedFilters: GroupFilters = {
  period: "monthly",
  order: "asc",
}

const periodOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Half-year", value: "semi" },
  { label: "Yearly", value: "yearly" },
]

const orderOptions = [
  { label: "Oldest to newest", value: "asc" },
  { label: "Newest to oldest", value: "desc" },
]

function groupCardLabel(groupKey: string, trackIds: string[]) {
  return `${groupKey} - ${trackIds.length} tracks`
}

export function TimeMachineTool() {
  const { isAuthenticated } = useSpotifySession()

  const [groupDraft, setGroupDraft] = useState<GroupFilterDraft>(defaultGroupDraft)
  const [appliedGroupFilters, setAppliedGroupFilters] = useState<GroupFilters>(initialAppliedFilters)
  const [selectedGroup, setSelectedGroup] = useState("")
  const [groupPlaylistName, setGroupPlaylistName] = useState("")
  const [groupPlaylistDescription, setGroupPlaylistDescription] = useState("")

  const groupedQuery = useQuery({
    queryKey: ["groupedSongs", appliedGroupFilters],
    queryFn: () => getGroupedSongs(appliedGroupFilters),
    enabled: isAuthenticated,
  })

  useEffect(() => {
    const groups = Object.keys(groupedQuery.data?.groups ?? {})
    if (!groups.length) {
      setSelectedGroup("")
      return
    }

    if (!selectedGroup || !(selectedGroup in (groupedQuery.data?.groups ?? {}))) {
      setSelectedGroup(groups[0])
    }
  }, [groupedQuery.data, selectedGroup])

  const groupedPlaylistMutation = useMutation({
    mutationFn: () =>
      createPlaylistForGroup({
        period: appliedGroupFilters.period,
        order: appliedGroupFilters.order,
        start_year: appliedGroupFilters.startYear,
        end_year: appliedGroupFilters.endYear,
        group_key: selectedGroup,
        playlist_name: groupPlaylistName || undefined,
        playlist_description: groupPlaylistDescription || undefined,
      }),
  })

  const handleApplyGroupFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setAppliedGroupFilters({
      period: groupDraft.period,
      order: groupDraft.order,
      startYear: groupDraft.startYear ? Number(groupDraft.startYear) : undefined,
      endYear: groupDraft.endYear ? Number(groupDraft.endYear) : undefined,
    })
  }

  const handleCreateGroupedPlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void groupedPlaylistMutation.mutateAsync()
  }

  const groupedEntries = Object.entries(groupedQuery.data?.groups ?? {})

  return (
    <section id="time-machine-tool" className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      <Card className="animate-fade-up [animation-delay:180ms]">
        <CardHeader>
          <CardTitle>Build time-based groups</CardTitle>
          <CardDescription>
            Filter your liked library, inspect the generated buckets, and choose the time slice you want to turn into a
            playlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleApplyGroupFilters}>
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Select
                id="period"
                value={groupDraft.period}
                onChange={(event) => setGroupDraft((current) => ({ ...current, period: event.target.value }))}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Order</Label>
              <Select
                id="order"
                value={groupDraft.order}
                onChange={(event) => setGroupDraft((current) => ({ ...current, order: event.target.value }))}
              >
                {orderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startYear">Start year</Label>
              <Input
                id="startYear"
                placeholder="2020"
                value={groupDraft.startYear}
                onChange={(event) => setGroupDraft((current) => ({ ...current, startYear: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endYear">End year</Label>
              <Input
                id="endYear"
                placeholder="2025"
                value={groupDraft.endYear}
                onChange={(event) => setGroupDraft((current) => ({ ...current, endYear: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Button className="w-full sm:w-auto" disabled={!isAuthenticated} type="submit">
                <Music4 className="h-4 w-4" />
                Load grouped songs
              </Button>
            </div>
          </form>

          {!isAuthenticated ? (
            <AuthRequiredNotice message="Connect Spotify first to load your liked songs." />
          ) : null}

          {groupedQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading grouped library...
            </div>
          ) : null}

          {groupedQuery.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(groupedQuery.error)}
            </p>
          ) : null}

          {groupedQuery.data ? (
            <div className="rounded-3xl border border-border bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Generated groups</p>
                <span className="text-sm text-muted-foreground">
                  {groupedEntries.length} groups - {groupedQuery.data.total_songs} total liked songs
                </span>
              </div>

              <div className="grid max-h-[320px] gap-3 overflow-auto pr-1">
                {groupedEntries.map(([groupKey, trackIds]) => {
                  const selected = selectedGroup === groupKey

                  return (
                    <button
                      key={groupKey}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/10 shadow-glow"
                          : "border-border bg-white/80 hover:border-primary/30"
                      }`}
                      onClick={() => setSelectedGroup(groupKey)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{groupKey}</p>
                          <p className="text-sm text-muted-foreground">{trackIds.length} tracks</p>
                        </div>
                        {selected ? <Badge>Selected</Badge> : <Badge variant="outline">Preview</Badge>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="animate-fade-up [animation-delay:220ms]">
        <CardHeader>
          <CardTitle>Create playlist from the selected group</CardTitle>
          <CardDescription>
            Give the time capsule a clean title and an optional curator note before creating it inside Spotify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-3xl border border-border bg-muted/45 p-4">
            <p className="text-sm font-medium text-foreground">Current target</p>
            <p className="mt-2 text-lg font-semibold">{selectedGroup || "No group selected yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedGroup && groupedQuery.data?.groups[selectedGroup]
                ? groupCardLabel(selectedGroup, groupedQuery.data.groups[selectedGroup])
                : "Load groups and pick one from the list on the left."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleCreateGroupedPlaylist}>
            <div className="space-y-2">
              <Label htmlFor="groupPlaylistName">Playlist name</Label>
              <Input
                id="groupPlaylistName"
                placeholder="Leave blank to use the backend default"
                value={groupPlaylistName}
                onChange={(event) => setGroupPlaylistName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupPlaylistDescription">Playlist description</Label>
              <Textarea
                id="groupPlaylistDescription"
                placeholder="Optional curator note for this time slice"
                value={groupPlaylistDescription}
                onChange={(event) => setGroupPlaylistDescription(event.target.value)}
              />
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!selectedGroup || groupedPlaylistMutation.isPending}
              type="submit"
            >
              {groupedPlaylistMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Create playlist
            </Button>
          </form>

          {groupedPlaylistMutation.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(groupedPlaylistMutation.error)}
            </p>
          ) : null}

          {groupedPlaylistMutation.data ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/8 p-4">
              <p className="font-semibold">{groupedPlaylistMutation.data.playlist_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {groupedPlaylistMutation.data.track_count} tracks added for {groupedPlaylistMutation.data.group_key}
              </p>
              <a
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                href={groupedPlaylistMutation.data.playlist_url}
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
