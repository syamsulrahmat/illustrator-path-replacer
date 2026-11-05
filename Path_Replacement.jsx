/**
 * Adobe Illustrator Path Replacement Script (ExtendScript JSX)
 * -------------------------------------------------------------
 * Replaces the path geometry of destination vector shape(s) with the path geometry
 * of a source vector shape, preserving each destination's original appearance,
 * styling (fill, stroke, gradients, opacity, effects), clipping mask status,
 * and hierarchy in the document.
 *
 * Capabilities:
 * - 1-to-1 Mode (2 objects selected): Quick swap between Top and Bottom shapes.
 * - 1-to-Many Batch Mode (3+ objects selected): Choose 1 Source shape, and batch-replace
 *   all other destination shapes across your artboard.
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

    function resolveVectorTarget(item) {
        if (!item) return null;
        var type = item.typename;

        if (type === "PathItem" || type === "CompoundPathItem") {
            return item;
        }

        if (type === "GroupItem") {
            if (item.clipped && item.pageItems.length > 0) {
                var maskCandidate = item.pageItems[0];
                if (maskCandidate.typename === "PathItem" || maskCandidate.typename === "CompoundPathItem") {
                    return maskCandidate;
                }
            }
            if (item.pageItems.length === 1) {
                return resolveVectorTarget(item.pageItems[0]);
            }
        }

        return null;
    }

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

    function getBoundsData(item) {
        var b = item.geometricBounds;
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

    function applySubpath(targetPath, subpathData, transformFn) {
        var srcPts = subpathData.points;
        var targetLen = srcPts.length;
        if (targetLen === 0) return;

        targetPath.closed = false;

        var currentLen = targetPath.pathPoints.length;
        if (currentLen < targetLen) {
            for (var i = currentLen; i < targetLen; i++) {
                targetPath.pathPoints.add();
            }
        } else if (currentLen > targetLen) {
            for (var j = currentLen - 1; j >= targetLen; j--) {
                targetPath.pathPoints[j].remove();
            }
        }

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

        targetPath.closed = subpathData.closed;
    }

    function transferGeometry(destItem, subpaths, transformFn) {
        if (subpaths.length === 0) return destItem;

        var finalItem = destItem;

        if (destItem.typename === "PathItem") {
            if (subpaths.length === 1) {
                applySubpath(destItem, subpaths[0], transformFn);
            } else {
                var parent = destItem.parent;
                var comp = parent.compoundPathItems.add();
                comp.move(destItem, ElementPlacement.PLACEBEFORE);

                var isClipping = destItem.clipping;
                destItem.move(comp, ElementPlacement.INSIDE);

                applySubpath(destItem, subpaths[0], transformFn);

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

            if (curSubCount < targetSubCount) {
                for (var a = curSubCount; a < targetSubCount; a++) {
                    destItem.pathItems.add();
                }
            } else if (curSubCount > targetSubCount) {
                for (var b = curSubCount - 1; b >= targetSubCount; b--) {
                    destItem.pathItems[b].remove();
                }
            }

            for (var c = 0; c < targetSubCount; c++) {
                applySubpath(destItem.pathItems[c], subpaths[c], transformFn);
            }
        }

        return finalItem;
    }

    function createTransformFunction(mode, srcBounds, dstBounds) {
        if (mode === "absolute") {
            return function (pt) {
                return [pt[0], pt[1]];
            };
        } else if (mode === "center") {
            var dxCenter = dstBounds.centerX - srcBounds.centerX;
            var dyCenter = dstBounds.centerY - srcBounds.centerY;
            return function (pt) {
                return [pt[0] + dxCenter, pt[1] + dyCenter];
            };
        } else if (mode === "fit") {
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
        var sourceIndex = 0;

        // ---------------------------------------------------------------------
        // Compact ScriptUI Dialog Setup
        // ---------------------------------------------------------------------
        var dialogTitle = isPairMode ? "Path Geometry Replacement" : "Batch Path Replacement (" + validItems.length + " Objects)";
        var dialog = new Window("dialog", dialogTitle);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 8;
        dialog.margins = 12;

        // Header Panel: Selection & Source Definition
        var rolePanel = dialog.add("panel", undefined, isPairMode ? "Selection" : "Source & Targets");
        rolePanel.orientation = "column";
        rolePanel.alignChildren = ["fill", "top"];
        rolePanel.spacing = 6;
        rolePanel.margins = 10;

        var sourceDropdown;
        var sourceText, destText, swapBtn;

        if (isPairMode) {
            sourceText = rolePanel.add("statictext", undefined, "", { truncate: "middle" });
            destText = rolePanel.add("statictext", undefined, "", { truncate: "middle" });
            swapBtn = rolePanel.add("button", undefined, "⇄  Swap Roles");

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
            var pickerGroup = rolePanel.add("group");
            pickerGroup.orientation = "row";
            pickerGroup.alignChildren = ["left", "center"];
            pickerGroup.spacing = 6;

            pickerGroup.add("statictext", undefined, "Source:");

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
                batchSummary.text = targetCount + " target shapes will be replaced with Shape [" + (currentSrc + 1) + "].";
            }
            updateBatchSummary();

            sourceDropdown.onChange = function () {
                updateBatchSummary();
            };
        }

        // Placement Mode Panel (Dropdown)
        var modePanel = dialog.add("panel", undefined, "Placement Mode");
        modePanel.orientation = "row";
        modePanel.alignChildren = ["left", "center"];
        modePanel.spacing = 6;
        modePanel.margins = 10;

        modePanel.add("statictext", undefined, "Mode:");

        var modeDropdown = modePanel.add("dropdownlist", undefined, [
            "Source Position",
            "Center on Target",
            "Fit to Target",
            "Stretch to Target"
        ]);
        modeDropdown.selection = 0; // "Source Position" selected automatically
        modeDropdown.alignment = ["fill", "center"];

        // Notice
        dialog.add("statictext", undefined, "• Styling, fills, strokes, and effects will be preserved.");

        // Buttons
        var btnGroup = dialog.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = ["right", "bottom"];
        btnGroup.spacing = 6;

        var cancelBtn = btnGroup.add("button", undefined, "Cancel", { name: "cancel" });
        var okBtn = btnGroup.add("button", undefined, isPairMode ? "Replace Path" : "Replace All (" + (validItems.length - 1) + ")", { name: "ok" });
        okBtn.active = true;

        if (dialog.show() !== 1) {
            return;
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

        var modeMap = ["absolute", "center", "fit", "stretch"];
        var mode = modeMap[modeDropdown.selection.index] || "absolute";

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

            doc.selection = null;
            for (var s = 0; s < modifiedItems.length; s++) {
                try {
                    modifiedItems[s].selected = true;
                } catch (e) {}
            }

            app.redraw();

            if (lockedSkipped > 0) {
                alert("Replacement completed, but " + lockedSkipped + " object(s) were skipped because they are locked or hidden.", "Path Replacement");
            }
        } catch (err) {
            alert("Error during path replacement:\n" + err.message + "\nLine: " + err.line, "Path Replacement Failed");
        }
    }

    main();
})();
