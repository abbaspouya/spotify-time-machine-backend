import { useEffect, useMemo, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileUp, LoaderCircle, ShieldAlert } from "lucide-react"
import { useMutation } from "@tanstack/react-query"

import { previewSnapshotImport, startExportSnapshotJob, startImportSnapshotJob } from "@/lib/api"
import type {
  ExportSnapshotResponse,
  ImportedPlaylistSummary,
  SnapshotImportPreviewResponse,
  ImportSnapshotResponse,
  ImportSnapshotSummary,
  SnapshotCounts,
  SnapshotDocument,
} from "@/lib/types"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { JobStatusCard } from "@/features/jobs/job-status-card"
import { isActiveJobStatus, useAsyncJob } from "@/features/jobs/use-async-job"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const exportToggleFields = [
  { label: "Include playlists", key: "includePlaylists" },
  { label: "Include liked tracks", key: "includeLikedTracks" },
  { label: "Include saved albums", key: "includeSavedAlbums" },
  { label: "Include followed artists", key: "includeFollowedArtists" },
] as const

const importToggleFields = [
  { label: "Import playlists", key: "importPlaylists" },
  { label: "Import liked tracks", key: "importLikedTracks" },
  { label: "Import saved albums", key: "importSavedAlbums" },
  { label: "Import followed artists", key: "importFollowedArtists" },
  { label: "Clear existing first", key: "clearExistingBeforeImport" },
  { label: "Strict liked order", key: "strictLikedOrder" },
] as const

const exportCountLabels: Array<{ key: keyof SnapshotCounts; label: string }> = [
  { key: "playlists", label: "Playlists" },
  { key: "playlist_tracks", label: "Playlist tracks" },
  { key: "liked_tracks", label: "Liked songs" },
  { key: "saved_albums", label: "Saved albums" },
  { key: "followed_artists", label: "Followed artists" },
]

const primaryImportSummaryLabels: Array<{ key: keyof ImportSnapshotSummary; label: string }> = [
  { key: "playlists_created", label: "Playlists to create" },
  { key: "playlist_tracks_added", label: "Playlist tracks to add" },
  { key: "liked_tracks_added", label: "Liked songs to add" },
  { key: "saved_albums_added", label: "Albums to save" },
  { key: "followed_artists_added", label: "Artists to follow" },
]

const removalSummaryLabels: Array<{ key: keyof ImportSnapshotSummary; label: string }> = [
  { key: "playlists_removed", label: "Playlists to remove first" },
  { key: "liked_tracks_removed", label: "Liked songs to remove first" },
  { key: "saved_albums_removed", label: "Saved albums to remove first" },
  { key: "followed_artists_removed", label: "Artists to unfollow first" },
]

const failureSummaryLabels: Array<{ key: keyof ImportSnapshotSummary; label: string }> = [
  { key: "playlist_tracks_failed", label: "Playlist track failures" },
  { key: "liked_tracks_failed", label: "Liked song failures" },
  { key: "saved_albums_failed", label: "Album failures" },
  { key: "followed_artists_failed", label: "Artist follow failures" },
]

type DownloadedSnapshotResponse = ExportSnapshotResponse & {
  snapshot: SnapshotDocument
  downloaded_file_name: string
}

type PreviewSnapshotResult = {
  response: SnapshotImportPreviewResponse
  snapshot: SnapshotDocument
}

type UploadedImportResponse = ImportSnapshotResponse & {
  imported_file_name: string
}

function sanitizeFileName(value: string) {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_").replace(/\s+/g, "_")
  if (!sanitized) {
    return ""
  }

  return sanitized.toLowerCase().endsWith(".json") ? sanitized : `${sanitized}.json`
}

function buildSnapshotFileName(response: ExportSnapshotResponse, preferredName: string) {
  const requestedName = sanitizeFileName(preferredName)
  if (requestedName) {
    return requestedName
  }

  const userId = response.source_user_id || "spotify-account"
  const exportedAt = response.exported_at
    ? response.exported_at.replace(/[:.]/g, "-")
    : new Date().toISOString().replace(/[:.]/g, "-")
  return `spotify-snapshot-${userId}-${exportedAt}.json`
}

