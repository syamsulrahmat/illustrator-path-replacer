# Illustrator Path Replacer

[![Adobe Illustrator](https://img.shields.io/badge/Adobe%20Illustrator-CS6%20--%202026%2B-orange.svg)](https://www.adobe.com/products/illustrator.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)]()
[![Type](https://img.shields.io/badge/Type-Dockable%20Panel%20%26%20JSX%20Script-brightgreen.svg)]()

> **Copy and replace path geometry between shapes in Adobe Illustrator without losing styling.**  
> Transfer Bézier geometry 1-to-1 or batch-replace multiple target shapes across your artwork while preserving 100% of each destination object's appearance, fills, strokes, gradients, opacity, and live effects.

Available as both a **Native Dockable Panel** that snaps into your Illustrator workspace sidebars, and as a **Standalone JSX Script**.

---

## Features

- **Dockable Panel UI:** Keep the panel permanently open in your workspace alongside Layers, Properties, and Appearance.
- **Compact & Responsive:** Clean, space-efficient interface that fits narrow sidebar columns.
- **1-to-1 Mode (2 Objects Selected):** Quick interactive swap between Top and Bottom shapes with an instant `⇄ Swap Roles` button.
- **1-to-Many Batch Mode (3+ Objects Selected):** Pick one Source shape from a dropdown menu and batch-transform dozens of target shapes across your artboard in a single click.
- **100% Appearance Preservation:**
  - Solid fills, strokes, and gradients (retaining angle and radial center)
  - Multi-appearance stacks (multiple fills/strokes from the Appearance panel)
  - Live Effects (Drop Shadow, 3D, Blur, Offset Path, Warp, etc.)
  - Transparency, blend modes, and opacity masks
  - Clipping mask status (`clipping = true`)
  - Layer hierarchy and z-stacking order
- **Full Compound Path Support:**
  - PathItem ⇄ PathItem
  - CompoundPathItem ⇄ CompoundPathItem
  - Automatically wraps a single path into a compound path if the source contains multiple subpaths.
- **Flexible Placement Modes:**
  - **Source Position** *(Default)*: Places the path at the source shape's exact document coordinates.
  - **Center on Target**: Centers the new geometry onto each target's center, preserving source scale and proportions.
  - **Fit to Target**: Scales geometry proportionally to fit inside each target's bounding box.
  - **Stretch to Target**: Scales width and height to match each target's bounding box.
- **Single Undo:** The entire batch operation is grouped into a single Undo entry (`Ctrl+Z` / `Cmd+Z`).

---

## Installation

### Option 1: Dockable Panel Extension (Recommended)

The dockable panel physically docks into your Illustrator interface under **Window > Extensions > Path Replacer**.

#### Windows
1. Copy the folder `com.syamsulrahmat.pathreplacer` into your Adobe CEP extensions folder:
   ```text
   %APPDATA%\Adobe\CEP\extensions\
   ```
   *(e.g., `C:\Users\<YourUser>\AppData\Roaming\Adobe\CEP\extensions\com.syamsulrahmat.pathreplacer`)*
2. Restart Adobe Illustrator.
3. Open the panel from **Window > Extensions > Path Replacer**.
4. Drag and snap the tab into your workspace dock alongside Layers or Properties.

#### macOS
1. Copy the folder `com.syamsulrahmat.pathreplacer` into:
   ```text
   ~/Library/Application Support/Adobe/CEP/extensions/
   ```
2. Restart Adobe Illustrator.
3. Open the panel from **Window > Extensions > Path Replacer**.

---

### Option 2: Standalone JSX Script

If you prefer running via a keyboard shortcut or the `File > Scripts` menu:

1. Copy `Path_Replacement.jsx` into your Illustrator Scripts folder:
   - **Windows:** `C:\Program Files\Adobe\Adobe Illustrator [Version]\Presets\en_US\Scripts\`
   - **macOS:** `/Applications/Adobe Illustrator [Version]/Presets.localized/en_US/Scripts/`
2. Restart Illustrator. The script will be available under **File > Scripts > Path_Replacement**.

---

## Quick Start Guide

### 1-to-1 Replacement (2 Objects)
1. Select two shapes using the **Selection Tool** (`V`) or **Direct Selection Tool** (`A`):
   - **Source:** The shape whose geometry you want to copy.
   - **Destination:** The shape whose geometry you want to replace.
2. In the **Path Replacer** dockable panel (or modal script), click **⇄ Swap Roles** if you want to reverse source/target.
3. Select your placement mode (defaults to **Source Position**) and click **Replace Path**.

### Batch Replacement (3+ Objects)
1. Select 3 or more shapes across your artboard.
2. The panel automatically switches to **Batch Mode**.
3. Select the template shape from the **Source** dropdown.
4. Click **Replace All (N)**. All destination shapes will be transformed, preserving their individual colors, styles, and appearances.

---

## Compatibility

- **Adobe Illustrator:** CS6 through CC 2026+
- **Operating Systems:** macOS and Windows

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
