import { useMemo, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { AlertTriangle, CheckCircle2, Download, FileUp, LoaderCircle } from "lucide-react"
import { useMutation } from "@tanstack/react-query"

import { exportSnapshot, importSnapshot } from "@/lib/api"
import type {
  ExportSnapshotResponse,
  ImportedPlaylistSummary,
  ImportSnapshotResponse,
  ImportSnapshotSummary,
  SnapshotCounts,
  SnapshotDocument,
} from "@/lib/types"
import { AuthRequiredNotice } from "@/features/spotify/auth-required-notice"
import { getErrorMessage, useSpotifySession } from "@/features/spotify/use-spotify-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  { key: "playlists_created", label: "Playlists created" },
  { key: "playlist_tracks_added", label: "Playlist tracks added" },
  { key: "liked_tracks_added", label: "Liked songs added" },
  { key: "saved_albums_added", label: "Albums saved" },
  { key: "followed_artists_added", label: "Artists followed" },
]

const removalSummaryLabels: Array<{ key: keyof ImportSnapshotSummary; label: string }> = [
  { key: "playlists_removed", label: "Playlists removed first" },
  { key: "liked_tracks_removed", label: "Liked songs removed first" },
  { key: "saved_albums_removed", label: "Saved albums removed first" },
  { key: "followed_artists_removed", label: "Artists unfollowed first" },
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
  const exportedAt = response.exported_at ? response.exported_at.replace(/[:.]/g, "-") : new Date().toISOString().replace(/[:.]/g, "-")
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

function SummaryGrid({
  items,
}: {
  items: Array<{ label: string; value: number }>
}) {
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
    <div className="rounded-3xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm text-amber-900">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Review these warnings
      </div>
      <div className="grid gap-2">
        {warnings.map((warning) => (
          <div key={warning} className="rounded-2xl border border-amber-200 bg-white/70 px-3 py-2">
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

  const [snapshotFile, setSnapshotFile] = useState<File | null>(null)
  const [importForm, setImportForm] = useState({
    importPlaylists: true,
    importLikedTracks: true,
    importSavedAlbums: true,
    importFollowedArtists: true,
    clearExistingBeforeImport: false,
    strictLikedOrder: false,
  })

  const exportSnapshotMutation = useMutation<DownloadedSnapshotResponse, Error>({
    mutationFn: async () => {
      const response = await exportSnapshot({
        cutoff_date: exportForm.cutoffDate ? new Date(exportForm.cutoffDate).toISOString() : undefined,
        include_playlists: exportForm.includePlaylists,
        include_liked_tracks: exportForm.includeLikedTracks,
        include_saved_albums: exportForm.includeSavedAlbums,
        include_followed_artists: exportForm.includeFollowedArtists,
        write_to_file: false,
        output_file_name: exportForm.outputFileName || undefined,
        return_snapshot: true,
      })

      if (!response.snapshot) {
        throw new Error("The export completed, but no snapshot file was returned for download.")
      }

      const downloadedFileName = buildSnapshotFileName(response, exportForm.outputFileName)
      downloadSnapshotFile(response.snapshot, downloadedFileName)

      return {
        ...response,
        snapshot: response.snapshot,
        downloaded_file_name: downloadedFileName,
      }
    },
  })

  const importSnapshotMutation = useMutation<UploadedImportResponse, Error>({
    mutationFn: async () => {
      if (!snapshotFile) {
        throw new Error("Choose a snapshot file before starting the import.")
      }

      const snapshotDocument = await readSnapshotDocument(snapshotFile)
      const response = await importSnapshot({
        snapshot: snapshotDocument,
        import_playlists: importForm.importPlaylists,
        import_liked_tracks: importForm.importLikedTracks,
        import_saved_albums: importForm.importSavedAlbums,
        import_followed_artists: importForm.importFollowedArtists,
        clear_existing_before_import: importForm.clearExistingBeforeImport,
        strict_liked_order: importForm.strictLikedOrder,
      })

      return {
        ...response,
        imported_file_name: snapshotFile.name,
      }
    },
  })

  const exportSummaryItems = useMemo(() => {
    const counts = exportSnapshotMutation.data?.counts
    if (!counts) {
      return []
    }

    return exportCountLabels.map(({ key, label }) => ({
      label,
      value: counts[key] ?? 0,
    }))
  }, [exportSnapshotMutation.data])

  const importPrimarySummaryItems = useMemo(() => {
    const summary = importSnapshotMutation.data?.result.summary
    if (!summary) {
      return []
    }

    return primaryImportSummaryLabels.map(({ key, label }) => ({
      label,
      value: summary[key] ?? 0,
    }))
  }, [importSnapshotMutation.data])

  const importRemovalItems = useMemo(() => {
    const summary = importSnapshotMutation.data?.result.summary
    if (!summary) {
      return []
    }

    return removalSummaryLabels
      .map(({ key, label }) => ({
        label,
        value: summary[key] ?? 0,
      }))
      .filter((item) => item.value > 0)
  }, [importSnapshotMutation.data])

  const importFailureItems = useMemo(() => {
    const summary = importSnapshotMutation.data?.result.summary
    if (!summary) {
      return []
    }

    return failureSummaryLabels
      .map(({ key, label }) => ({
        label,
        value: summary[key] ?? 0,
      }))
      .filter((item) => item.value > 0)
  }, [importSnapshotMutation.data])

  const handleExportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void exportSnapshotMutation.mutateAsync()
  }

  const handleImportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void importSnapshotMutation.mutateAsync()
  }

  const handleSnapshotFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null
    setSnapshotFile(nextFile)
    importSnapshotMutation.reset()
  }

  const handleDownloadAgain = () => {
    if (!exportSnapshotMutation.data?.snapshot) {
      return
    }

    downloadSnapshotFile(exportSnapshotMutation.data.snapshot, exportSnapshotMutation.data.downloaded_file_name)
  }

  return (
    <section id="transfer-tools" className="grid gap-6 xl:grid-cols-2">
      <Card className="animate-fade-up [animation-delay:180ms]">
        <CardHeader>
          <CardTitle>Download a snapshot file</CardTitle>
          <CardDescription>
            Choose what to include, then download a portable JSON snapshot directly in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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

            <Button className="w-full sm:w-auto" disabled={!isAuthenticated || exportSnapshotMutation.isPending} type="submit">
              {exportSnapshotMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download snapshot
            </Button>
          </form>

          {exportSnapshotMutation.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(exportSnapshotMutation.error)}
            </p>
          ) : null}

          {exportSnapshotMutation.data ? (
            <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/8 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-primary/12 p-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">Snapshot downloaded</p>
                  <p className="mt-1 text-sm text-muted-foreground">{exportSnapshotMutation.data.downloaded_file_name}</p>
                </div>
              </div>

              <SummaryGrid items={exportSummaryItems} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Source account</p>
                  <p className="mt-1 text-muted-foreground">{exportSnapshotMutation.data.source_user_id || "Unknown"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Exported at</p>
                  <p className="mt-1 text-muted-foreground">{formatDateTime(exportSnapshotMutation.data.exported_at)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm sm:col-span-2">
                  <p className="font-medium text-foreground">Cutoff date</p>
                  <p className="mt-1 text-muted-foreground">{formatDateTime(exportSnapshotMutation.data.cutoff_date)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDownloadAgain} variant="secondary">
                  <Download className="h-4 w-4" />
                  Download again
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="animate-fade-up [animation-delay:220ms]">
        <CardHeader>
          <CardTitle>Upload a snapshot file</CardTitle>
          <CardDescription>
            Select a previously downloaded snapshot file, choose what to apply, and import it into the connected account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isAuthenticated ? (
            <AuthRequiredNotice message="Connect Spotify first to apply a snapshot into the active account." />
          ) : null}

          <div className="rounded-3xl border border-border bg-muted/45 p-4">
            <p className="text-sm font-medium text-foreground">Selected file</p>
            <p className="mt-2 text-lg font-semibold">{snapshotFile ? snapshotFile.name : "No snapshot selected yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshotFile
                ? `${formatFileSize(snapshotFile.size)} - ready to import`
                : "Choose a JSON snapshot file exported from Spotify Time Machine."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleImportSnapshot}>
            <div className="space-y-2">
              <Label htmlFor="snapshotFile">Snapshot file</Label>
              <Input
                id="snapshotFile"
                accept=".json,application/json"
                onChange={handleSnapshotFileChange}
                type="file"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {importToggleFields.map(({ label, key }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm"
                >
                  <Checkbox
                    checked={importForm[key]}
                    onChange={(event) =>
                      setImportForm((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <Button
              className="w-full sm:w-auto"
              disabled={!isAuthenticated || !snapshotFile || importSnapshotMutation.isPending}
              type="submit"
              variant="secondary"
            >
              {importSnapshotMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              Import snapshot
            </Button>
          </form>

          {importSnapshotMutation.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(importSnapshotMutation.error)}
            </p>
          ) : null}

          {importSnapshotMutation.data ? (
            <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/8 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-primary/12 p-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">Snapshot import completed</p>
                  <p className="mt-1 text-sm text-muted-foreground">{importSnapshotMutation.data.imported_file_name}</p>
                </div>
              </div>

              <SummaryGrid items={importPrimarySummaryItems} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Source account</p>
                  <p className="mt-1 text-muted-foreground">{importSnapshotMutation.data.result.source_user_id || "Unknown"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Target account</p>
                  <p className="mt-1 text-muted-foreground">{importSnapshotMutation.data.result.target_user_id || "Unknown"}</p>
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

              <WarningList warnings={importSnapshotMutation.data.result.warnings} />
              <PlaylistList playlists={importSnapshotMutation.data.result.created_playlists} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
