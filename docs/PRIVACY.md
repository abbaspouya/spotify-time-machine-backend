# Privacy And Data Handling

## What The App Stores

During normal operation the app may handle:

- Spotify account identifiers
- playlist names and descriptions
- track, album, playlist, and artist Spotify URIs
- library timestamps such as `added_at`
- OAuth token data stored in backend session files

## What Snapshot Files Contain

Snapshot exports are JSON documents that may include:

- playlists and playlist track URIs
- liked track URIs
- saved album URIs
- followed artist IDs or URIs
- export timestamps and source account identifiers

Snapshot files do not contain Spotify passwords.

## Operational Notes

- Browser-session token data is stored on the backend under `backend/.sessions/`.
- Exported snapshot files may be saved under `backend/exports/` when file output is enabled.
- Request logs include request metadata and request IDs for debugging.

## Recommended User-Facing Practices

- Tell users that snapshot files can describe meaningful parts of their listening library and should be treated as personal data.
- Do not keep exported snapshots or session files longer than needed.
- Restrict access to backend storage and logs in any shared or hosted environment.
- Use HTTPS in production so Spotify session cookies are protected in transit.
