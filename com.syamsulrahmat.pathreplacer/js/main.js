(function () {
    "use strict";

    var csInterface = new CSInterface();
    var currentSelection = null;
    var sourceIndex = 0; // Topmost item by default

    // DOM Elements
    var refreshBtn = document.getElementById("refreshBtn");
    var selectionContent = document.getElementById("selectionContent");
    var replaceBtn = document.getElementById("replaceBtn");
    var statusToast = document.getElementById("statusToast");

    function setToast(message, type) {
        statusToast.textContent = message;
        statusToast.className = "status-toast" + (type ? " " + type : "");
    }

    function refreshSelection() {
        setToast("Checking selection...", "");
        csInterface.evalScript("PathReplacerHost.getSelectionState()", function (resultStr) {
            try {
                var res = JSON.parse(resultStr);
                if (res.status === "no_doc") {
                    currentSelection = null;
                    selectionContent.innerHTML = '<div class="empty-state">No document open.<div class="hint">Open an Illustrator document to begin.</div></div>';
                    replaceBtn.disabled = true;
                    replaceBtn.textContent = "Replace Path";
                    setToast("No document open", "");
                    return;
                }

                if (res.status === "no_selection" || !res.items || res.items.length === 0) {
                    currentSelection = null;
                    selectionContent.innerHTML = '<div class="empty-state">No shapes selected.<div class="hint">Select 2 or more shapes on canvas.</div></div>';
                    replaceBtn.disabled = true;
                    replaceBtn.textContent = "Replace Path";
                    setToast("No shapes selected", "");
                    return;
                }

                if (res.count < 2) {
                    currentSelection = res;
                    var warn = res.invalidCount > 0 ? " (Skipped " + res.invalidCount + " non-vector object)" : "";
                    selectionContent.innerHTML = '<div class="empty-state">Only 1 shape selected' + warn + '.<div class="hint">Need at least 1 Source and 1 Destination.</div></div>';
                    replaceBtn.disabled = true;
                    replaceBtn.textContent = "Replace Path";
                    setToast("Select 1 more shape", "");
                    return;
                }

                currentSelection = res;
                // Clamp source index
                if (sourceIndex >= res.items.length) {
                    sourceIndex = 0;
                }

                renderSelectionUI();
                setToast("Ready (Single Ctrl+Z Undo)", "");
            } catch (err) {
                setToast("Error reading selection: " + err.message, "error");
            }
        });
    }

    function renderSelectionUI() {
        if (!currentSelection || currentSelection.items.length < 2) return;

        var items = currentSelection.items;

        if (items.length === 2) {
            // 1-to-1 Pair Mode
            var srcItem = items[sourceIndex];
            var dstItem = items[1 - sourceIndex];
            var srcStack = (sourceIndex === 0) ? "Top" : "Bottom";
            var dstStack = (sourceIndex === 0) ? "Bottom" : "Top";

            var html = '<div class="pair-container">';
            html += '<div class="object-row source">';
            html += '<div class="role-badge source">Source (' + srcStack + ') - Geometry to copy</div>';
            html += '<div class="object-name">' + (srcItem.name || srcItem.type) + '</div>';
            html += '<div class="object-meta">' + (srcItem.clipping ? '[Clip Mask] ' : '') + (srcItem.type === "PathItem" ? srcItem.points + " pts" : srcItem.subpaths + " subpaths") + ' • ' + (srcItem.layer || "Layer") + '</div>';
            html += '</div>';

            html += '<button id="swapBtn" class="swap-btn" title="Reverse Source and Destination">⇄ Swap Roles</button>';

            html += '<div class="object-row target">';
            html += '<div class="role-badge target">Target (' + dstStack + ') - Appearance to keep</div>';
            html += '<div class="object-name">' + (dstItem.name || dstItem.type) + '</div>';
            html += '<div class="object-meta">' + (dstItem.clipping ? '[Clip Mask] ' : '') + (dstItem.type === "PathItem" ? dstItem.points + " pts" : dstItem.subpaths + " subpaths") + ' • ' + (dstItem.layer || "Layer") + '</div>';
            html += '</div>';
            html += '</div>';

            selectionContent.innerHTML = html;

            document.getElementById("swapBtn").addEventListener("click", function () {
                sourceIndex = 1 - sourceIndex;
                renderSelectionUI();
            });

            replaceBtn.disabled = false;
            replaceBtn.textContent = "Replace Path";
        } else {
            // 1-to-Many Batch Mode
            var bHtml = '<div class="batch-container">';
            bHtml += '<label class="card-title" style="display:block; margin-bottom:4px;">Source Template:</label>';
            bHtml += '<select id="batchSourceSelect" class="batch-select">';
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var selAttr = (i === sourceIndex) ? ' selected' : '';
                bHtml += '<option value="' + i + '"' + selAttr + '>' + it.label + '</option>';
            }
            bHtml += '</select>';

            var targetCount = items.length - 1;
            bHtml += '<div class="batch-info"><strong>' + targetCount + ' destinations</strong> will be transformed to match the geometry of the selected source shape.</div>';
            bHtml += '</div>';

            selectionContent.innerHTML = bHtml;

            document.getElementById("batchSourceSelect").addEventListener("change", function (e) {
                sourceIndex = parseInt(e.target.value, 10);
            });

            replaceBtn.disabled = false;
            replaceBtn.textContent = "Replace All " + targetCount + " Paths";
        }
    }

    function executeReplacement() {
        if (!currentSelection || currentSelection.items.length < 2) return;

        var modeInput = document.querySelector('input[name="alignMode"]:checked');
        var mode = modeInput ? modeInput.value : "center";

        replaceBtn.disabled = true;
        setToast("Replacing path geometry...", "");

        var scriptCall = "PathReplacerHost.executeReplace(" + sourceIndex + ", '" + mode + "')";
        csInterface.evalScript(scriptCall, function (resultStr) {
            replaceBtn.disabled = false;
            try {
                var res = JSON.parse(resultStr);
                if (res.status === "success") {
                    var msg = "✓ Successfully replaced " + res.replacedCount + " path(s)!";
                    if (res.lockedSkipped > 0) {
                        msg += " (Skipped " + res.lockedSkipped + " locked/hidden)";
                    }
                    setToast(msg, "success");
                    // Refresh view
                    setTimeout(refreshSelection, 400);
                } else {
                    setToast("Error: " + (res.message || "Failed"), "error");
                }
            } catch (e) {
                setToast("Execution returned: " + resultStr, "error");
            }
        });
    }

    // Event Listeners
    refreshBtn.addEventListener("click", refreshSelection);
    replaceBtn.addEventListener("click", executeReplacement);

    // Auto-refresh when panel gets focus or mouse enters
    window.addEventListener("focus", refreshSelection);
    document.body.addEventListener("mouseenter", function () {
        if (!currentSelection || currentSelection.count < 2) {
            refreshSelection();
        }
    });

    // Initial check
    refreshSelection();
})();
