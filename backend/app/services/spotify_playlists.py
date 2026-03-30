from __future__ import annotations

from typing import Any

import spotipy


def create_current_user_playlist(
    sp: spotipy.Spotify,
    name: str,
    public: bool = True,
    collaborative: bool = False,
    description: str = "",
) -> dict[str, Any]:
    # Spotipy 2.23 still posts to deprecated playlist routes for creation.
    payload = {
        "name": name,
        "public": public,
        "collaborative": collaborative,
        "description": description,
    }
    return sp._post("me/playlists", payload=payload)


def add_items_to_playlist(
    sp: spotipy.Spotify,
    playlist_id: str,
    items: list[str],
    position: int | None = None,
) -> dict[str, Any] | None:
    if not items:
        return None

    # Spotipy 2.23 still adds items through the deprecated `/tracks` route.
    spotify_playlist_id = sp._get_id("playlist", playlist_id)
    uris = [sp._get_uri("track", item) for item in items]
    payload: dict[str, Any] = {"uris": uris}
    if position is not None:
        payload["position"] = position

    return sp._post(f"playlists/{spotify_playlist_id}/items", payload=payload)
