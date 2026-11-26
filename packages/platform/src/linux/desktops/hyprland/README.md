# Hyprland desktop adapter

Hyprland uses the shared native-Wayland `layer-shell` backend. This directory
only contributes the compositor-specific pieces:

- `geometry.ts` / `ipc.ts` — exact window bounds from
  `hyprctl -j clients`, `activewindow` and `monitors`.
- `game-mode.ts` — the settings PoE XWayland/native-Wayland probe.
- `x11-overlay.ts` — compositor-side decoration for Scalpel's X11/XWayland
  overlay fallback.
- `.inactive-old/` — the archived pre-layer-shell XWayland backend. Nothing in
  it is imported, built, tested or linted.

## X11/XWayland overlay styling

Hyprland applies its configured blur effect behind transparent windows. The
X11 overlay is one full-game-sized transparent XWayland window, so without help
Hyprland blurs PoE while the overlay is open. When that window stayed mapped
after closing, the blur also remained visible.

When an X11 overlay window is shown, `x11-overlay.ts` finds Scalpel's own
XWayland clients with:

```text
hyprctl -j clients
pid == process.pid && xwayland == true
```

and applies these window properties through the compositor:

```text
no_blur     = 1
no_shadow   = 1
no_dim      = 1
decorate    = 0
border_size = 0
rounding    = 0
```

This is intentionally automatic: users should not need to add Hyprland window
rules or edit `hyprland.conf` for Scalpel's overlay to look correct.

Hyprland 0.56+ exposes the Lua property dispatcher, so the helper uses:

```sh
hyprctl eval 'hl.dispatch(hl.dsp.window.set_prop({ ... }))'
```

Older releases fall back to the legacy `hyprctl dispatch setprop` form. The
helper is best-effort: if `hyprctl` is unavailable or the release exposes no
supported property API, the overlay still works and styling is skipped. A
debug breadcrumb (`hyprland x11 overlay styled ...` or
`hyprland x11 overlay styling unavailable`) records which path ran.

The shared app lifecycle also unmaps the X11 overlay when it is closed on
Linux, so a hidden overlay does not remain composited over the game. The
styling above additionally keeps the game sharp while the overlay is open.

## Inspecting the result

While an X11 overlay is visible:

```sh
addr=$(hyprctl -j clients | jq -r '.[] | select(.class=="scalpel") | .address' | head -1)
hyprctl getprop "address:$addr" no_blur
```

The expected result is `true`.
