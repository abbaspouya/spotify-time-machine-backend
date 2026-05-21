# Showcase Guide

This folder contains public-facing material for presenting Spotify Time Machine on GitHub, in a portfolio, or during a project walkthrough.

## Screenshot Set

The README uses these screenshots:

- `screenshots/landing.png`
- `screenshots/time-machine.png`
- `screenshots/transfer-library.png`
- `screenshots/language-playlists.png`

The authenticated screenshots were captured from a local development build with the profile control blurred or cropped to keep personal account details out of the public repo.

## Short Talk Track

Spotify Time Machine started as a practical library-management problem: Spotify has great listening data, but moving, reshaping, or revisiting that library can still be manual. The app turns that into three focused workflows:

- Time Machine creates playlists from time periods in a user's liked-song history.
- Transfer Library exports selected account data, previews the import plan, and applies it into another account with clearer control.
- Language Playlists is a beta workflow that uses `langdetect` to group liked songs by likely language and create playlists from the chosen group.

The project is best presented as a usable self-hosted utility and portfolio case study rather than a commercial SaaS product, because Spotify API access, quotas, review, and commercial use are controlled by Spotify's developer platform policies.

## What To Emphasize

- Full-stack ownership: FastAPI backend, React frontend, Spotify OAuth, async jobs, and session-scoped account roles.
- Product thinking: the app explains each workflow before asking the user to run API-heavy actions.
- Safety: transfer preview and destructive-operation confirmation before importing into another account.
- Practical constraints: the GitHub version is intentionally honest about Spotify API limitations and not framed as a public paid product.

## Screenshot Refresh Checklist

1. Start the backend and frontend locally.
2. Connect Spotify only if you need authenticated screenshots.
3. Blur or avoid visible personal profile/account details.
4. Replace files in `docs/showcase/screenshots/`.
5. Confirm README image links still render on GitHub.
