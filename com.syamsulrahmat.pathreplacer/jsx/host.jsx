/**
 * Host ExtendScript for Illustrator Path Replacer CEP Extension
 */

#target illustrator

var PathReplacerHost = (function () {
    "use strict";

    // -------------------------------------------------------------------------
    // Lightweight JSON Polyfill for ExtendScript
    // -------------------------------------------------------------------------
    var JSONHelper = {
        stringify: function (obj) {
            var t = typeof obj;
            if (t !== "object" || obj === null) {
                if (t === "string") return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
                return String(obj);
            }
            var json = [], isArr = (obj && obj.constructor === Array);
            for (var n in obj) {
                if (obj.hasOwnProperty(n)) {
                    var v = obj[n];
                    t = typeof v;
                    if (t === "string") v = '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
                    else if (t === "object" && v !== null) v = this.stringify(v);
                    json.push((isArr ? "" : '"' + n + '":') + String(v));
                }
            }
            return (isArr ? "[" : "{") + String(json) + (isArr ? "]" : "}");
        },
        parse: function (str) {
            return eval("(" + str + ")");
        }
    };

    // -------------------------------------------------------------------------
    // Helper & Geometry Functions
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
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: Math.abs(right - left),
            height: Math.abs(top - bottom),
            centerX: (left + right) / 2,
            centerY: (top + bottom) / 2
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

                if (isClipping) comp.clipping = true;
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
        if (mode === "center") {
            var dxCenter = dstBounds.centerX - srcBounds.centerX;
            var dyCenter = dstBounds.centerY - srcBounds.centerY;
            return function (pt) {
                return [pt[0] + dxCenter, pt[1] + dyCenter];
            };
        } else if (mode === "absolute") {
            return function (pt) {
                return [pt[0], pt[1]];
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
    // Public API Methods for CEP Client
    // -------------------------------------------------------------------------

    return {
        /**
         * Inspects current selection and returns a JSON string describing selected vector shapes.
         */
        getSelectionState: function () {
            if (app.documents.length === 0) {
                return JSONHelper.stringify({ status: "no_doc", message: "No document open." });
            }

            var doc = app.activeDocument;
            var sel = doc.selection;

            if (!sel || sel.length === 0) {
                return JSONHelper.stringify({ status: "no_selection", message: "No objects selected." });
            }

            var validItems = [];
            var invalidCount = 0;

            for (var i = 0; i < sel.length; i++) {
                var target = resolveVectorTarget(sel[i]);
                if (target) {
                    validItems.push({
                        index: validItems.length,
                        type: target.typename,
                        name: target.name || "",
                        layer: (target.layer ? target.layer.name : ""),
                        points: (target.typename === "PathItem" ? target.pathPoints.length : 0),
                        subpaths: (target.typename === "CompoundPathItem" ? target.pathItems.length : 0),
                        clipping: !!target.clipping,
                        label: getItemDescription(target, validItems.length)
                    });
                } else {
                    invalidCount++;
                }
            }

            return JSONHelper.stringify({
                status: "ok",
                count: validItems.length,
                invalidCount: invalidCount,
                items: validItems
            });
        },

        /**
         * Executes path geometry replacement.
         */
        executeReplace: function (sourceIdx, mode) {
            if (app.documents.length === 0) {
                return JSONHelper.stringify({ status: "error", message: "No document open." });
            }

            var doc = app.activeDocument;
            var sel = doc.selection;
            if (!sel || sel.length < 2) {
                return JSONHelper.stringify({ status: "error", message: "At least 2 shapes must be selected." });
            }

            var validItems = [];
            for (var i = 0; i < sel.length; i++) {
                var res = resolveVectorTarget(sel[i]);
                if (res) validItems.push(res);
            }

            if (validItems.length < 2) {
                return JSONHelper.stringify({ status: "error", message: "Fewer than 2 valid vector shapes selected." });
            }

            sourceIdx = parseInt(sourceIdx, 10);
            if (isNaN(sourceIdx) || sourceIdx < 0 || sourceIdx >= validItems.length) {
                sourceIdx = 0;
            }

            var sourceItem = validItems[sourceIdx];
            var destItems = [];
            for (var d = 0; d < validItems.length; d++) {
                if (d !== sourceIdx) destItems.push(validItems[d]);
            }

            var subpaths = extractGeometry(sourceItem);
            if (subpaths.length === 0) {
                return JSONHelper.stringify({ status: "error", message: "Source shape contains no path points." });
            }

            var srcBounds = getBoundsData(sourceItem);
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
                    var finalMod = transferGeometry(targetItem, subpaths, transformFn);
                    if (finalMod) modifiedItems.push(finalMod);
                }

                // Re-select modified items
                doc.selection = null;
                for (var s = 0; s < modifiedItems.length; s++) {
                    try {
                        modifiedItems[s].selected = true;
                    } catch (e) {}
                }

                app.redraw();

                return JSONHelper.stringify({
                    status: "success",
                    replacedCount: modifiedItems.length,
                    lockedSkipped: lockedSkipped
                });
            } catch (err) {
                return JSONHelper.stringify({
                    status: "error",
                    message: err.message + " (Line " + err.line + ")"
                });
            }
        }
    };
})();
