import { PlaylistDropInTool } from "@/features/transfer-library/playlist-drop-in-tool"
import { TransferLibraryTool } from "@/features/transfer-library/transfer-library-tool"

export function TransferLibraryPage() {
  return (
    <div className="container space-y-6 py-8 md:space-y-8 md:py-12">
      <TransferLibraryTool />
      <PlaylistDropInTool />
    </div>
  )
}
