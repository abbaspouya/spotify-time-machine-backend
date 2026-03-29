import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, Download, ExternalLink, LoaderCircle, Music4 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"

import { createPlaylistForGroup, startGroupedSongsJob } from "@/lib/api"
import type { GroupFilters, GroupedSongsResponse } from "@/lib/types"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { JobStatusCard } from "@/features/jobs/job-status-card"
import { isActiveJobStatus, useAsyncJob } from "@/features/jobs/use-async-job"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

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
  const [groupJobId, setGroupJobId] = useState<string | null>(null)
  const [groupedResult, setGroupedResult] = useState<GroupedSongsResponse | null>(null)

  const startGroupedJobMutation = useMutation({
    mutationFn: startGroupedSongsJob,
    onSuccess: (job) => {
      setGroupJobId(job.job_id)
    },
  })

  const groupedJobQuery = useAsyncJob<GroupedSongsResponse>(groupJobId)

  useEffect(() => {
    if (groupedJobQuery.data?.status === "completed" && groupedJobQuery.data.result) {
      setGroupedResult(groupedJobQuery.data.result)
    }
  }, [groupedJobQuery.data])

  useEffect(() => {
    const groups = Object.keys(groupedResult?.groups ?? {})
    if (!groups.length) {
      setSelectedGroup("")
      return
    }

    if (!selectedGroup || !(selectedGroup in (groupedResult?.groups ?? {}))) {
      setSelectedGroup(groups[0])
    }
  }, [groupedResult, selectedGroup])

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

  const activeGroupedJob = groupedJobQuery.data ?? startGroupedJobMutation.data ?? null
  const isGrouping = isActiveJobStatus(activeGroupedJob?.status)
  const groupedEntries = Object.entries(groupedResult?.groups ?? {})
  const selectedTrackIds = selectedGroup && groupedResult?.groups[selectedGroup] ? groupedResult.groups[selectedGroup] : null

  const handleApplyGroupFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextFilters = {
      period: groupDraft.period,
      order: groupDraft.order,
      startYear: groupDraft.startYear ? Number(groupDraft.startYear) : undefined,
      endYear: groupDraft.endYear ? Number(groupDraft.endYear) : undefined,
    }

    setAppliedGroupFilters(nextFilters)
    setGroupedResult(null)
    setSelectedGroup("")
    setGroupJobId(null)
    groupedPlaylistMutation.reset()
    void startGroupedJobMutation.mutateAsync(nextFilters)
  }

  const handleCreateGroupedPlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void groupedPlaylistMutation.mutateAsync()
  }

  const flowSteps = [
    {
      label: "Set filters",
      state: groupedResult ? "done" : "current",
    },
    {
      label: "Pick a group",
      state: selectedGroup ? "done" : groupedEntries.length ? "current" : "pending",
    },
    {
      label: "Create playlist",
      state: groupedPlaylistMutation.data ? "done" : selectedGroup ? "current" : "pending",
    },
  ] as const

  return (
    <section id="time-machine-tool" className="section-shell animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span className="hero-badge">One connected workflow</span>
        <Badge variant={selectedGroup ? "default" : "outline"}>
          {selectedGroup ? `${selectedGroup} selected` : "Choose a time slice"}
        </Badge>
      </div>

      <div className="mt-6 space-y-4">
        <h2 className="max-w-3xl text-3xl leading-tight md:text-4xl">Build the groups, pick the slice, create the playlist.</h2>
        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
          The flow now behaves like one machine: configure the grouping on the left, choose the slice that looks right,
          and send it forward into playlist creation on the right.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-3 overflow-x-auto pb-2">
        {flowSteps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className={cn(
                "flex min-w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                step.state === "done"
                  ? "border-primary/30 bg-primary/12 text-primary"
                  : step.state === "current"
                    ? "border-white/15 bg-white/8 text-foreground"
                    : "border-white/10 bg-transparent text-foreground/55",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  step.state === "done"
                    ? "bg-primary text-primary-foreground"
                    : step.state === "current"
                      ? "bg-white/10 text-foreground"
                      : "bg-white/5 text-foreground/60",
                )}
              >
                {index + 1}
              </span>
              {step.label}
            </div>
            {index < flowSteps.length - 1 ? <div className="h-px w-10 shrink-0 bg-gradient-to-r from-primary/35 to-white/10" /> : null}
          </div>
        ))}
      </div>

      <div className="relative mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="pointer-events-none absolute bottom-10 left-1/2 top-10 hidden w-px -translate-x-1/2 bg-gradient-to-b from-primary/0 via-primary/25 to-primary/0 xl:block" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary shadow-panel">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-panel">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Step 1</p>
            <h3 className="text-2xl font-semibold">Build time-based groups</h3>
            <p className="text-sm text-muted-foreground">
              Filter your liked library, run the grouping job, and choose the time slice you want to send into playlist
              creation.
            </p>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleApplyGroupFilters}>
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
              <Button className="w-full sm:w-auto" disabled={!isAuthenticated || isGrouping || startGroupedJobMutation.isPending} type="submit">
                <Music4 className="h-4 w-4" />
                Load grouped songs
              </Button>
            </div>
          </form>

          <div className="mt-5 space-y-4">
            {!isAuthenticated ? <AuthRequiredNotice message="Connect Spotify first to load your liked songs." /> : null}

            <JobStatusCard
              job={activeGroupedJob}
              title="Grouping job"
              idleMessage="Choose filters and load grouped songs to build fresh time slices from your liked library."
            />

            {startGroupedJobMutation.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(startGroupedJobMutation.error)}
              </p>
            ) : null}

            {groupedJobQuery.isError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {getErrorMessage(groupedJobQuery.error)}
              </p>
            ) : null}

            <div className="rounded-[28px] border border-white/10 bg-background/35 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Generated groups</p>
                <span className="text-sm text-muted-foreground">
                  {groupedResult ? `${groupedEntries.length} groups - ${groupedResult.total_songs} total liked songs` : "Load groups to start"}
                </span>
              </div>

              {groupedResult ? (
                <div className="grid max-h-[320px] gap-3 overflow-auto pr-1">
                  {groupedEntries.map(([groupKey, trackIds]) => {
                    const selected = selectedGroup === groupKey

                    return (
                      <button
                        key={groupKey}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/10 shadow-glow"
                            : "border-border bg-white/80 hover:border-primary/30",
                        )}
                        onClick={() => setSelectedGroup(groupKey)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{groupKey}</p>
                            <p className="text-sm text-muted-foreground">{trackIds.length} tracks</p>
                          </div>
                          {selected ? <Badge>Selected</Badge> : <Badge variant="outline">Send right</Badge>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-muted-foreground">
                  Run the grouping step first, then the time slices will appear here and feed into playlist creation.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-panel">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Step 2</p>
            <h3 className="text-2xl font-semibold">Create playlist from the selected group</h3>
            <p className="text-sm text-muted-foreground">
              Once a slice is selected, the second station is ready for naming, notes, and playlist creation inside
              Spotify.
            </p>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-background/35 p-4">
            <p className="text-sm font-medium text-foreground">Current target</p>
            <p className="mt-2 text-lg font-semibold">{selectedGroup || "No group selected yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedTrackIds ? groupCardLabel(selectedGroup, selectedTrackIds) : "Load groups and pick one from the left-hand station."}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCreateGroupedPlaylist}>
            <div className="space-y-2">
              <Label htmlFor="groupPlaylistName">Playlist name</Label>
              <Input
                id="groupPlaylistName"
                placeholder="Leave blank to use an automatic title"
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
              disabled={!selectedGroup || groupedPlaylistMutation.isPending || isGrouping}
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
            <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(groupedPlaylistMutation.error)}
            </p>
          ) : null}

          {groupedPlaylistMutation.data ? (
            <div className="mt-4 rounded-[28px] border border-primary/20 bg-primary/8 p-4">
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
        </div>
      </div>
    </section>
  )
}
