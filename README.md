# AE Property Baker

A compact and efficient After Effects panel for baking property keyframes and managing expressions across multiple layers.

![AE Property Baker UI](https://github.com/user-attachments/assets/77556f22-54a5-4914-b613-7eded509bb4c)


## Features

- **Common Property Detection**: Find shared properties across all selected layers instantly.
- **Smart Filtering**: Only shows "modified" properties (those with keyframes or expressions) to reduce clutter.
- **Hierarchical Tree View**: Navigate complex layer structures with ease, matching After Effects' native organization.
- **Post-Expression Baking**: Bakes the *evaluated* value of a property (including the result of active expressions) into a keyframe at the current time.
- **Expression Management**: Quickly Enable or Disable expressions for the selected property across all selected layers.
- **Native Aesthetic**: A professional, dark-themed UI that feels like a native part of After Effects.
- **Automatic Refresh**: Detects selection changes and updates the property tree in real-time.

## Installation

### Easy Installation (Recommended)
1. Download the latest `.zxp` from the [Releases](https://github.com/username/ae_baker/releases) page.
2. Install it using a ZXP Installer (like [Anastasiy's Extension Manager](https://install.anastasiy.com/) or [ZXP Installer](https://zxpinstaller.com/)).
3. In After Effects, go to **Window > Extensions > AE Property Baker**.

### Manual Installation (For Developers)
1. Close After Effects.
2. Clone this repository into your Adobe CEP extensions folder:
   - **Windows**: `C:\Users\<YOU>\AppData\Roaming\Adobe\CEP\extensions\ae_baker`
   - **macOS**: `~/Library/Application Support/Adobe/CEP/extensions/ae_baker`
3. If on Windows, enable [PlayerDebugMode](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_9.x/Documentation/CEP%209.0%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions).
4. Launch After Effects and find it under **Window > Extensions**.

## Usage

1. Select one or more layers in your composition.
2. The panel will automatically list the common properties that have keyframes or expressions.
3. Select a property from the tree.
4. Use the **🎯 Bake** button to set a keyframe at the current time.
5. Use the **Enable** / **Disable** buttons to toggle expressions.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