function downloadSnapshotFile(snapshot: SnapshotDocument, fileName: string) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

function snapshotDocumentToFile(snapshot: SnapshotDocument, fileName: string) {
  return new File([JSON.stringify(snapshot, null, 2)], fileName, { type: "application/json" })
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

async function readSnapshotDocument(file: File): Promise<SnapshotDocument> {
  const raw = await file.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("The selected file is not valid JSON.")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The snapshot file must contain a JSON object.")
  }

  return parsed as SnapshotDocument
}

function SummaryGrid({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border bg-white/80 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-display">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) {
    return null
  }

  return (
    <div className="rounded-3xl border border-accent/35 bg-accent/10 p-4 text-sm text-foreground">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Review these warnings
      </div>
      <div className="grid gap-2">
        {warnings.map((warning) => (
          <div key={warning} className="rounded-2xl border border-border bg-white/70 px-3 py-2">
            {warning}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaylistList({ playlists }: { playlists: ImportedPlaylistSummary[] }) {
  if (!playlists.length) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground">Created playlists</div>
      <div className="grid gap-3">
        {playlists.slice(0, 6).map((playlist) => (
          <div key={`${playlist.id}-${playlist.name}`} className="rounded-2xl border border-border bg-white/75 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{playlist.name}</p>
            {playlist.external_url ? (
              <a
                className="mt-2 inline-flex items-center gap-2 text-primary hover:underline"
                href={playlist.external_url}
                rel="noreferrer"
                target="_blank"
              >
                Open in Spotify
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {playlists.length > 6 ? (
        <p className="text-sm text-muted-foreground">{playlists.length - 6} more playlists were created during this import.</p>
      ) : null}
    </div>
  )
}

function DestructiveOperationList({ operations }: { operations: string[] }) {
  if (!operations.length) {
    return null
  }

  return (
    <div className="rounded-3xl border border-destructive/25 bg-destructive/8 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-destructive">
        <ShieldAlert className="h-4 w-4" />
        Destructive changes
      </div>
      <div className="grid gap-2 text-sm text-destructive">
        {operations.map((operation) => (
          <div key={operation} className="rounded-2xl border border-destructive/20 bg-white/80 px-3 py-2">
            {operation}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TransferLibraryTool() {
  const { isAuthenticated } = useSpotifySession()

  const [exportForm, setExportForm] = useState({
    cutoffDate: "",
    includePlaylists: true,
    includeLikedTracks: true,
    includeSavedAlbums: true,
    includeFollowedArtists: true,
    outputFileName: "",
  })

  const [exportJobId, setExportJobId] = useState<string | null>(null)
  const [requestedExportFileName, setRequestedExportFileName] = useState("")
  const [lastDownloadedExportJobId, setLastDownloadedExportJobId] = useState<string | null>(null)
  const [exportResult, setExportResult] = useState<DownloadedSnapshotResponse | null>(null)

  const [snapshotFile, setSnapshotFile] = useState<File | null>(null)
  const [previewedSnapshot, setPreviewedSnapshot] = useState<SnapshotDocument | null>(null)
  const [previewData, setPreviewData] = useState<SnapshotImportPreviewResponse["preview"] | null>(null)
  const [importConfirmationChecked, setImportConfirmationChecked] = useState(false)
  const [importJobId, setImportJobId] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<UploadedImportResponse | null>(null)
  const [importForm, setImportForm] = useState({
    importPlaylists: true,
    importLikedTracks: true,
    importSavedAlbums: true,
    importFollowedArtists: true,
    clearExistingBeforeImport: false,
    strictLikedOrder: false,
  })

  const startExportJobMutation = useMutation({
    mutationFn: startExportSnapshotJob,
    onSuccess: (job) => {
      setExportJobId(job.job_id)
    },
  })

  const exportJobQuery = useAsyncJob<ExportSnapshotResponse>(exportJobId)

  useEffect(() => {
    if (
      exportJobQuery.data?.status === "completed" &&
      exportJobQuery.data.result?.snapshot &&
      exportJobQuery.data.job_id !== lastDownloadedExportJobId
    ) {
      const downloadedFileName = buildSnapshotFileName(exportJobQuery.data.result, requestedExportFileName)
      downloadSnapshotFile(exportJobQuery.data.result.snapshot, downloadedFileName)
      setExportResult({
        ...exportJobQuery.data.result,
        snapshot: exportJobQuery.data.result.snapshot,
        downloaded_file_name: downloadedFileName,
      })
      setLastDownloadedExportJobId(exportJobQuery.data.job_id)
    }
  }, [exportJobQuery.data, lastDownloadedExportJobId, requestedExportFileName])

  const previewSnapshotMutation = useMutation({
    mutationFn: async (): Promise<PreviewSnapshotResult> => {
      if (!snapshotFile) {
        throw new Error("Choose a snapshot file before previewing the import.")
      }

      const snapshot = await readSnapshotDocument(snapshotFile)
      const response = await previewSnapshotImport({
        snapshot,
        import_playlists: importForm.importPlaylists,
        import_liked_tracks: importForm.importLikedTracks,
        import_saved_albums: importForm.importSavedAlbums,
        import_followed_artists: importForm.importFollowedArtists,
        clear_existing_before_import: importForm.clearExistingBeforeImport,
        strict_liked_order: importForm.strictLikedOrder,
      })

      return { response, snapshot }
    },
    onSuccess: ({ response, snapshot }) => {
      setPreviewData(response.preview)
      setPreviewedSnapshot(snapshot)
      setImportConfirmationChecked(false)
    },
  })

  const startImportJobMutation = useMutation({
    mutationFn: async () => {
      if (!snapshotFile) {
        throw new Error("Choose a snapshot file before starting the import.")
      }

      const snapshot = previewedSnapshot || (await readSnapshotDocument(snapshotFile))
      return startImportSnapshotJob({
        snapshot,
        import_playlists: importForm.importPlaylists,
        import_liked_tracks: importForm.importLikedTracks,
        import_saved_albums: importForm.importSavedAlbums,
        import_followed_artists: importForm.importFollowedArtists,
        clear_existing_before_import: importForm.clearExistingBeforeImport,
        strict_liked_order: importForm.strictLikedOrder,
      })
    },
    onSuccess: (job) => {
      setImportJobId(job.job_id)
    },
  })

  const importJobQuery = useAsyncJob<ImportSnapshotResponse>(importJobId)

  useEffect(() => {
    if (importJobQuery.data?.status === "completed" && importJobQuery.data.result && snapshotFile) {
      setImportResult({
        ...importJobQuery.data.result,
        imported_file_name: snapshotFile.name,
      })
    }
  }, [importJobQuery.data, snapshotFile])

  const activeExportJob = exportJobQuery.data ?? startExportJobMutation.data ?? null
  const activeImportJob = importJobQuery.data ?? startImportJobMutation.data ?? null
  const isExporting = isActiveJobStatus(activeExportJob?.status)
  const isImporting = isActiveJobStatus(activeImportJob?.status)

  const exportSummaryItems = useMemo(() => {
    const counts = exportResult?.counts
    if (!counts) {
      return []
    }

    return exportCountLabels.map(({ key, label }) => ({
      label,
      value: counts[key] ?? 0,
    }))
  }, [exportResult])

  const previewPrimarySummaryItems = useMemo(() => {
    const summary = previewData?.summary
    if (!summary) {
      return []
    }

    return primaryImportSummaryLabels.map(({ key, label }) => ({
      label,
      value: summary[key] ?? 0,
    }))
  }, [previewData])

  const previewRemovalItems = useMemo(() => {
    const summary = previewData?.summary
    if (!summary) {
      return []
    }

    return removalSummaryLabels
      .map(({ key, label }) => ({ label, value: summary[key] ?? 0 }))
      .filter((item) => item.value > 0)
  }, [previewData])

  const importFailureItems = useMemo(() => {
    const summary = importResult?.result.summary
    if (!summary) {
      return []
    }

    return failureSummaryLabels
      .map(({ key, label }) => ({ label, value: summary[key] ?? 0 }))
      .filter((item) => item.value > 0)
  }, [importResult])

  const importRemovalItems = useMemo(() => {
    const summary = importResult?.result.summary
    if (!summary) {
      return []
    }

    return removalSummaryLabels
      .map(({ key, label }) => ({ label, value: summary[key] ?? 0 }))
      .filter((item) => item.value > 0)
  }, [importResult])

  const resetImportWorkflow = () => {
    setPreviewData(null)
    setPreviewedSnapshot(null)
    setImportConfirmationChecked(false)
    setImportJobId(null)
    setImportResult(null)
    previewSnapshotMutation.reset()
    startImportJobMutation.reset()
  }

  const handleExportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setExportResult(null)
    setExportJobId(null)
    setLastDownloadedExportJobId(null)
    setRequestedExportFileName(exportForm.outputFileName)
    void startExportJobMutation.mutateAsync({
      cutoff_date: exportForm.cutoffDate ? new Date(exportForm.cutoffDate).toISOString() : undefined,
      include_playlists: exportForm.includePlaylists,
      include_liked_tracks: exportForm.includeLikedTracks,
      include_saved_albums: exportForm.includeSavedAlbums,
      include_followed_artists: exportForm.includeFollowedArtists,
      write_to_file: false,
      output_file_name: exportForm.outputFileName || undefined,
      return_snapshot: true,
    })
  }

  const handleImportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!previewData) {
      return
    }

    void startImportJobMutation.mutateAsync()
  }

  const handlePreviewImport = async () => {
    resetImportWorkflow()
    await previewSnapshotMutation.mutateAsync()
  }

  const handleSnapshotFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null
    setSnapshotFile(nextFile)
    resetImportWorkflow()
  }

  const handleDownloadAgain = () => {
    if (!exportResult?.snapshot) {
      return
    }

    downloadSnapshotFile(exportResult.snapshot, exportResult.downloaded_file_name)
  }

  const previewRequiresConfirmation = Boolean(previewData?.requires_confirmation)
  const canStartImport = Boolean(previewData) && (!previewRequiresConfirmation || importConfirmationChecked) && !isImporting
  const snapshotReady = Boolean(snapshotFile || exportResult)

  const transferFlowSteps = [
    {
      label: "Prepare snapshot",
      state: snapshotReady ? "done" : "current",
    },
    {
      label: "Preview import plan",
      state: previewData ? "done" : snapshotReady ? "current" : "pending",
    },
    {
      label: "Apply transfer",
      state: importResult ? "done" : previewData ? "current" : "pending",
    },
  ] as const

  const handleUseExportForImport = () => {
    if (!exportResult?.snapshot) {
      return
    }

    const nextFile = snapshotDocumentToFile(exportResult.snapshot, exportResult.downloaded_file_name)
    setSnapshotFile(nextFile)
    resetImportWorkflow()
  }

  const exportCard = (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-panel">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Step 1</p>
        <h3 className="text-2xl font-semibold">Prepare snapshot file</h3>
        <p className="text-sm text-muted-foreground">
          Export a fresh snapshot from the source account. If you already have a snapshot JSON, you can skip straight
          to the import station.
        </p>
      </div>
      <div className="mt-6 space-y-5">
        {!isAuthenticated ? (
          <AuthRequiredNotice message="Connect Spotify first to export a snapshot from the current account." />
        ) : null}

        <form className="space-y-4" onSubmit={handleExportSnapshot}>
          <div className="space-y-2">
            <Label htmlFor="cutoffDate">Cutoff date</Label>
            <Input
              id="cutoffDate"
              type="datetime-local"
              value={exportForm.cutoffDate}
              onChange={(event) => setExportForm((current) => ({ ...current, cutoffDate: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputFileName">Download file name</Label>
            <Input
              id="outputFileName"
              placeholder="spotify-snapshot-2026-03-25.json"
              value={exportForm.outputFileName}
              onChange={(event) => setExportForm((current) => ({ ...current, outputFileName: event.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {exportToggleFields.map(({ label, key }) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm"
              >
                <Checkbox
                  checked={exportForm[key]}
                  onChange={(event) =>
                    setExportForm((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <Button className="w-full sm:w-auto" disabled={!isAuthenticated || isExporting || startExportJobMutation.isPending} type="submit">
            {isExporting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Start export
          </Button>
        </form>

        <JobStatusCard
          job={activeExportJob}
          title="Snapshot export job"
          idleMessage="Start an export to package playlists, liked songs, albums, and followed artists into a downloadable snapshot."
        />

        {startExportJobMutation.isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(startExportJobMutation.error)}
          </p>
        ) : null}

        {exportJobQuery.isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(exportJobQuery.error)}
          </p>
        ) : null}

        {exportResult ? (
          <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/8 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-primary/12 p-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Snapshot downloaded</p>
                <p className="mt-1 text-sm text-muted-foreground">{exportResult.downloaded_file_name}</p>
              </div>
            </div>

            <SummaryGrid items={exportSummaryItems} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Source account</p>
                <p className="mt-1 text-muted-foreground">{exportResult.source_user_id || "Unknown"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Exported at</p>
                <p className="mt-1 text-muted-foreground">{formatDateTime(exportResult.exported_at)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm sm:col-span-2">
                <p className="font-medium text-foreground">Cutoff date</p>
                <p className="mt-1 text-muted-foreground">{formatDateTime(exportResult.cutoff_date)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleUseExportForImport} variant="secondary">
                <ArrowRight className="h-4 w-4" />
                Send to import
              </Button>
              <Button onClick={handleDownloadAgain} variant="outline">
                <Download className="h-4 w-4" />
                Download again
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  const importCard = (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-panel">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Steps 2 and 3</p>
        <h3 className="text-2xl font-semibold">Preview and apply snapshot</h3>
        <p className="text-sm text-muted-foreground">
          Upload the snapshot, review the exact import plan, confirm destructive operations when needed, and then run
          the transfer in the background.
        </p>
      </div>
      <div className="mt-6 space-y-5">
        {!isAuthenticated ? (
          <AuthRequiredNotice message="Connect Spotify first to apply a snapshot into the active account." />
        ) : null}

        <div className="rounded-3xl border border-border bg-muted/45 p-4">
          <p className="text-sm font-medium text-foreground">Selected file</p>
          <p className="mt-2 text-lg font-semibold">{snapshotFile ? snapshotFile.name : "No snapshot selected yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshotFile
              ? `${formatFileSize(snapshotFile.size)} - ready for preview`
              : "Choose a JSON snapshot file exported from Spotify Time Machine or send one over from step 1."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleImportSnapshot}>
          <div className="space-y-2">
            <Label htmlFor="snapshotFile">Snapshot file</Label>
            <Input id="snapshotFile" accept=".json,application/json" onChange={handleSnapshotFileChange} type="file" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {importToggleFields.map(({ label, key }) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm"
              >
                <Checkbox
                  checked={importForm[key]}
                  onChange={(event) => {
                    setImportForm((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                    resetImportWorkflow()
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="w-full sm:w-auto"
              disabled={!isAuthenticated || !snapshotFile || previewSnapshotMutation.isPending || isImporting}
              onClick={() => void handlePreviewImport()}
              type="button"
              variant="secondary"
            >
              {previewSnapshotMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              Preview import plan
            </Button>

            <Button
              className="w-full sm:w-auto"
              disabled={!canStartImport || !snapshotFile || startImportJobMutation.isPending}
              type="submit"
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              Import snapshot
            </Button>
          </div>
        </form>

        <JobStatusCard
          job={activeImportJob}
          title="Snapshot import job"
          idleMessage="Preview the import plan first, then start the background import when you are ready."
        />

        {previewSnapshotMutation.isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(previewSnapshotMutation.error)}
          </p>
        ) : null}

        {startImportJobMutation.isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(startImportJobMutation.error)}
          </p>
        ) : null}

        {importJobQuery.isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(importJobQuery.error)}
          </p>
        ) : null}

        {previewData ? (
          <div className="space-y-4 rounded-3xl border border-border bg-white/80 p-4">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Preview ready</p>
              <p className="text-sm text-muted-foreground">
                Review the target account, the planned additions, and any destructive steps before you start the import.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Source account</p>
                <p className="mt-1 text-muted-foreground">{previewData.source_user_id || "Unknown"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Target account</p>
                <p className="mt-1 text-muted-foreground">{previewData.target_user_id || "Unknown"}</p>
              </div>
            </div>

            <SummaryGrid
              items={exportCountLabels.map(({ key, label }) => ({
                label: `Snapshot ${label.toLowerCase()}`,
                value: previewData.snapshot_counts[key] ?? 0,
              }))}
            />

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Planned additions</div>
              <SummaryGrid items={previewPrimarySummaryItems} />
            </div>

            {previewRemovalItems.length ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground">Pre-import cleanup</div>
                <SummaryGrid items={previewRemovalItems} />
              </div>
            ) : null}

            <DestructiveOperationList operations={previewData.destructive_operations} />
            <WarningList warnings={previewData.warnings} />

            {previewRequiresConfirmation ? (
              <label className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-foreground">
                <Checkbox
                  checked={importConfirmationChecked}
                  onChange={(event) => setImportConfirmationChecked(event.target.checked)}
                />
                <span>I understand the selected content in the connected account will be removed before the snapshot is applied.</span>
              </label>
            ) : null}
          </div>
        ) : null}

        {importResult ? (
          <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/8 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-primary/12 p-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Snapshot import completed</p>
                <p className="mt-1 text-sm text-muted-foreground">{importResult.imported_file_name}</p>
              </div>
            </div>

            <SummaryGrid
              items={primaryImportSummaryLabels.map(({ key, label }) => ({
                label: label.replace(" to ", " "),
                value: importResult.result.summary[key] ?? 0,
              }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Source account</p>
                <p className="mt-1 text-muted-foreground">{importResult.result.source_user_id || "Unknown"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Target account</p>
                <p className="mt-1 text-muted-foreground">{importResult.result.target_user_id || "Unknown"}</p>
              </div>
            </div>

            {importRemovalItems.length ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground">Pre-import cleanup</div>
                <SummaryGrid items={importRemovalItems} />
              </div>
            ) : null}

            {importFailureItems.length ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground">Items that could not be applied</div>
                <SummaryGrid items={importFailureItems} />
              </div>
            ) : null}

            <WarningList warnings={importResult.result.warnings} />
            <PlaylistList playlists={importResult.result.created_playlists} />
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <section id="transfer-tools" className="section-shell animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span className="hero-badge">One connected workflow</span>
        <Badge variant={importResult ? "default" : snapshotReady ? "secondary" : "outline"}>
          {importResult ? "Transfer applied" : snapshotReady ? "Snapshot ready" : "Prepare a snapshot"}
        </Badge>
      </div>

      <div className="mt-6 space-y-4">
        <h2 className="max-w-3xl text-3xl leading-tight md:text-4xl">Prepare the snapshot, review the plan, then apply the transfer.</h2>
        <p className="max-w-3xl text-base text-muted-foreground md:text-lg">
          Use a fresh export from the source account or bring a snapshot you already downloaded. Then preview the exact
          changes before the import starts touching the target account.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-3 overflow-x-auto pb-2">
        {transferFlowSteps.map((step, index) => (
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
            {index < transferFlowSteps.length - 1 ? <div className="h-px w-10 shrink-0 bg-gradient-to-r from-primary/35 to-white/10" /> : null}
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

        {exportCard}
        {importCard}
      </div>
    </section>
  )
}
