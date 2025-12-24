/*
    After Effects Property Baker - ExtendScript Logic
*/

var propertyBaker = (function () {

    // Helper to get all selected layers in active comp
    function getSelectedLayers() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return null;
        return comp.selectedLayers;
    }

    // Helper to get property path (matchName based)
    function getPropertyPath(prop) {
        var path = [];
        var current = prop;
        while (current.parentProperty != null) {
            path.unshift(current.matchName);
            current = current.parentProperty;
        }
        return path.join('|');
    }

    // Helper to navigate to a property by path
    function getPropertyByPath(layer, path) {
        if (!path) return null;
        var parts = path.split('|');
        var current = layer;

        try {
            for (var i = 0; i < parts.length; i++) {
                current = current.property(parts[i]);
                if (!current) return null;
            }
            return current;
        } catch (e) {
            return null;
        }
    }

    // Helper to check if a property is an Essential Property
    function getEssentialProperties(comp) {
        var props = [];
        // Essential properties are a bit different, they are linked to the Master Property
        // Actually, we can check layer.essentialProperty(name) if available
        return props;
    }

    // Helper to check if a property is "modified" (strictly keyframes or expression)
    function isPropertyModified(prop) {
        if (prop.propertyType !== PropertyType.PROPERTY) return false;
        if (prop.numKeys > 0) return true;
        if (prop.expression !== "") return true;
        return false;
    }

    return {
        // Returns common properties tree across all selected layers
        getCommonProperties: function () {
            try {
                var layers = getSelectedLayers();
                if (!layers || layers.length === 0) return JSON.stringify({ error: "No layers selected" });

                var firstLayer = layers[0];

                function traverseTree(propGroup) {
                    var items = [];
                    var nameMap = {}; // To merge groups with the same name

                    for (var i = 1; i <= propGroup.numProperties; i++) {
                        var prop = propGroup.property(i);

                        // Skip Essential Properties group during normal traversal
                        // (MatchName check + Name check for safety)
                        if (prop.matchName === "ADBE Essential Properties" || prop.name === "Essential Properties") continue;

                        var path = getPropertyPath(prop);

                        // Verify property exists on all other layers
                        var existsOnAll = true;
                        for (var j = 1; j < layers.length; j++) {
                            if (!getPropertyByPath(layers[j], path)) {
                                existsOnAll = false;
                                break;
                            }
                        }
                        if (!existsOnAll) continue;

                        if (prop.propertyType === PropertyType.PROPERTY) {
                            // Only add if modified
                            if (isPropertyModified(prop)) {
                                items.push({
                                    name: prop.name,
                                    matchName: prop.matchName,
                                    path: path,
                                    type: "property"
                                });
                            }
                        } else {
                            var children = traverseTree(prop);
                            if (children.length > 0) {
                                // Check if a group with this name already exists at this level
                                if (nameMap[prop.name]) {
                                    // Merge children
                                    var existingGroup = nameMap[prop.name];
                                    existingGroup.children = existingGroup.children.concat(children);
                                } else {
                                    var newGroup = {
                                        name: prop.name,
                                        matchName: prop.matchName,
                                        path: path,
                                        type: "group",
                                        children: children
                                    };
                                    items.push(newGroup);
                                    nameMap[prop.name] = newGroup;
                                }
                            }
                        }
                    }
                    return items;
                }

                var tree = traverseTree(firstLayer);

                // Add Essential Properties manually (Essential Graphics)
                try {
                    if (firstLayer.essentialProperty && firstLayer.essentialProperty.numProperties > 0) {
                        var eGroup = {
                            name: "Essential Graphics",
                            type: "group",
                            children: []
                        };
                        for (var i = 1; i <= firstLayer.essentialProperty.numProperties; i++) {
                            var eProp = firstLayer.essentialProperty(i);
                            var eName = eProp.name;

                            // Check if modified (any keyframes or non-default?)
                            // Essential properties usually count as modified if they exist
                            var modified = (eProp.numKeys > 0) || (eProp.expression !== "");

                            var existsOnAll = true;
                            for (var j = 1; j < layers.length; j++) {
                                try { if (!layers[j].essentialProperty(eName)) existsOnAll = false; } catch (e) { existsOnAll = false; }
                            }

                            if (existsOnAll && (modified || true)) { // Showing all common essentials for now as they are often externalized for a reason
                                eGroup.children.push({
                                    name: eName,
                                    matchName: eName,
                                    path: "Essential|" + eName,
                                    type: "property",
                                    isEssential: true
                                });
                            }
                        }
                        if (eGroup.children.length > 0) tree.push(eGroup);
                    }
                } catch (e) { }

                return JSON.stringify({ layers: layers.length, tree: tree });
            } catch (err) {
                return "EXTENDSCRIPT_ERROR: " + err.toString() + " (Line: " + err.line + ")";
            }
        },

        // Gets info about a specific property on selected layers
        getPropertyStatus: function (path, isEssential) {
            var layers = getSelectedLayers();
            if (!layers || layers.length === 0) return JSON.stringify({ error: "No layers selected" });

            var hasExpression = false;
            var expressionEnabled = false;

            var prop;
            if (isEssential === "true") {
                try { prop = layers[0].essentialProperty(path.split('|')[1]); } catch (e) { }
            } else {
                prop = getPropertyByPath(layers[0], path);
            }

            if (prop && prop.canSetExpression) {
                if (prop.expression !== "") {
                    hasExpression = true;
                    expressionEnabled = prop.expressionEnabled;
                }
            }

            return JSON.stringify({
                hasExpression: hasExpression,
                expressionEnabled: expressionEnabled
            });
        },

        // Bakes the current value at CTI
        bakeKeyframe: function (path, isEssential) {
            var layers = getSelectedLayers();
            if (!layers || layers.length === 0) return "Error: No layers selected";

            var comp = app.project.activeItem;
            var time = comp.time;
            var count = 0;

            app.beginUndoGroup("Bake Property Keyframe");

            for (var i = 0; i < layers.length; i++) {
                var prop;
                if (isEssential === "true") {
                    try { prop = layers[i].essentialProperty(path.split('|')[1]); } catch (e) { }
                } else {
                    prop = getPropertyByPath(layers[i], path);
                }

                if (prop && prop.propertyType === PropertyType.PROPERTY) {
                    // preExpression = false to get evaluated value
                    var val = prop.valueAtTime(time, false);
                    prop.setValueAtTime(time, val);
                    count++;
                }
            }

            app.endUndoGroup();
            return "Baked " + count + " layers at " + time.toFixed(2) + "s";
        },

        // Enables or disables expression
        setExpressionState: function (path, isEssential, enable) {
            var layers = getSelectedLayers();
            if (!layers || layers.length === 0) return "Error: No layers selected";

            var state = (enable === "true");
            var count = 0;

            app.beginUndoGroup(state ? "Enable Expressions" : "Disable Expressions");

            for (var i = 0; i < layers.length; i++) {
                var prop;
                if (isEssential === "true") {
                    try { prop = layers[i].essentialProperty(path.split('|')[1]); } catch (e) { }
                } else {
                    prop = getPropertyByPath(layers[i], path);
                }

                if (prop && prop.canSetExpression && prop.expression !== "") {
                    prop.expressionEnabled = state;
                    count++;
                }
            }

            app.endUndoGroup();
            return (state ? "Enabled" : "Disabled") + " expressions on " + count + " layers";
        }
    };
})();
