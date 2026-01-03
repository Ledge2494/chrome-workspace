# Brave Workspace Manager (Sidebar)

## Table of Contents

- [Intro](#intro)
- [Description](#description)
  - [Features](#features)
  - [Usage](#usage)
  - [Notes & limitations](#notes)
  - [Security](#security)
- [Installation](#installation)
  - [Setup Browser](#browser)
  - [Setup Project](#setup)
- [Dev Recommendations](#recommends)
- [RoadMap](#roadmap)
- [Credits](#credits)

## Intro <a name="intro"></a>

This Brave/Chromium extension saves and restores tab "workspaces" (all open windows & tabs, with tab groups preserved) using the browser sidebar.

## Description <a name="descripiton"></a>

### Features <a name="features"></a>

- Save current session as a workspace
- Switch workspaces (saves current, closes current tabs, and restores target workspace)
- Preserve tab groups where possible
- Export/import workspaces as JSON

### Usage <a name="usage"></a>

- Open the Brave sidebar (if hidden, enable in Brave settings) and click the extension icon.
- Use "Save current" to store the current session.
- Click "Switch" on a workspace to save+close the current session and restore the chosen workspace.
- Use Export/Import for backup/restore.

### Notes & limitations <a name="notes"></a>

- Restoring attempts to recreate windows and tab groups in the saved order; some tab group metadata may not be identical across browser versions.
- Switching closes all current tabs before restoring the target workspace. Unsaved work in tabs will be lost—save any forms before switching.

### Security <a name="security"></a>

- The extension uses chrome.storage.local to store workspaces on the local machine only.
- This extension is mainly vibe-coded for learning purposes

## Installation <a name="installation"></a>

### Setup Browser <a name="brower"></a>

Install locally

1. Open Brave -> Extensions -> Manage extensions.
2. Enable "Developer mode".
3. Click "Load unpacked" and select this repository folder.

### Setup Project <a name="setup"></a>

3. Run `pnpm i`, `yarn` or `npm i` (check your node version >= 16)
4. Run `pnpm dev`, `yarn dev` or `npm run dev` to watch files and rebuild with any changes
5. Load Extension on Chrome
   1. Open - Chrome browser
   2. Access - chrome://extensions
   3. Check - Developer mode
   4. Find - Load unpacked extension
   5. Select - `dist` folder in this project (after dev or build)
6. If you want to build without watching, run `pnpm build`, `yarn build` or `npm run build`.

## Dev Recommendations <a name="recommends"></a>

VSCode Extensions

- [vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [vscode-tailwindcss](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
- [vscode-coverage-gutters](https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters)
- [vscode-jest](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest)
- [vscode-jest-runner](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner)

## Roadmap <a name="roadmap"></a>

I still have some other feature I want to see in this extension:

- [ ] Reorder the workspaces in the popup
- [ ] Enable to send tabs (and groups) into another workspace (e.g right click on tab -> Move to -> Work)
- [ ] Multiple Window management
- [ ] Add custom sidebar (not sure if possible)
- [ ] Add sidebar entry for brave native sidebar
- [ ] Edit Workspace (icon and name)

## Credits <a name="credits"></a>

- [Template](https://github.com/fell-lucas/chrome-extension-template-preact-vite) by [Lucas Fell](https://github.com/fell-lucas)
