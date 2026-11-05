# Illustrator Path Replacer

[![Adobe Illustrator](https://img.shields.io/badge/Adobe%20Illustrator-CS6%20--%202026%2B-orange.svg)](https://www.adobe.com/products/illustrator.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)]()
[![Type](https://img.shields.io/badge/Type-Dockable%20Panel%20%26%20JSX%20Script-brightgreen.svg)]()

> **Copy and paste path geometry between shapes in Adobe Illustrator — just like in After Effects.**  
> Transfer Bézier geometry 1-to-1 or batch-replace multiple target shapes across your artboard while preserving 100% of each destination object's appearance, fills, strokes, gradients, opacity, and live effects.

Available as both a **Native Dockable Panel (CEP)** that snaps into your Illustrator workspace sidebars, and as a **Standalone JSX Script**.

---

## The Problem

In Adobe After Effects, copying a path property from one shape/mask layer and pasting it into another instantly replaces the Bézier path without affecting styling or transform properties.

In Adobe Illustrator, there has never been a native way to replace a shape's path geometry while keeping its appearance intact. Replacing a shape traditionally requires:
- Redrawing or copy-pasting the new path,
- Re-sampling or manually copying multi-fills, multi-strokes, gradients, and graphic styles,
- Re-applying live effects, opacity masks, and blend modes,
- Re-positioning and re-ordering in the layer tree.

**Illustrator Path Replacer** solves this by mutating the destination object's path points directly in the Illustrator DOM, transferring source Bézier geometry while keeping appearance attributes, hierarchy, and clipping masks 100% intact.

---

## Features

- **Dockable Panel UI:** Keep the panel permanently open in your workspace alongside Layers, Properties, and Appearance.
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
- **Flexible Alignment Modes:**
  - **Center on Target (In-Place)** *(Default)*: Centers the new geometry onto each target's center, preserving source scale and proportions.
  - **Keep Source Position (AE-Style Coordinates)**: Applies raw document coordinates directly.
  - **Fit to Target Bounds**: Scales geometry proportionally to fit inside each target's bounding box.
  - **Stretch to Target Bounds**: Scales width and height to match each target's bounding box.
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
3. Select your placement mode (e.g. *In-Place*) and click **Replace Path**.

### Batch Replacement (3+ Objects)
1. Select 3 or more shapes across your artboard (e.g., 1 template icon and 10 existing shapes).
2. The panel automatically switches to **Batch Mode**.
3. Select the template shape from the **Source Template** dropdown.
4. Click **Replace All N Paths**. All destination shapes will be transformed in place, preserving their individual colors, styles, and positions.

---

## Compatibility

- **Adobe Illustrator:** CS6 through CC 2026+
- **Operating Systems:** macOS and Windows

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
