# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

webOS MeTube client app for legacy Palm/HP webOS devices (Pre, Pre2, Pre3, Veer, TouchPad). Communicates with a PHP service wrapper (metube-php-servicewrapper) to search YouTube, download/convert videos, and stream content on devices that can't access YouTube directly.

## Critical Constraints

**DO NOT USE MODERN JAVASCRIPT OR CSS:**
- No ES6+ features: no `let`, `const`, arrow functions, template literals, destructuring, classes, promises, async/await
- Use `var` for all variable declarations
- Use `function` declarations and prototype-based inheritance
- Use `.bind(this)` for callback context preservation
- Use XMLHttpRequest, not fetch
- No modern CSS (flexbox, grid, CSS variables)

This is a Mojo framework app for webOS 1.x-3.x devices from 2009-2011.

## Architecture

### Mojo Framework Patterns

**Scene/Assistant Pattern:**
- Each screen is a "scene" with an "assistant" controller
- Assistants extend prototypes: `MainAssistant.prototype.methodName = function() {...}`
- Lifecycle: `setup()` → `activate()` → `deactivate()` → `cleanup()`

**Model Pattern:**
- Global model instances created in `app-assistant.js`
- Constructor functions: `var MetubeModel = function() {...}`
- Methods on prototype: `MetubeModel.prototype.doRequest = function() {...}`

**Widget Pattern:**
- Widgets initialized via `this.controller.setupWidget(id, attributes, model)`
- UI updates via `this.controller.modelChanged(model)`

### Key Files

| File | Purpose |
|------|---------|
| `app/assistants/main-assistant.js` | Main scene - search, download flow, polling, playback |
| `app/assistants/preferences-assistant.js` | Settings screen |
| `app/models/metube-model.js` | HTTP requests to PHP backend |
| `app/models/app-model.js` | Settings persistence |
| `app/views/main/main-scene.html` | Main UI layout |
| `app-keys-sample.js` | Configuration template (copy to app-keys.js) |

### HTTP Communication

All requests go through `metube-model.js`:
- `DoMeTubeSearchRequest(query, maxResults, callback)` - YouTube search
- `DoMeTubeAddRequest(url, quality, convert, callback)` - Request video download
- `DoMeTubeListRequest(callback)` - Get available files
- `DoMeTubeStatusRequest(jobId, target, callback)` - Get job progress (new)
- `DoMeTubeDetailsRequest(videoId, callback)` - Get video metadata
- `BuildMeTubePlaybackRequest(videoURL)` - Build play URL with auth

### Request Encoding

Requests use obfuscation (not real security):
1. Base64 encode payload
2. Insert `server_id` at random position
3. Server removes `server_id` and decodes

```javascript
MetubeModel.prototype.encodeRequest = function(request) {
    request = btoa(request);
    var randPos = Math.random() * (request.length - 1);
    var str1 = request.substring(0, randPos);
    var str2 = request.substring(randPos);
    return str1 + this.getCurrentServerKey() + str2;
}
```

## Download Flow

### Enhanced Flow (with progress tracking)
1. User enters URL or selects search result
2. `findOrRequestVideo()` gets current file list for comparison
3. `addFile()` POSTs to server, receives `target` and `job_id`
4. If `job_id` present, polls `status.php` via `checkJobStatus()` every 2 seconds
5. UI shows: "Queued..." → "Downloading: 45%" → "Converting: 67%" → plays video
6. Falls back to `checkForNewFiles()` (list polling) if server doesn't support status.php

### Legacy Flow (backward compatible)
1. Same steps 1-3
2. Polls `list.php` via `checkForNewFiles()` every 2 seconds
3. Compares file list to find new file
4. Plays when target file appears

### Key Properties in main-assistant.js
```javascript
this.FileCheckInt        // Polling interval handle
this.FileList            // Snapshot of files before request
this.FileToFind          // Target filename from server
this.CurrentJobId        // Job ID for status tracking (new)
this.UseStatusPolling    // Whether to use status.php (new)
this.VideoRequests       // History for deduplication
this.RequestConvert      // Whether conversion was requested
this.DownloadFirst       // Download-then-play vs streaming strategy
```

## UI Patterns

### Status Display
```javascript
this.disableUI(statusText);  // Shows spinner + status text
this.enableUI();             // Hides spinner, re-enables button
```

Status div in HTML:
```html
<div id="divWorkingStatus">
    <div id="divStatusValue"></div>  <!-- Status text goes here -->
</div>
```

### Device Detection
```javascript
if (Mojo.Environment.DeviceInfo.platformVersionMajor >= 3) {
    this.DeviceType = "TouchPad";  // HD capable
} else if (window.screen.width == 800) {
    this.DeviceType = "Pre3";      // Medium resolution
} else {
    this.DeviceType = "Pre";       // Lower resolution, download-first
}
```

## Configuration

Copy `app-keys-sample.js` to `app-keys.js`:
```javascript
var appKeys = {
    'serverId': 'BASE64_ENCODED_SERVER_KEY',
    'clientKey': 'BASE64_ENCODED_CLIENT_KEY',
    // ...
};
```

User preferences stored via `appModel.AppSettingsCurrent`:
- `HDQuality` - "bestvideo" or "worstvideo"
- `PlaybackStrategy` - "stream" or "download"
- `TimeoutMax` - Max polling attempts before timeout
- `UseCustomEndpoint` / `EndpointURL` - Custom server

## Debugging

### Logging
```javascript
Mojo.Log.info("Info message");
Mojo.Log.warn("Warning message");
Mojo.Log.error("Error message");
```

View logs: In webOS emulator or device, use `palm-log` command or novacom.

### Common Issues

**Status not showing progress**: Server may not support `status.php`. Client falls back to list polling automatically.

**Timeout errors**: Increase `TimeoutMax` in preferences, or video may be too long.

**"Back-end outdated" banner**: Server didn't return `target` field. Very old server version.

**Playback fails on Pre/Pre2**: Try enabling "Convert First" in menu, or use "download" playback strategy.

### Key Debug Points in main-assistant.js
- Line ~670: `addFile()` - Check server response, job_id
- Line ~784: `checkJobStatus()` - Status polling logic
- Line ~723: `checkForNewFiles()` - Legacy list polling
- Line ~866: `formatStatusText()` - Status display formatting

### Test Status Polling
To verify status polling works:
1. Start a video download
2. Check Mojo.Log for "Checking job status for job_xxx"
3. UI should show "Downloading: X%" updates
4. If you see "Status endpoint not available", server doesn't support it (falls back to list polling)
