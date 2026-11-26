# Archived Hyprland XWayland backend

This directory is a frozen copy of the pre-layer-shell Hyprland integration.
It drove a floating XWayland overlay through `hyprctl eval`, a Hyprland event
socket, and `grim` capture.

Hyprland now uses the shared native-Wayland layer-shell backend like Niri, Sway
and Umbriel. The active adapter lives one level up:

- `../geometry.ts` — `hyprctl -j clients/activewindow/monitors` geometry
- `../game-mode.ts` — XWayland vs native Wayland probe for the settings warning

Nothing in this directory is imported, built, tested or linted.
