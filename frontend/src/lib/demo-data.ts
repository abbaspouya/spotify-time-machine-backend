import type {
  CurrentUserPlaylistsResponse,
  GroupedSongsResponse,
  ImportSnapshotSummary,
  LanguageGroupsResponse,
  PlaylistSummary,
  SnapshotCounts,
  SnapshotDocument,
  SpotifyAccountIdentity,
  TopTrack,
  TopTracksTimeframe,
  WhoAmI,
} from "@/lib/types"

export const DEMO_SPOTIFY_SCOPE =
  "playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-read-private user-read-email user-library-read user-library-modify user-follow-read user-follow-modify user-top-read user-read-recently-played"

export const demoSourceAccount: WhoAmI = {
  id: "demo-source",
  display_name: "Demo Source Account",
  image_url: null,
  profile_url: "https://open.spotify.com/",
  country: "DEMO",
  product: "premium",
  email: "source.demo@example.com",
}

export const demoTargetAccount: WhoAmI = {
  id: "demo-target",
  display_name: "Demo Target Account",
  image_url: null,
  profile_url: "https://open.spotify.com/",
  country: "DEMO",
  product: "premium",
  email: "target.demo@example.com",
}

function albumArt(primary: string, secondary: string, label: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="32" fill="url(#g)" />
      <circle cx="238" cy="86" r="76" fill="rgba(255,255,255,0.14)" />
      <circle cx="88" cy="244" r="112" fill="rgba(0,0,0,0.22)" />
      <text x="32" y="178" fill="white" font-family="Arial, sans-serif" font-size="58" font-weight="700">${label}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function demoTrack(
  rank: number,
  name: string,
  artists: string[],
  album: string,
  colors: [string, string],
): TopTrack {
  return {
    rank,
    id: `demo-track-${rank}`,
    uri: `spotify:track:demo-track-${rank}`,
    name,
    artist_names: artists,
    album_name: album,
    album_image_url: albumArt(colors[0], colors[1], String(rank).padStart(2, "0")),
    spotify_url: "https://open.spotify.com/",
    duration_ms: 210000 + rank * 3200,
    play_count: null,
    last_played_at: null,
  }
}

export const demoTopTracks: TopTrack[] = [
  demoTrack(1, "Midnight Library", ["Northline"], "Archive Glow", ["#1db954", "#172554"]),
  demoTrack(2, "Green Room Echo", ["Mira Vale"], "Rooms After Dark", ["#0f766e", "#111827"]),
  demoTrack(3, "Late Train Home", ["Paper Coast"], "Night Routes", ["#2563eb", "#0f172a"]),
  demoTrack(4, "Another Spring", ["Luca Rey"], "April Notes", ["#16a34a", "#365314"]),
  demoTrack(5, "Velvet Static", ["Soft Circuit"], "Analog Heart", ["#7c3aed", "#111827"]),
  demoTrack(6, "Window Seat", ["Elena North"], "Slow Departures", ["#0284c7", "#082f49"]),
  demoTrack(7, "Small Hours", ["The Bright Few"], "Quiet Maps", ["#ca8a04", "#1f2937"]),
  demoTrack(8, "Foreign Weather", ["Nima"], "Blue Signs", ["#0891b2", "#164e63"]),
  demoTrack(9, "Sunday Code", ["Marble Days"], "Side Project", ["#22c55e", "#064e3b"]),
  demoTrack(10, "Half-Year Memory", ["Civic Bloom"], "Time Slices", ["#14b8a6", "#0f172a"]),
  demoTrack(11, "Liked It Then", ["Archive Club"], "Saved Songs", ["#84cc16", "#1f2937"]),
  demoTrack(12, "Send It Forward", ["Target Account"], "Transfer Plan", ["#1db954", "#0f172a"]),
]

export const demoTimeframes: Record<string, TopTracksTimeframe> = {
  "1_week": {
    key: "1_week",
    label: "1 Week",
    mode: "recent_window",
    days: 7,
    description: "Demo tracks from the last week.",
  },
  "4_weeks": {
    key: "4_weeks",
    label: "4 Weeks",
    mode: "recent_window",
    days: 28,
    description: "Demo tracks from the last four weeks.",
  },
  "6_months": {
    key: "6_months",
    label: "6 Months",
    mode: "spotify_top_items",
    spotify_time_range: "medium_term",
    description: "Demo tracks for a medium-term Spotify window.",
  },
  lifetime: {
    key: "lifetime",
    label: "Lifetime",
    mode: "spotify_top_items",
    spotify_time_range: "long_term",
    description: "Demo tracks for a long-term Spotify window.",
  },
}

export const demoGroupedSongs: GroupedSongsResponse = {
  total_songs: 184,
  groups: {
    "Jan 2020": ["demo-track-1", "demo-track-2", "demo-track-3", "demo-track-4", "demo-track-5"],
    "Feb 2020": ["demo-track-6", "demo-track-7", "demo-track-8"],
    "Mar 2020": ["demo-track-9", "demo-track-10", "demo-track-11", "demo-track-12", "demo-track-13", "demo-track-14"],
    "Apr 2020": ["demo-track-15", "demo-track-16", "demo-track-17", "demo-track-18"],
  },
}

export const demoLanguageGroups: LanguageGroupsResponse = {
  groups: {
    en: ["demo-track-1", "demo-track-2", "demo-track-3", "demo-track-4", "demo-track-5", "demo-track-6", "demo-track-7"],
    it: ["demo-track-8", "demo-track-9", "demo-track-10", "demo-track-11", "demo-track-12"],
    es: ["demo-track-13", "demo-track-14", "demo-track-15"],
    fa: ["demo-track-16", "demo-track-17"],
  },
}

export const demoPlaylists: PlaylistSummary[] = [
  {
    id: "demo-playlist-road",
    name: "Road Trip Draft",
    description: "A demo playlist for one-playlist moves.",
    public: false,
    collaborative: false,
    owner: { id: demoTargetAccount.id, display_name: demoTargetAccount.display_name },
    image_url: albumArt("#1db954", "#0f172a", "RT"),
    spotify_url: "https://open.spotify.com/",
    track_count: 42,
  },
  {
    id: "demo-playlist-focus",
    name: "Focus Archive",
    description: "A target playlist used by demo mode.",
    public: false,
    collaborative: false,
    owner: { id: demoTargetAccount.id, display_name: demoTargetAccount.display_name },
    image_url: albumArt("#0ea5e9", "#111827", "FA"),
    spotify_url: "https://open.spotify.com/",
    track_count: 28,
  },
  {
    id: "demo-playlist-language",
    name: "Language Finds",
    description: "Beta language playlist output example.",
    public: false,
    collaborative: false,
    owner: { id: demoTargetAccount.id, display_name: demoTargetAccount.display_name },
    image_url: albumArt("#10b981", "#312e81", "LG"),
    spotify_url: "https://open.spotify.com/",
    track_count: 17,
  },
]

export const demoPlaylistsResponse: CurrentUserPlaylistsResponse = {
  playlists: demoPlaylists,
  total_playlists: demoPlaylists.length,
}

export const demoSnapshotCounts: SnapshotCounts = {
  playlists: 8,
  playlist_tracks: 214,
  liked_tracks: 184,
  saved_albums: 37,
  followed_artists: 22,
}

export const emptyImportSummary: ImportSnapshotSummary = {
  playlists_created: 0,
  playlist_tracks_added: 0,
  playlist_tracks_failed: 0,
  playlists_removed: 0,
  liked_tracks_added: 0,
  liked_tracks_failed: 0,
  liked_tracks_removed: 0,
  saved_albums_added: 0,
  saved_albums_failed: 0,
  saved_albums_removed: 0,
  followed_artists_added: 0,
  followed_artists_failed: 0,
  followed_artists_removed: 0,
}

export function buildDemoImportSummary({
  importPlaylists = true,
  importLikedTracks = true,
  importSavedAlbums = true,
  importFollowedArtists = true,
  clearExistingBeforeImport = false,
}: {
  importPlaylists?: boolean
  importLikedTracks?: boolean
  importSavedAlbums?: boolean
  importFollowedArtists?: boolean
  clearExistingBeforeImport?: boolean
} = {}): ImportSnapshotSummary {
  return {
    ...emptyImportSummary,
    playlists_created: importPlaylists ? 6 : 0,
    playlist_tracks_added: importPlaylists ? 146 : 0,
    liked_tracks_added: importLikedTracks ? 82 : 0,
    saved_albums_added: importSavedAlbums ? 17 : 0,
    followed_artists_added: importFollowedArtists ? 9 : 0,
    playlists_removed: clearExistingBeforeImport && importPlaylists ? 2 : 0,
    liked_tracks_removed: clearExistingBeforeImport && importLikedTracks ? 28 : 0,
    saved_albums_removed: clearExistingBeforeImport && importSavedAlbums ? 4 : 0,
    followed_artists_removed: clearExistingBeforeImport && importFollowedArtists ? 3 : 0,
  }
}

export function buildDemoSnapshot(): SnapshotDocument {
  const exportedAt = new Date().toISOString()

  return {
    exported_at: exportedAt,
    cutoff_date: null,
    source_user_id: demoSourceAccount.id,
    source_account: accountIdentity(demoSourceAccount),
    counts: demoSnapshotCounts,
    warnings: [
      "Demo snapshot: no real Spotify library data is included.",
      "Follow dates are not available from Spotify, so followed artists cannot be filtered by date.",
    ],
    playlists: demoPlaylists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      track_count: playlist.track_count,
    })),
  }
}

export function accountIdentity(account: WhoAmI): SpotifyAccountIdentity {
  return {
    id: account.id,
    display_name: account.display_name,
    image_url: account.image_url,
    profile_url: account.profile_url,
    country: account.country,
    product: account.product,
  }
}
