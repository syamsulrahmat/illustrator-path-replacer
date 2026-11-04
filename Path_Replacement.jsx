/**
 * Adobe Illustrator Path Replacement Script (ExtendScript JSX)
 * -------------------------------------------------------------
 * Replaces the path geometry of destination vector shape(s) with the path geometry
 * of a source vector shape, preserving each destination's original appearance,
 * styling (fill, stroke, gradients, opacity, effects), clipping mask status,
 * and hierarchy in the document - similar to After Effects' path copy-paste workflow.
 *
 * Capabilities:
 * - 1-to-1 Mode (2 objects selected): Quick swap between Top and Bottom shapes.
 * - 1-to-Many Batch Mode (3+ objects selected): Choose 1 Source shape, and batch-replace
 *   all other destination shapes across your artboard at their respective positions.
 * - Supported Objects: Regular Paths (PathItem), Compound Paths (CompoundPathItem),
 *   Clipping Paths / Clip Groups, and shapes nested inside groups.
 *
 * Compatibility: Adobe Illustrator CS6 through CC 2026+ (macOS & Windows)
 */

#target illustrator

(function () {
    "use strict";

    // -------------------------------------------------------------------------
    // Helper & Validation Functions
    // -------------------------------------------------------------------------

    /**
     * Resolves a selected object to a workable vector path or compound path.
     * Unwraps clipping groups and single-item groups if necessary.
     */
    function resolveVectorTarget(item) {
        if (!item) return null;

        var type = item.typename;

        if (type === "PathItem" || type === "CompoundPathItem") {
            return item;
        }

        if (type === "GroupItem") {
            // Case 1: Clipping Mask group
            if (item.clipped && item.pageItems.length > 0) {
                var maskCandidate = item.pageItems[0];
                if (maskCandidate.typename === "PathItem" || maskCandidate.typename === "CompoundPathItem") {
                    return maskCandidate;
                }
            }

            // Case 2: Group containing exactly 1 vector child
            if (item.pageItems.length === 1) {
                return resolveVectorTarget(item.pageItems[0]);
            }
        }

        return null;
    }

    /**
     * Formats an object's description for the UI dialog.
     */
    function getItemDescription(item, index) {
        if (!item) return "None";
        var prefix = (index !== undefined) ? "[" + (index + 1) + "] " : "";
        var typeStr = item.typename;
        var info = "";

        if (item.clipping) {
            info = " [Clipping Path]";
        }

        if (item.typename === "PathItem") {
            var ptCount = item.pathPoints ? item.pathPoints.length : 0;
            var closedStr = item.closed ? "Closed" : "Open";
            info += " (" + ptCount + " pts, " + closedStr + ")";
        } else if (item.typename === "CompoundPathItem") {
            var subCount = item.pathItems ? item.pathItems.length : 0;
            info += " (" + subCount + " subpaths)";
        }

        var nameStr = item.name ? " \"" + item.name + "\"" : "";
        var layerStr = (item.layer && item.layer.name) ? " [" + item.layer.name + "]" : "";

        return prefix + typeStr + info + nameStr + layerStr;
    }

    /**
     * Returns bounding box dimensions [left, top, right, bottom, width, height, centerX, centerY]
     */
    function getBoundsData(item) {
        var b = item.geometricBounds; // [left, top, right, bottom]
        var left = b[0];
        var top = b[1];
        var right = b[2];
        var bottom = b[3];
        var width = Math.abs(right - left);
        var height = Math.abs(top - bottom);
        var centerX = (left + right) / 2;
        var centerY = (top + bottom) / 2;

        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: width,
            height: height,
            centerX: centerX,
            centerY: centerY
        };
    }

    /**
     * Extracts Bézier path geometry from a source PathItem or CompoundPathItem.
     */
    function extractGeometry(sourceItem) {
        var subpaths = [];

        function readPathItem(pItem) {
            var pts = [];
            var numPts = pItem.pathPoints.length;
            for (var i = 0; i < numPts; i++) {
                var p = pItem.pathPoints[i];
                pts.push({
                    anchor: [p.anchor[0], p.anchor[1]],
                    leftDirection: [p.leftDirection[0], p.leftDirection[1]],
                    rightDirection: [p.rightDirection[0], p.rightDirection[1]],
                    pointType: p.pointType
                });
            }
            return {
                closed: pItem.closed,
                points: pts
            };
        }

        if (sourceItem.typename === "PathItem") {
            subpaths.push(readPathItem(sourceItem));
        } else if (sourceItem.typename === "CompoundPathItem") {
            var numSub = sourceItem.pathItems.length;
            for (var j = 0; j < numSub; j++) {
                subpaths.push(readPathItem(sourceItem.pathItems[j]));
            }
        }

        return subpaths;
    }

    /**
     * Applies subpath geometry to a target PathItem using a 2D transform function.
     */
    function applySubpath(targetPath, subpathData, transformFn) {
        var srcPts = subpathData.points;
        var targetLen = srcPts.length;
        if (targetLen === 0) return;

        // Temporarily unlock closed state to safely mutate point collection
        targetPath.closed = false;

        var currentLen = targetPath.pathPoints.length;

        // 1. Adjust number of points in destination path
        if (currentLen < targetLen) {
            for (var i = currentLen; i < targetLen; i++) {
                targetPath.pathPoints.add();
            }
        } else if (currentLen > targetLen) {
            for (var j = currentLen - 1; j >= targetLen; j--) {
                targetPath.pathPoints[j].remove();
            }
        }

        // 2. Assign coordinates
        // Setting pointType to CORNER first prevents Illustrator from swinging
        // the opposite handle when assigning leftDirection before rightDirection.
        for (var k = 0; k < targetLen; k++) {
            var tp = targetPath.pathPoints[k];
            var sp = srcPts[k];

            var anc = transformFn(sp.anchor);
            var left = transformFn(sp.leftDirection);
            var right = transformFn(sp.rightDirection);

            tp.pointType = PointType.CORNER;
            tp.anchor = anc;
            tp.leftDirection = left;
            tp.rightDirection = right;
            tp.pointType = sp.pointType;
        }

        // 3. Restore closed status
        targetPath.closed = subpathData.closed;
    }

    /**
     * Transfers extracted geometry to the destination vector object.
     * Returns the final active destination PageItem.
     */
    function transferGeometry(destItem, subpaths, transformFn) {
        if (subpaths.length === 0) return destItem;

        var finalItem = destItem;

        if (destItem.typename === "PathItem") {
            if (subpaths.length === 1) {
                // Direct PathItem to PathItem replacement
                applySubpath(destItem, subpaths[0], transformFn);
            } else {
                // Source is a Compound Path (multiple subpaths), but destination is a single PathItem.
                // Wrap destination into a new CompoundPathItem to preserve all styles, fills, and strokes.
                var parent = destItem.parent;
                var comp = parent.compoundPathItems.add();
                comp.move(destItem, ElementPlacement.PLACEBEFORE);

                var isClipping = destItem.clipping;
                destItem.move(comp, ElementPlacement.INSIDE);

                // Apply first subpath to original destItem (preserves main styling)
                applySubpath(destItem, subpaths[0], transformFn);

                // Create additional subpaths
                for (var s = 1; s < subpaths.length; s++) {
                    var extraPath = comp.pathItems.add();
                    applySubpath(extraPath, subpaths[s], transformFn);
                }

                if (isClipping) {
                    comp.clipping = true;
                }
                finalItem = comp;
            }
        } else if (destItem.typename === "CompoundPathItem") {
            var curSubCount = destItem.pathItems.length;
            var targetSubCount = subpaths.length;

            // Adjust subpath count
            if (curSubCount < targetSubCount) {
                for (var a = curSubCount; a < targetSubCount; a++) {
                    destItem.pathItems.add();
                }
            } else if (curSubCount > targetSubCount) {
                for (var b = curSubCount - 1; b >= targetSubCount; b--) {
                    destItem.pathItems[b].remove();
                }
            }

            // Apply each subpath
            for (var c = 0; c < targetSubCount; c++) {
                applySubpath(destItem.pathItems[c], subpaths[c], transformFn);
            }
        }

        return finalItem;
    }

    /**
     * Builds the coordinate transformation function for a specific destination.
     */
    function createTransformFunction(mode, srcBounds, dstBounds) {
        if (mode === "center") {
            // Center on target in-place (keeps source scale & proportions)
            var dxCenter = dstBounds.centerX - srcBounds.centerX;
            var dyCenter = dstBounds.centerY - srcBounds.centerY;
            return function (pt) {
                return [pt[0] + dxCenter, pt[1] + dyCenter];
            };
        } else if (mode === "absolute") {
            // Keep source position (AE-style document coordinates)
            return function (pt) {
                return [pt[0], pt[1]];
            };
        } else if (mode === "fit") {
            // Scale proportionally to fit inside target bounds & center
            var scaleVal = 1.0;
            if (srcBounds.width > 0.001 && srcBounds.height > 0.001) {
                var scaleX = dstBounds.width / srcBounds.width;
                var scaleY = dstBounds.height / srcBounds.height;
                scaleVal = Math.min(scaleX, scaleY);
            } else if (srcBounds.width > 0.001) {
                scaleVal = dstBounds.width / srcBounds.width;
            } else if (srcBounds.height > 0.001) {
                scaleVal = dstBounds.height / srcBounds.height;
            }
            return function (pt) {
                var relX = pt[0] - srcBounds.centerX;
                var relY = pt[1] - srcBounds.centerY;
                return [
                    dstBounds.centerX + relX * scaleVal,
                    dstBounds.centerY + relY * scaleVal
                ];
            };
        } else if (mode === "stretch") {
            // Scale width and height non-proportionally to match target bounds
            var sx = (srcBounds.width > 0.001) ? (dstBounds.width / srcBounds.width) : 1.0;
            var sy = (srcBounds.height > 0.001) ? (dstBounds.height / srcBounds.height) : 1.0;
            return function (pt) {
                var relX = pt[0] - srcBounds.centerX;
                var relY = pt[1] - srcBounds.centerY;
                return [
                    dstBounds.centerX + relX * sx,
                    dstBounds.centerY + relY * sy
                ];
            };
        }

        return function (pt) { return [pt[0], pt[1]]; };
    }

    // -------------------------------------------------------------------------
    // Main Controller & ScriptUI Interface
    // -------------------------------------------------------------------------

    function main() {
        if (app.documents.length === 0) {
            alert("No document open.\nPlease open an Adobe Illustrator document first.", "Path Replacement");
            return;
        }

        var doc = app.activeDocument;
        var sel = doc.selection;

        if (!sel || sel.length < 2) {
            alert(
                "Please select at least TWO vector objects:\n\n" +
                "• One Source object (whose path geometry will be copied)\n" +
                "• One or more Destination objects (whose path geometry will be replaced)\n\n" +
                "Tip: You can select objects using the Selection Tool (V) or Direct Selection Tool (A).",
                "Path Replacement - Selection Required"
            );
            return;
        }

        // Resolve each selected item to a supported vector target
        var validItems = [];
        var invalidCount = 0;

        for (var i = 0; i < sel.length; i++) {
            var resolved = resolveVectorTarget(sel[i]);
            if (resolved) {
                validItems.push(resolved);
            } else {
                invalidCount++;
            }
        }

        if (validItems.length < 2) {
            alert(
                "Could not find at least two valid vector shapes in your selection.\n" +
                (invalidCount > 0 ? "Skipped " + invalidCount + " unsupported object(s) (e.g. text frames or raster images).\n\n" : "") +
                "Please select PathItem or CompoundPathItem shapes (or outline text first).",
                "Path Replacement - Unsupported Selection"
            );
            return;
        }

        var isPairMode = (validItems.length === 2);
        var sourceIndex = 0; // Default: Topmost item (Item 0) is Source

        // ---------------------------------------------------------------------
        // ScriptUI Dialog Setup
        // ---------------------------------------------------------------------
        var dialogTitle = isPairMode ? "Path Geometry Replacement" : "Batch Path Replacement (" + validItems.length + " Objects)";
        var dialog = new Window("dialog", dialogTitle);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 12;
        dialog.margins = 16;

        // Header Panel: Selection & Source Definition
        var rolePanel = dialog.add("panel", undefined, isPairMode ? "Selection & Direction" : "Source & Target Setup");
        rolePanel.orientation = "column";
        rolePanel.alignChildren = ["fill", "top"];
        rolePanel.spacing = 8;
        rolePanel.margins = 12;

        var sourceDropdown;
        var sourceText, destText, swapBtn;

        if (isPairMode) {
            // 1-to-1 Mode: Simple Top/Bottom with Swap button
            sourceText = rolePanel.add("statictext", undefined, "", { truncate: "middle" });
            destText = rolePanel.add("statictext", undefined, "", { truncate: "middle" });
            swapBtn = rolePanel.add("button", undefined, "⇄  Swap Source & Destination");
            swapBtn.helpTip = "Click to reverse which object is Source and which is Destination";

            function updatePairLabels() {
                var srcObj = validItems[sourceIndex];
                var dstObj = validItems[1 - sourceIndex];
                var srcPos = (sourceIndex === 0) ? "Top" : "Bottom";
                var dstPos = (sourceIndex === 0) ? "Bottom" : "Top";

                sourceText.text = "Source (" + srcPos + "):  " + getItemDescription(srcObj);
                destText.text   = "Target (" + dstPos + "):  " + getItemDescription(dstObj);
            }
            updatePairLabels();

            swapBtn.onClick = function () {
                sourceIndex = 1 - sourceIndex;
                updatePairLabels();
            };
        } else {
            // 1-to-Many Batch Mode: Dropdown to pick Source, with dynamic target count
            var pickerGroup = rolePanel.add("group");
            pickerGroup.orientation = "row";
            pickerGroup.alignChildren = ["left", "center"];
            pickerGroup.spacing = 8;

            var dropLabel = pickerGroup.add("statictext", undefined, "Source Shape (Geometry to copy):");
            dropLabel.characters = 28;

            var itemTitles = [];
            for (var m = 0; m < validItems.length; m++) {
                itemTitles.push(getItemDescription(validItems[m], m));
            }

            sourceDropdown = pickerGroup.add("dropdownlist", undefined, itemTitles);
            sourceDropdown.selection = 0;
            sourceDropdown.alignment = ["fill", "center"];

            var batchSummary = rolePanel.add("statictext", undefined, "");

            function updateBatchSummary() {
                var currentSrc = sourceDropdown.selection.index;
                var targetCount = validItems.length - 1;
                batchSummary.text = "Destination: " + targetCount + " selected shapes will be replaced with the geometry of Shape [" + (currentSrc + 1) + "].";
            }
            updateBatchSummary();

            sourceDropdown.onChange = function () {
                updateBatchSummary();
            };
        }

        // Placement Mode Panel
        var modePanel = dialog.add("panel", undefined, "Geometry Placement / Alignment");
        modePanel.orientation = "column";
        modePanel.alignChildren = ["left", "top"];
        modePanel.spacing = 6;
        modePanel.margins = 12;

        var rbCenter = modePanel.add("radiobutton", undefined, "Center on Target (In-Place, Preserve Scale & Proportions)");
        var rbAbsolute = modePanel.add("radiobutton", undefined, "Keep Source Position (AE-Style Exact Document Coordinates)");
        var rbFit = modePanel.add("radiobutton", undefined, "Fit to Target Bounds (Proportional Scale & Center)");
        var rbStretch = modePanel.add("radiobutton", undefined, "Stretch to Target Bounds (Scale Width & Height)");

        rbCenter.value = true; // Default recommended mode

        rbCenter.helpTip = "Moves the source shape's geometry to each destination's center without changing original proportions or size.";
        rbAbsolute.helpTip = "Transfers the source path's exact global coordinates to all target shapes.";
        rbFit.helpTip = "Scales the source geometry proportionally to fit neatly inside each target's individual bounding box.";
        rbStretch.helpTip = "Scales the source geometry to match each target's individual width and height.";

        // Notice Panel
        var infoPanel = dialog.add("group");
        infoPanel.orientation = "column";
        infoPanel.alignChildren = ["left", "top"];
        var note1 = infoPanel.add("statictext", undefined, "• Each destination shape preserves its own fill, stroke, opacity, and live effects.");
        var note2 = infoPanel.add("statictext", undefined, "• The source shape remains completely untouched.");

        // Buttons
        var btnGroup = dialog.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = ["right", "bottom"];
        btnGroup.spacing = 8;

        var cancelBtn = btnGroup.add("button", undefined, "Cancel", { name: "cancel" });
        var okBtn = btnGroup.add("button", undefined, isPairMode ? "Replace Path" : "Replace All " + (validItems.length - 1) + " Paths", { name: "ok" });
        okBtn.active = true;

        if (dialog.show() !== 1) {
            return; // User clicked Cancel
        }

        // ---------------------------------------------------------------------
        // Determine Source & Destinations
        // ---------------------------------------------------------------------
        var finalSourceIndex = isPairMode ? sourceIndex : sourceDropdown.selection.index;
        var sourceItem = validItems[finalSourceIndex];

        var destItems = [];
        for (var d = 0; d < validItems.length; d++) {
            if (d !== finalSourceIndex) {
                destItems.push(validItems[d]);
            }
        }

        var subpaths = extractGeometry(sourceItem);
        if (subpaths.length === 0) {
            alert("No path geometry found in the source object.", "Path Replacement Error");
            return;
        }

        var srcBounds = getBoundsData(sourceItem);

        var mode = "center";
        if (rbAbsolute.value) mode = "absolute";
        else if (rbFit.value) mode = "fit";
        else if (rbStretch.value) mode = "stretch";

        // ---------------------------------------------------------------------
        // Execute Batch Replacement
        // ---------------------------------------------------------------------
        var modifiedItems = [];
        var lockedSkipped = 0;

        try {
            for (var t = 0; t < destItems.length; t++) {
                var targetItem = destItems[t];

                if (targetItem.locked || targetItem.hidden) {
                    lockedSkipped++;
                    continue;
                }

                var dstBounds = getBoundsData(targetItem);
                var transformFn = createTransformFunction(mode, srcBounds, dstBounds);

                var finalModified = transferGeometry(targetItem, subpaths, transformFn);
                if (finalModified) {
                    modifiedItems.push(finalModified);
                }
            }

            // Deselect source, select all modified destination items
            doc.selection = null;
            for (var s = 0; s < modifiedItems.length; s++) {
                try {
                    modifiedItems[s].selected = true;
                } catch (e) {
                    // Ignore selection error on subpath containers
                }
            }

            app.redraw();

            if (lockedSkipped > 0) {
                alert("Replacement completed, but " + lockedSkipped + " destination object(s) were skipped because they are locked or hidden.", "Batch Path Replacement");
            }
        } catch (err) {
            alert("Error during path replacement:\n" + err.message + "\nLine: " + err.line, "Path Replacement Failed");
        }
    }

    main();
})();
