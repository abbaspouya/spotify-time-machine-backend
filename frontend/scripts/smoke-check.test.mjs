import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"


const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8")
}

async function main() {
  const routerSource = await read("src/app/router.tsx")

  assert.match(routerSource, /path:\s*"connect"/)
  assert.match(routerSource, /path:\s*"time-machine"/)
  assert.match(routerSource, /path:\s*"transfer-library"/)
  assert.match(routerSource, /path:\s*"advanced"/)
  assert.match(routerSource, /path:\s*"auth\/callback"/)

  const navigationSource = await read("src/routes/root/navigation.ts")

  assert.match(navigationSource, /Dashboard/)
  assert.match(navigationSource, /Time Machine/)
  assert.match(navigationSource, /Transfer Library/)
  assert.match(navigationSource, /Advanced/)
  assert.doesNotMatch(navigationSource, /Overview/)

  const apiSource = await read("src/lib/api.ts")

  assert.match(apiSource, /credentials:\s*"include"/)
  assert.match(apiSource, /\/jobs\/fetch_and_group/)
  assert.match(apiSource, /\/jobs\/group_by_language/)
  assert.match(apiSource, /\/jobs\/export_account_snapshot/)
  assert.match(apiSource, /\/jobs\/import_account_snapshot/)
  assert.match(apiSource, /\/preview_account_snapshot_import/)
  assert.match(apiSource, /\/playlists\/append/)

  const transferToolSource = await read("src/features/transfer-library/transfer-library-tool.tsx")

  assert.match(transferToolSource, /Preview import plan/)
  assert.match(transferToolSource, /Destructive changes/)
  assert.match(transferToolSource, /Snapshot import job/)

  const transferRouteSource = await read("src/routes/transfer-library/route.tsx")

  assert.match(transferRouteSource, /PlaylistDropInTool/)

  const playlistDropInSource = await read("src/features/transfer-library/playlist-drop-in-tool.tsx")

  assert.match(playlistDropInSource, /One playlist at a time/)
  assert.match(playlistDropInSource, /Add playlist into target/)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
