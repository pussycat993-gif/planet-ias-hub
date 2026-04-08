# IAS Hub — Assets

Place these files in this directory before packaging:

## Required icons

| File | Platform | Size |
|---|---|---|
| `icon.icns` | macOS | 512x512 (bundled as .icns) |
| `icon.ico` | Windows | 256x256 (bundled as .ico) |
| `icon.png` | Linux | 512x512 PNG |

## How to generate icons from the IAS Hub logo

1. Start with a 1024x1024 PNG of the IAS Hub logo (hub icon + IAS Hub text on transparent background)
2. Use electron-icon-maker or any icon generator:

```bash
npx electron-icon-maker --input=icon-source.png --output=./
```

Or use:
- macOS: `iconutil` (built-in)
- Windows: convert with ImageMagick or online tools
- Linux: use the PNG directly

## Logo spec (for designer)

Hub icon: radiating nodes in #90caf9, one green active node (#4caf50), center circle white
Text: "IAS" bold white + "Hub" in rounded pill (rgba(255,255,255,0.22))
Background: #1565c0 (for .ico/.icns) or transparent (for .png on Linux)
