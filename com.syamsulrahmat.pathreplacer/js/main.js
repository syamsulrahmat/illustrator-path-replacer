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
    var alignModeSelect = document.getElementById("alignMode");

    function setToast(message, type) {
        statusToast.textContent = message;
        statusToast.className = "status-toast" + (type ? " " + type : "");
    }

    function refreshSelection() {
        setToast("Checking...", "");
        csInterface.evalScript("PathReplacerHost.getSelectionState()", function (resultStr) {
            try {
                var res = JSON.parse(resultStr);
                if (res.status === "no_doc") {
                    currentSelection = null;
                    selectionContent.innerHTML = '<div class="empty-state">No document open<div class="hint">Open a document to begin</div></div>';
                    replaceBtn.disabled = true;
                    replaceBtn.textContent = "Replace Path";
                    setToast("No document open", "");
                    return;
                }

                if (res.status === "no_selection" || !res.items || res.items.length === 0) {
                    currentSelection = null;
                    selectionContent.innerHTML = '<div class="empty-state">No shapes selected<div class="hint">Select 2+ shapes on canvas</div></div>';
                    replaceBtn.disabled = true;
                    replaceBtn.textContent = "Replace Path";
                    setToast("No shapes selected", "");
                    return;
                }

                if (res.count < 2) {
                    currentSelection = res;
                    var warn = res.invalidCount > 0 ? " (" + res.invalidCount + " non-vector)" : "";
                    selectionContent.innerHTML = '<div class="empty-state">Only 1 shape selected' + warn + '<div class="hint">Need Source + Target</div></div>';
                    replaceBtn.disabled = true;
                    replaceBtn.textContent = "Replace Path";
                    setToast("Select 1 more shape", "");
                    return;
                }

                currentSelection = res;
                if (sourceIndex >= res.items.length) {
                    sourceIndex = 0;
                }

                renderSelectionUI();
                setToast("Ready (Ctrl+Z to Undo)", "");
            } catch (err) {
                setToast("Error: " + err.message, "error");
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
            html += '<div class="role-badge source">Source (' + srcStack + ')</div>';
            html += '<div class="object-name">' + (srcItem.name || srcItem.type) + '</div>';
            html += '<div class="object-meta">' + (srcItem.clipping ? '[Clip] ' : '') + (srcItem.type === "PathItem" ? srcItem.points + " pts" : srcItem.subpaths + " subpaths") + ' • ' + (srcItem.layer || "Layer") + '</div>';
            html += '</div>';

            html += '<button id="swapBtn" class="swap-btn" title="Reverse Source and Target">⇄ Swap Roles</button>';

            html += '<div class="object-row target">';
            html += '<div class="role-badge target">Target (' + dstStack + ')</div>';
            html += '<div class="object-name">' + (dstItem.name || dstItem.type) + '</div>';
            html += '<div class="object-meta">' + (dstItem.clipping ? '[Clip] ' : '') + (dstItem.type === "PathItem" ? dstItem.points + " pts" : dstItem.subpaths + " subpaths") + ' • ' + (dstItem.layer || "Layer") + '</div>';
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
            bHtml += '<label class="card-title">Source Shape (Copy from):</label>';
            bHtml += '<select id="batchSourceSelect" class="batch-select">';
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var selAttr = (i === sourceIndex) ? ' selected' : '';
                bHtml += '<option value="' + i + '"' + selAttr + '>' + it.label + '</option>';
            }
            bHtml += '</select>';

            var targetCount = items.length - 1;
            bHtml += '<div class="batch-info"><strong>' + targetCount + ' target shapes</strong> will be replaced with Shape [' + (sourceIndex + 1) + '].</div>';
            bHtml += '</div>';

            selectionContent.innerHTML = bHtml;

            document.getElementById("batchSourceSelect").addEventListener("change", function (e) {
                sourceIndex = parseInt(e.target.value, 10);
                var tc = items.length - 1;
                var infoEl = selectionContent.querySelector(".batch-info");
                if (infoEl) {
                    infoEl.innerHTML = '<strong>' + tc + ' target shapes</strong> will be replaced with Shape [' + (sourceIndex + 1) + '].';
                }
            });

            replaceBtn.disabled = false;
            replaceBtn.textContent = "Replace All (" + targetCount + ")";
        }
    }

    function executeReplacement() {
        if (!currentSelection || currentSelection.items.length < 2) return;

        var mode = alignModeSelect ? alignModeSelect.value : "absolute";

        replaceBtn.disabled = true;
        setToast("Replacing...", "");

        var scriptCall = "PathReplacerHost.executeReplace(" + sourceIndex + ", '" + mode + "')";
        csInterface.evalScript(scriptCall, function (resultStr) {
            replaceBtn.disabled = false;
            try {
                var res = JSON.parse(resultStr);
                if (res.status === "success") {
                    var msg = "✓ Replaced " + res.replacedCount + " path(s)";
                    if (res.lockedSkipped > 0) {
                        msg += " (" + res.lockedSkipped + " skipped)";
                    }
                    setToast(msg, "success");
                    setTimeout(refreshSelection, 350);
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
