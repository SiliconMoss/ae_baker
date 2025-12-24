/**
 * After Effects Property Baker - Panel Logic
 */

(function () {
    'use strict';

    var csInterface = new CSInterface();
    var refreshBtn = document.getElementById('refreshBtn');
    var bakeBtn = document.getElementById('bakeBtn');
    var enableExprBtn = document.getElementById('enableExprBtn');
    var disableExprBtn = document.getElementById('disableExprBtn');
    var layerCountEl = document.getElementById('layerCount');
    var selectedPropName = document.getElementById('selectedPropName');
    var statusMessage = document.getElementById('statusMessage');
    var propertyInfo = document.getElementById('propertyInfo');
    var propertyTree = document.getElementById('propertyTree');

    var currentProperty = null;
    var expandedPaths = {};
    var lastSelectionHash = "";

    // Initialize
    function init() {
        refreshSelection();

        // Event Listeners
        refreshBtn.addEventListener('click', refreshSelection);
        bakeBtn.addEventListener('click', bakeAction);
        enableExprBtn.addEventListener('click', function () { toggleExpression(true); });
        disableExprBtn.addEventListener('click', function () { toggleExpression(false); });

        // CEP Selection Change Event (as fallback)
        csInterface.addEventListener("com.adobe.aftereffects.SelectionChanged", function (event) {
            refreshSelection();
        });

        // Polling logic for reliable selection change detection
        setInterval(function () {
            checkSelectionChange();
        }, 1000);
    }

    // Helper to check if selection actually changed via ExtendScript
    function checkSelectionChange() {
        // Just get the layer indices as a quick hash
        csInterface.evalScript('var layers = app.project.activeItem ? app.project.activeItem.selectedLayers : []; var ids = []; for(var i=0; i<layers.length; i++) ids.push(layers[i].index); ids.join(",");', function (result) {
            if (result !== lastSelectionHash) {
                lastSelectionHash = result;
                refreshSelection();
            }
        });
    }

    // Refresh the list of layers and common properties
    function refreshSelection() {
        updateStatus("Scanning...", "");

        csInterface.evalScript('propertyBaker.getCommonProperties()', function (result) {
            if (!result) {
                updateStatus("Err: Empty response from AE", "error");
                return;
            }

            if (result.indexOf("EXTENDSCRIPT_ERROR:") === 0) {
                updateStatus(result.replace("EXTENDSCRIPT_ERROR: ", ""), "error");
                console.error("AE Side Error:", result);
                return;
            }

            try {
                var data = JSON.parse(result);

                if (data.error) {
                    layerCountEl.textContent = "0";
                    updateStatus(data.error, "warning");
                    clearPropertyTree();
                    return;
                }

                layerCountEl.textContent = data.layers;
                renderTree(data.tree);
                updateStatus("Ready", "success");

            } catch (e) {
                // Show a snippet of the broken result in the status bar
                var snippet = result.length > 20 ? result.substring(0, 17) + "..." : result;
                updateStatus("Parse Err: " + snippet, "error");
                console.error("JSON Parse Error:", e);
                console.error("Raw result from AE:", result);
            }
        });
    }

    function clearPropertyTree() {
        propertyTree.innerHTML = '<div class="tree-placeholder">Select layers...</div>';
        propertyInfo.textContent = "";
        propertyInfo.classList.remove('show');
        selectedPropName.textContent = "Pick a property";
        currentProperty = null;
        disableActionButtons();
    }

    function renderTree(treeData) {
        propertyTree.innerHTML = '';

        if (!treeData || treeData.length === 0) {
            propertyTree.innerHTML = '<div class="tree-placeholder">No modified props</div>';
            return;
        }

        var rootContainer = document.createElement('div');
        treeData.forEach(function (item) {
            rootContainer.appendChild(createTreeNode(item));
        });
        propertyTree.appendChild(rootContainer);

        restoreTreeState();
    }

    function createTreeNode(item) {
        var node = document.createElement('div');
        node.className = 'tree-node';
        node.dataset.path = item.path;

        var content = document.createElement('div');
        content.className = 'tree-item';

        // Restore expansion state
        if (expandedPaths[item.path]) {
            content.classList.add('parent-expanded');
        }

        // Restore selection highlight
        if (currentProperty && currentProperty.path === item.path) {
            content.classList.add('selected');
        }

        var toggle = document.createElement('span');
        toggle.className = 'tree-group-toggle';
        toggle.innerHTML = item.type === 'group' ? (expandedPaths[item.path] ? '▼' : '▶') : '';
        content.appendChild(toggle);

        var icon = document.createElement('span');
        icon.className = item.type === 'group' ? 'icon-group' : 'icon-prop';
        icon.innerHTML = item.type === 'group' ? '📁' : '🔹';
        content.appendChild(icon);

        var text = document.createElement('span');
        text.textContent = item.name;
        content.appendChild(text);

        node.appendChild(content);

        if (item.type === 'group' && item.children) {
            var childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';

            // Re-expand if it was previously expanded OR default to expanded if never seen
            var isExpanded = expandedPaths[item.path] !== false; // Default to true if undefined
            if (isExpanded) {
                childrenContainer.classList.add('expanded');
                toggle.innerHTML = '▼';
            }

            item.children.forEach(function (child) {
                childrenContainer.appendChild(createTreeNode(child));
            });
            node.appendChild(childrenContainer);

            content.addEventListener('click', function (e) {
                e.stopPropagation();
                var currentlyExpanded = childrenContainer.classList.contains('expanded');
                if (currentlyExpanded) {
                    childrenContainer.classList.remove('expanded');
                    toggle.innerHTML = '▶';
                    expandedPaths[item.path] = false; // Mark as manually collapsed
                } else {
                    childrenContainer.classList.add('expanded');
                    toggle.innerHTML = '▼';
                    expandedPaths[item.path] = true; // Mark as manually expanded
                }
            });
        } else {
            content.addEventListener('click', function (e) {
                e.stopPropagation();
                document.querySelectorAll('.tree-item.selected').forEach(function (el) {
                    el.classList.remove('selected');
                });
                content.classList.add('selected');
                onPropertySelected(item);
            });
        }

        return node;
    }

    function restoreTreeState() {
        if (currentProperty) {
            // Find if currentProperty still exists in the new tree
            var stillExists = false;
            // The highlights are already handled in createTreeNode during render
            // We just need to trigger the status update to keep buttons active
            onPropertySelected(currentProperty, true);
        }
    }

    function onPropertySelected(prop, silent) {
        currentProperty = prop;
        selectedPropName.textContent = prop.name;
        if (!silent) updateStatus("Selected: " + prop.name, "");

        var script = 'propertyBaker.getPropertyStatus("' + prop.path + '", "' + (prop.isEssential || false) + '")';
        csInterface.evalScript(script, function (result) {
            if (!result) {
                console.warn("onPropertySelected: Empty response for property status.");
                return;
            }
            try {
                var status = JSON.parse(result);

                if (status.hasExpression) {
                    propertyInfo.textContent = "Expr " + (status.expressionEnabled ? "Active" : "OFF");
                    propertyInfo.classList.add('show');
                    enableExprBtn.disabled = status.expressionEnabled;
                    disableExprBtn.disabled = !status.expressionEnabled;
                } else {
                    propertyInfo.textContent = "";
                    propertyInfo.classList.remove('show');
                    enableExprBtn.disabled = true;
                    disableExprBtn.disabled = true;
                }

                bakeBtn.disabled = false;

            } catch (e) {
                console.error("Status Parse Error:", e);
                console.error("Raw status result:", result);
            }
        });
    }

    function bakeAction() {
        if (!currentProperty) return;

        var prop = currentProperty;
        var script = 'propertyBaker.bakeKeyframe("' + prop.path + '", "' + (prop.isEssential || false) + '")';

        updateStatus("Baking...", "");

        csInterface.evalScript(script, function (result) {
            updateStatus(result, "success");
            onPropertySelected(prop);
        });
    }

    function toggleExpression(enable) {
        if (!currentProperty) return;

        var prop = currentProperty;
        var script = 'propertyBaker.setExpressionState("' + prop.path + '", "' + (prop.isEssential || false) + '", "' + enable + '")';

        updateStatus((enable ? "Enabling..." : "Disabling..."), "");

        csInterface.evalScript(script, function (result) {
            updateStatus(result, "success");
            onPropertySelected(prop);
        });
    }

    function disableActionButtons() {
        bakeBtn.disabled = true;
        enableExprBtn.disabled = true;
        disableExprBtn.disabled = true;
    }

    function updateStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = "status-message " + (type || "");
    }

    init();

})();
