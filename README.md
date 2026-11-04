# Illustrator Path Replacer

[![Adobe Illustrator](https://img.shields.io/badge/Adobe%20Illustrator-CS6%20--%202026%2B-orange.svg)](https://www.adobe.com/products/illustrator.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)]()

> **Copy and paste path geometry between shapes in Adobe Illustrator — just like in After Effects.**  
> Transfer Bézier geometry 1-to-1 or batch-replace multiple target shapes across your artboard while preserving 100% of each destination object's appearance, fills, strokes, gradients, opacity, and live effects.

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

### Method 1: Run Directly (No Restart Required)
1. In Adobe Illustrator, open your document.
2. Select your shapes.
3. Go to **File > Scripts > Other Script...** (or press <kbd>Ctrl</kbd> + <kbd>F12</kbd> on Windows / <kbd>Cmd</kbd> + <kbd>F12</kbd> on macOS).
4. Select `Path_Replacement.jsx`.

### Method 2: Install into Illustrator Scripts Menu (Persistent)
Copy `Path_Replacement.jsx` into your Adobe Illustrator Scripts directory:

- **Windows:**  
  `C:\Program Files\Adobe\Adobe Illustrator [Version]\Presets\en_US\Scripts\`
- **macOS:**  
  `/Applications/Adobe Illustrator [Version]/Presets.localized/en_US/Scripts/`

*Restart Illustrator once. The script will now be accessible directly from **File > Scripts > Path_Replacement**.*

---

## Quick Start Guide

### 1-to-1 Replacement (2 Objects)
1. Select two shapes using the **Selection Tool** (`V`) or **Direct Selection Tool** (`A`):
   - **Source:** The shape whose geometry you want to copy.
   - **Destination:** The shape whose geometry you want to replace.
2. Run the script.
3. The dialog shows the Top and Bottom shapes. Click **⇄ Swap Source & Destination** if you want to reverse roles.
4. Select your alignment mode and click **Replace Path** (or press <kbd>Enter</kbd>).

### Batch Replacement (3+ Objects)
1. Select 3 or more shapes across your artboard (e.g., 1 new icon and 10 existing shapes).
2. Run the script.
3. In the **Source Shape** dropdown, pick the shape to use as the template.
4. Click **Replace All N Paths**. All destination shapes will be transformed in place, preserving their individual colors and positions.

---

## Compatibility

- **Adobe Illustrator:** CS6, CC 2014, CC 2015, CC 2017, CC 2018, CC 2019, CC 2020, CC 2021, CC 2022, CC 2023, CC 2024, CC 2025, CC 2026+
- **Operating Systems:** macOS and Windows

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
