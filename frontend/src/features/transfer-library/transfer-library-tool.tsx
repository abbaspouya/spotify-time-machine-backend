import { useState } from "react"
import type { FormEvent } from "react"
import { LoaderCircle, Upload } from "lucide-react"
import { useMutation } from "@tanstack/react-query"

import { exportSnapshot, importSnapshot } from "@/lib/api"
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
  { label: "Write to file", key: "writeToFile" },
  { label: "Return snapshot payload", key: "returnSnapshot" },
] as const

const importToggleFields = [
  { label: "Import playlists", key: "importPlaylists" },
  { label: "Import liked tracks", key: "importLikedTracks" },
  { label: "Import saved albums", key: "importSavedAlbums" },
  { label: "Import followed artists", key: "importFollowedArtists" },
  { label: "Clear existing first", key: "clearExistingBeforeImport" },
  { label: "Strict liked order", key: "strictLikedOrder" },
] as const

export function TransferLibraryTool() {
  const { isAuthenticated } = useSpotifySession()

  const [exportForm, setExportForm] = useState({
    cutoffDate: "",
    includePlaylists: true,
    includeLikedTracks: true,
    includeSavedAlbums: true,
    includeFollowedArtists: true,
    writeToFile: true,
    outputFileName: "",
    returnSnapshot: false,
  })

  const [importForm, setImportForm] = useState({
    filePath: "",
    importPlaylists: true,
    importLikedTracks: true,
    importSavedAlbums: true,
    importFollowedArtists: true,
    clearExistingBeforeImport: false,
    strictLikedOrder: false,
  })

  const exportSnapshotMutation = useMutation({
    mutationFn: () =>
      exportSnapshot({
        cutoff_date: exportForm.cutoffDate ? new Date(exportForm.cutoffDate).toISOString() : undefined,
        include_playlists: exportForm.includePlaylists,
        include_liked_tracks: exportForm.includeLikedTracks,
        include_saved_albums: exportForm.includeSavedAlbums,
        include_followed_artists: exportForm.includeFollowedArtists,
        write_to_file: exportForm.writeToFile,
        output_file_name: exportForm.outputFileName || undefined,
        return_snapshot: exportForm.returnSnapshot,
      }),
  })

  const importSnapshotMutation = useMutation({
    mutationFn: () =>
      importSnapshot({
        file_path: importForm.filePath,
        import_playlists: importForm.importPlaylists,
        import_liked_tracks: importForm.importLikedTracks,
        import_saved_albums: importForm.importSavedAlbums,
        import_followed_artists: importForm.importFollowedArtists,
        clear_existing_before_import: importForm.clearExistingBeforeImport,
        strict_liked_order: importForm.strictLikedOrder,
      }),
  })

  const handleExportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void exportSnapshotMutation.mutateAsync()
  }

  const handleImportSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void importSnapshotMutation.mutateAsync()
  }

  return (
    <section id="transfer-tools" className="grid gap-6 xl:grid-cols-2">
      <Card className="animate-fade-up [animation-delay:180ms]">
        <CardHeader>
          <CardTitle>Export account snapshot</CardTitle>
          <CardDescription>
            Capture playlists, liked tracks, saved albums, and followed artists into a reusable export file.
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
              <Label htmlFor="outputFileName">Output file name</Label>
              <Input
                id="outputFileName"
                placeholder="snapshot-2026-03-25.json"
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
                <Upload className="h-4 w-4" />
              )}
              Export snapshot
            </Button>
          </form>

          {exportSnapshotMutation.isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(exportSnapshotMutation.error)}
            </p>
          ) : null}

          {exportSnapshotMutation.data ? (
            <div className="rounded-3xl border border-border bg-muted/45 p-4 text-sm">
              <p className="font-semibold text-foreground">{exportSnapshotMutation.data.message}</p>
              <p className="mt-1 text-muted-foreground">
                File path: {exportSnapshotMutation.data.file_path || "No file written"}
              </p>
              <pre className="mt-4 overflow-auto rounded-2xl bg-foreground/[0.04] p-4 text-xs text-foreground/80">
                {JSON.stringify(exportSnapshotMutation.data.counts, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="animate-fade-up [animation-delay:220ms]">
        <CardHeader>
          <CardTitle>Import account snapshot</CardTitle>
          <CardDescription>
            Point the backend at an existing snapshot file and choose how aggressively it should apply the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isAuthenticated ? (
            <AuthRequiredNotice message="Connect Spotify first to apply a snapshot into the active account." />
          ) : null}

          <form className="space-y-4" onSubmit={handleImportSnapshot}>
            <div className="space-y-2">
              <Label htmlFor="filePath">Snapshot file path</Label>
              <Input
                id="filePath"
                placeholder="backend/exports/my-source-account-snapshot.json"
                value={importForm.filePath}
                onChange={(event) => setImportForm((current) => ({ ...current, filePath: event.target.value }))}
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
              disabled={!isAuthenticated || !importForm.filePath || importSnapshotMutation.isPending}
              type="submit"
              variant="secondary"
            >
              {importSnapshotMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
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
            <div className="rounded-3xl border border-border bg-muted/45 p-4 text-sm">
              <p className="font-semibold text-foreground">{importSnapshotMutation.data.message}</p>
              <pre className="mt-4 overflow-auto rounded-2xl bg-foreground/[0.04] p-4 text-xs text-foreground/80">
                {JSON.stringify(importSnapshotMutation.data.result, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
