/*
    MeTube helper app for webOS.
    This app depends on a MeTube service with an exposed download directory, and a Google API key for YouTube
    All of the above are provided by webOS Archive at no cost for what remains of the webOS mobile community.
*/

function MainAssistant() {
    /* this is the creator function for your scene assistant object. It will be passed all the 
       additional parameters (after the scene name) that were passed to pushScene. The reference
       to the scene controller (this.controller) has not be established yet, so any initialization
       that needs the scene controller should be done in the setup function below. */
}

MainAssistant.prototype.setup = function() {

    this.ServerCleanupTime = 900000; //This value should match the server's cronjob schedule
    /* This value will is the total number of milliseconds the client will wait for the server to finish preparing a video.
       Changing this value on the server allows longer videos, but increases the load on the server, and may have bad interactions with the clean-up time */
    this.FileCheckInt;
    this.SearchValue = "";
    this.DownloadFirst = false;
    this.FileList = [];
    this.VideoRequests = []; //Keep a history of requests, to help resolve race conditions on the server.
    //TODO: We could be even more resilient if we saved this in a preference.

    //New Search box
    this.controller.setupWidget('txtSearch',
        this.attributes = {
            hintText: 'Search or enter a URL...',
            multiline: false,
            autoFocus: true,
            changeOnKeyPress: true,
            focusMode: Mojo.Widget.focusSelectMode
        },
        this.model = {
            value: '',
            disabled: false
        }
    );
    //Submit button - with global members for easy toggling later
    this.submitBtnAttrs = {};
    this.submitBtnModel = {
        label: "Popular",
        disabled: false
    };
    this.controller.setupWidget("btnGetVideo", this.submitBtnAttrs, this.submitBtnModel);
    //Loading spinner - with global members for easy toggling later
    this.spinnerAttrs = {
        spinnerSize: Mojo.Widget.spinnerLarge
    };
    this.spinnerModel = {
        spinning: false
    }
    this.controller.setupWidget('workingSpinner', this.spinnerAttrs, this.spinnerModel);
    //Search Results List (starts empty)
    this.emptyResults = [
        { youtubeId: "-1", videoName: "Empty", thumbnail: "", selectedState: true }
    ]
    this.resultsListElement = this.controller.get('searchResultsList');
    this.resultsInfoModel = {
        items: this.emptyResults
    };
    //Search Result List templates (loads other HTML)
    this.template = {
        itemTemplate: 'main/item-template',
        listTemplate: 'main/list-template',
        swipeToDelete: false,
        renderLimit: 25,
        reorderable: false
    };
    this.controller.setupWidget('searchResultsList', this.template, this.resultsInfoModel);
    //Menu
    this.appMenuAttributes = { omitDefaultItems: true };
    this.appMenuModel = {
        label: "Settings",
        items: [
            Mojo.Menu.editItem,
            { label: "Preferences", command: 'do-Preferences' },
            { label: "About", command: 'do-myAbout' }
        ]
    };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttributes, this.appMenuModel);

    /* Always on Event handlers */
    Mojo.Event.listen(this.controller.get("txtSearch"), Mojo.Event.propertyChange, this.handleTextInput.bind(this));
    Mojo.Event.listen(this.controller.get("btnGetVideo"), Mojo.Event.tap, this.handleClick.bind(this));
    Mojo.Event.listen(this.controller.get("searchResultsList"), Mojo.Event.listTap, this.handleListClick.bind(this));
    Mojo.Event.listen(this.controller.stageController.document, Mojo.Event.stageActivate, this.activateWindow.bind(this));

    // Non-Mojo widgets
    this.keyupHandler = this.handleKeyUp.bindAsEventListener(this);
    this.controller.document.addEventListener("keyup", this.keyupHandler, true);
    $("btnClear").addEventListener("click", this.handleClearTap.bind(this));

    //Check for updates
    if (!appModel.UpdateCheckDone) {
        appModel.UpdateCheckDone = true;
        updaterModel.CheckForUpdate("MeTube", this.handleUpdateResponse.bind(this));
    }
};

MainAssistant.prototype.handleUpdateResponse = function(responseObj) {
    if (responseObj && responseObj.updateFound) {
        updaterModel.PromptUserForUpdate(function(response) {
            if (response)
                updaterModel.InstallUpdate();
        }.bind(this));
    }
}

MainAssistant.prototype.activate = function(event) {
    document.body.style.backgroundColor = "#313131";
    //Load preferences
    appModel.LoadSettings();
    Mojo.Log.info("settings now: " + JSON.stringify(appModel.AppSettingsCurrent));
    metubeModel.UseCustomGoogleAPIKey = appModel.AppSettingsCurrent["UseGoogleAPIKey"];
    metubeModel.CustomGoogleAPIKey = appModel.AppSettingsCurrent["GoogleAPIKey"];
    metubeModel.UseCustomClientAPIKey = appModel.AppSettingsCurrent["UseClientAPIKey"];
    metubeModel.CustomClientAPIKey = appModel.AppSettingsCurrent["ClientAPIKey"];
    metubeModel.UseCustomServerKey = appModel.AppSettingsCurrent["UseServerKey"];
    metubeModel.CustomServerKey = appModel.AppSettingsCurrent["ServerKey"];
    metubeModel.UseCustomEndpoint = appModel.AppSettingsCurrent["UseCustomEndpoint"];
    metubeModel.CustomEndpointURL = appModel.AppSettingsCurrent["EndpointURL"];
    if (appModel.AppSettingsCurrent["FirstRun"]) {
        appModel.AppSettingsCurrent["FirstRun"] = false;
        appModel.SaveSettings();
        Mojo.Additions.ShowDialogBox("Welcome to MeTube!", "webOS MeTube is a client for a MeTube service running on a remote server. You can use the community server for free, but be aware there is no expectation of performance or privacy. You can also use your own server if you want. If you experience crashes, try changing the playback strategy in Preferences (not available on webOS 1.x). Enjoy!")
    }

    //find out what kind of device this is
    if (Mojo.Environment.DeviceInfo.platformVersionMajor >= 3) {
        this.DeviceType = "TouchPad";
        Mojo.Log.info("Device detected as TouchPad");
        if (!appModel.AppSettingsCurrent["HDQuality"])
            appModel.AppSettingsCurrent["HDQuality"] = "bestvideo";
    } else {
        if (window.screen.width == 800 || window.screen.height == 800) {
            this.DeviceType = "Pre3";
            Mojo.Log.info("Device detected as Pre3");
        } else if ((window.screen.width == 480 || window.screen.height == 480) && (window.screen.width == 320 || window.screen.height == 320)) {
            this.DeviceType = "Pre";
            Mojo.Log.warn("Device detected as Pre or Pre2");
        } else {
            this.DeviceType = "Tiny";
            Mojo.Log.warn("Device detected as Pixi or Veer");
        }
        if (!appModel.AppSettingsCurrent["HDQuality"])
            appModel.AppSettingsCurrent["HDQuality"] = "worstvideo";
    }
    //figure out how to play
    this.DownloadFirst = false;
    if (Mojo.Environment.DeviceInfo.platformVersionMajor < 2 || appModel.AppSettingsCurrent["PlaybackStrategy"] == "download") {
        this.DownloadFirst = true;
    }
};

MainAssistant.prototype.activateWindow = function(event) { //This is needed for handling a re-launch with parameters
    Mojo.Log.info("Stage re-activated!");
    this.handleLaunchQuery();
};

MainAssistant.prototype.handleLaunchQuery = function() {
    //handle launch with search query
    if (appModel.LaunchQuery != "") {
        Mojo.Log.info("using launch query: " + appModel.LaunchQuery);
        $("txtSearch").mojo.setValue(appModel.LaunchQuery);
        Mojo.Log.info("set textbox to: " + appModel.LaunchQuery);
        this.handleTextInput(null, appModel.LaunchQuery);
        this.handleClick();
        appModel.LaunchQuery = "";
    }
}

//Handle menu and button bar commands
MainAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
        switch (event.command) {
            case 'do-Preferences':
                var stageController = Mojo.Controller.stageController;
                stageController.pushScene({ name: "preferences", disableSceneScroller: false });
                break;
            case 'do-myAbout':
                Mojo.Additions.ShowDialogBox("MeTube - " + Mojo.Controller.appInfo.version, "MeTube client for webOS. Copyright 2021, Jon Wise. Thanks to Nomad84 and MrHall17 for beta testing. Distributed under an MIT License.<br>Source code available at: https://github.com/codepoet80/webos-metube");
                break;
        }
    }
};

//Handles the enter key
MainAssistant.prototype.handleKeyUp = function(event) {
    Mojo.Log.info("Enter key was pressed!");
    if (event && Mojo.Char.isEnterKey(event.keyCode)) {
        if (event.srcElement.parentElement.id == "txtSearch") {
            this.handleClick(event);
        }
    }
};

MainAssistant.prototype.handleTextInput = function(event, actualText) {
    var submitBtnSetup = this.controller.getWidgetSetup("btnGetVideo");
    var useVal = "";
    if (event && event.value)
        useVal = event.value;
    if (!useVal) {
        useVal = $("txtSearch").mojo.getValue();
    }
    Mojo.Log.info("text box is: " + useVal);
    if (actualText)
        useVal = actualText;
    Mojo.Log.info("handling text input of: " + useVal);
    if (useVal == "") {
        if (submitBtnSetup.model.label != "Popular") {
            submitBtnSetup.model.label = "Popular";
            this.controller.modelChanged(submitBtnSetup.model);
        }
    } else if (useVal.indexOf("://") != -1) {
        if (submitBtnSetup.model.label != "Play") {
            submitBtnSetup.model.label = "Play";
            this.controller.modelChanged(submitBtnSetup.model);
        }
    } else {
        if (submitBtnSetup.model.label != "Search") {
            submitBtnSetup.model.label = "Search";
            this.controller.modelChanged(submitBtnSetup.model);
        }
    }
}

MainAssistant.prototype.handleTextPaste = function(event) {
    Mojo.Log.info("Handling pasted value: " + event.clipboardData.getData('Text'));
    this.handleTextInput(event, event.clipboardData.getData('Text'));
}

//Handle mojo button taps
MainAssistant.prototype.handleClick = function(event) {

    this.disableUI();

    //figure out what was requested
    var stageController = Mojo.Controller.getAppController().getActiveStageController();
    if (stageController) {
        this.controller = stageController.activeScene();
        var videoRequest = $("txtSearch").mojo.getValue();
        Mojo.Log.info("search text was: " + videoRequest);

        videoRequest = this.checkForSpecialCases(videoRequest);

        //If this is a URL
        if (videoRequest.toLowerCase().indexOf("youtube.com") != -1 || videoRequest.toLowerCase().indexOf("youtu.be") != -1 || videoRequest.toLowerCase().indexOf("reddit.com") != -1 || videoRequest.toLowerCase().indexOf("v.redd.it") != -1) {
            if (videoRequest.toLowerCase().indexOf("v.redd.it") != -1) {
                videoRequest = videoRequest.replace("v.redd.it/", "www.reddit.com/video/");
            }
            this.findOrRequestVideo(videoRequest);
        }
        //Otherwise it must be a search query
        else {
            //Hide List so spinner can show
            $("showResultsList").style.display = "none";

            if (!videoRequest || videoRequest == "")
                this.searchYouTube("");
            else
                this.searchYouTube(videoRequest);
        }
    }
}

//Handle non-mojo button taps
this.cancelDownload = false;
MainAssistant.prototype.handleClearTap = function() {

    //Tell any downloads to cancel
    this.cancelDownload = true;

    //Reset the text box
    $("txtSearch").mojo.setValue("");
    var submitBtnSetup = this.controller.getWidgetSetup("btnGetVideo");
    submitBtnSetup.model.label = "Popular";
    this.controller.modelChanged(submitBtnSetup.model);

    //Uncheck all items in list
    var listWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    for (var i = 0; i < listWidgetSetup.model.items.length; i++) {
        listWidgetSetup.model.items[i].selectedState = false;
    }
    //Hide List
    $("showResultsList").style.display = "none";

    this.enableUI();
    setTimeout("$('txtSearch').mojo.focus();", 100);

    //TODO: maybe we should try to cancel any launches or downloads too

    //Abandon any active queries
    clearInterval(this.FileCheckInt);
}

//Handle list item taps
MainAssistant.prototype.handleListClick = function(event) {
    //Mojo.Log.info("Item tapped with element class " + event.originalEvent.target.className + ": " + event.item.videoName + ", id: " + event.item.youtubeId + ", selected state: " + event.item.selectedState);
    this.LastTappedVideoTitle = event.item.videoName;

    var listWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    if (event.item.selectedState) { //if items is selected and has been tapped
        if (event.originalEvent.target.className == "checkmark true") { //if the tap was on the checkmark, uncheck it
            Mojo.Log.info("uncheck item!");
            event.item.selectedState = false;
            $("txtSearch").mojo.setValue(this.SearchValue);
            this.handleTextInput(event, this.SearchValue);
        } else { //otherwise, treat as a second tap and go to top
            this.scrollToTop();
        }
    } else { //item is unselected has been tapped
        for (var i = 0; i < listWidgetSetup.model.items.length; i++) {
            listWidgetSetup.model.items[i].selectedState = false;
        }
        event.item.selectedState = true;
        var videoVal = "https://www.youtube.com/watch?v=" + event.item.youtubeId;
        if (event.item.videoDetails.indexOf(" -") == -1 && event.item.videoDetails.indexOf(" ("))
            this.updateVideoDetails(event.item, event.item.youtubeId)
        $("txtSearch").mojo.setValue(videoVal);
        this.handleTextInput(event, videoVal);
    }
    //Update UI
    this.controller.modelChanged(listWidgetSetup.model);
    return false;
}

/* UI Functions */

MainAssistant.prototype.scrollToTop = function() {
    Mojo.Log.info("scrolling to top!");
    this.controller.getSceneScroller().mojo.scrollTo(0, 0, true);
}

MainAssistant.prototype.disableUI = function(statusValue) {
    //start spinner (if not already spinning)
    if (this.spinnerModel && !this.spinnerModel.spinning) {
        this.spinnerModel.spinning = true;
        this.controller.modelChanged(this.spinnerModel);
    }

    if (statusValue && statusValue != "") {
        $("divWorkingStatus").style.display = "block";
        $("divStatusValue").innerHTML = statusValue;
    } else {
        $("divWorkingStatus").style.display = "none";
    }

    //disable submit button
    if (!this.submitBtnModel.disabled) {
        this.submitBtnModel.disabled = true;
        this.controller.modelChanged(this.submitBtnModel);
    }
}

MainAssistant.prototype.enableUI = function() {
    //stop spinner
    if (this.spinnerModel) {
        this.spinnerModel.spinning = false;
        this.controller.modelChanged(this.spinnerModel);
    }

    //hide status
    $("divWorkingStatus").style.display = "none";
    $("divStatusValue").innerHTML = "";

    //enable submit button
    this.submitBtnModel.disabled = false;
    this.controller.modelChanged(this.submitBtnModel);
}

/* Service Calls and Binding */

//Depending on history, either get previously accessed video, or request a new one from the service
MainAssistant.prototype.findOrRequestVideo = function(videoRequest) {
    Mojo.Log.info("Direct video requested: " + videoRequest);
    $("showResultsList").style.display = "none";

    var historyPath = false;
    for (var i = 0; i < this.VideoRequests.length; i++) {
        var histRequest = this.VideoRequests[i];
        var currRequestTime = new Date().getTime();
        //If this video is already in the history, and its not too old, just play that
        if (histRequest.videoRequest == videoRequest && ((currRequestTime - histRequest.requestTime) < this.ServerCleanupTime)) {
            /*  Note: there is the possibility of a race condition where the server may clean up this file
                while it is in use during a repeat playback. You can mitigate by changing the server clean-up time
                (both here and on the server) but be aware that doing so increases the odds of user race conditions (see below)   */
            Mojo.Log.warn("This video has been requested in the recent past; using path from previous request.");
            historyPath = this.VideoRequests[i].videoPath;
        }
    }
    if (!historyPath) {
        //Ask server for existing file list so we can determine when a new file is ready
        metubeModel.DoMeTubeListRequest(function(response) {
            //Mojo.Log.info("Server file list now: " + response);
            /* Note: This house-of-cards depends on each request from all users creating a new file on the server
                which this client will find by comparing the file list before its request, to the file list after
                their request. An aggressive clean-up time on the server decreases the odds that two users will
                have query overlap, causing one to deny service to the other -- but carries the risk that a video
                will be cleaned-up while the video is in use. This is an unfortunate side-effect of the server knowing
                nothing about users, or even having any state stored between requests and results. We will attempt to
                further mitigate by storing some state in the client-side.
            */
            if (response != null && response != "") {
                this.FileList = JSON.parse(response);

                //Update the video request history (store state in the client-side)
                var requestTime = new Date().getTime();
                this.VideoRequests.push({ "videoRequest": videoRequest, "requestTime": requestTime });

                //Ask server for a new file
                this.addFile(videoRequest);
            } else {
                Mojo.Log.error("No usable response from server while sending list request: " + response);
                Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response to the list request. Check network connectivity and/or self-host settings.");
            }
        }.bind(this));
    } else {
        //Play the video
        Mojo.Log.info("About to play video from historical path: " + historyPath);
        this.playPreparedVideo(historyPath, true);
    }
}

//Send a search request to MeTube to send to Google for us (never worry about HTTPS encryption again)
MainAssistant.prototype.searchYouTube = function(videoRequest) {
    Mojo.Log.info("Search requested: " + videoRequest)
    this.SearchValue = videoRequest;
    metubeModel.DoMeTubeSearchRequest(videoRequest, appModel.AppSettingsCurrent["SearchResultMax"], function(response) {
        //Mojo.Log.info("ready to process search results: " + response);
        if (response != null && response != "") {
            var responseObj = JSON.parse(response);
            if (responseObj.status == "error") {
                Mojo.Log.error("Error message from server while searching YouTube: " + responseObj.msg);
                Mojo.Additions.ShowDialogBox("Server Error", "The server responded to the search request with: " + responseObj.msg.replace("ERROR: ", ""));
            } else {
                if (responseObj.items && responseObj.items.length > 0) {
                    //If we got a good looking response, update the UI
                    this.updateSearchResultsList(responseObj.items);
                } else {
                    Mojo.Log.warn("Search results were empty. This is unlikely; server, API or connectivity problem possible");
                    Mojo.Additions.ShowDialogBox("No results", "The server did not report any matches for the search.");
                }
            }
        } else {
            Mojo.Log.error("No usable response from server while searching YouTube: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response to the search request. Check network connectivity and/or self-host settings.");
        }

        this.enableUI();
    }.bind(this));
}

//Update the UI with search results from Search Request
MainAssistant.prototype.updateSearchResultsList = function(results) {
    Mojo.Log.info("Result body: " + JSON.stringify(results));
    var thisWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    thisWidgetSetup.model.items = []; //remove the previous list
    for (var i = 0; i < results.length; i++) {
        var newItem = {
            youtubeId: results[i].id.videoId,
            videoName: this.decodeEntities(results[i].snippet.title),
            videoDetails: this.convertTimeStamp(results[i].snippet.publishedAt, true),
            selectedState: false
        }
        if (this.DeviceType == "TouchPad") {
            newItem.detailClass = "touchpad";
            newItem.imageWidth = "178px";
            newItem.titleMargin = "182px";
            newItem.topMargin = "4px";
            newItem.thumbnail = results[i].snippet.thumbnails["medium"].url;
        } else {
            newItem.videoName = this.cleanupString(newItem.videoName, 32);
            newItem.topMargin = "-8px";
            if (this.DeviceType == "Pre3") {
                newItem.imageWidth = "120px";
                newItem.titleMargin = "115px";
                newItem.thumbnail = results[i].snippet.thumbnails["default"].url;
            } else if (this.DeviceType == "Tiny") {
                newItem.videoName = this.cleanupString(newItem.videoName, 38);
                newItem.imageWidth = "120px";
                newItem.titleMargin = "116px";
                newItem.thumbnail = results[i].snippet.thumbnails["default"].url;
            } else {
                newItem.imageWidth = "100px";
                newItem.titleMargin = "95px";
                newItem.thumbnail = results[i].snippet.thumbnails["default"].url;
            }
        }
        thisWidgetSetup.model.items.push(newItem);
    }
    Mojo.Log.info("Updating search results widget with " + results.length + " results!");
    $("showResultsList").style.display = "block";
    this.controller.modelChanged(thisWidgetSetup.model);
}

//Ask for more details about a video
MainAssistant.prototype.updateVideoDetails = function(item, videoId) {
    this.itemToUpdate = item;
    metubeModel.DoMeTubeDetailsRequest(videoId, function(response) {
        if (response) {
            var responseObj = JSON.parse(response);
            if (responseObj.status && responseObj.status == "error") {
                Mojo.Log.error("Error message from server while getting video details: " + responseObj.msg);
            } else {
                if (responseObj.items && responseObj.items[0] != null && responseObj.items[0].contentDetails != null) {
                    var newDetails = item.videoDetails;
                    if (responseObj.items[0].contentDetails.duration != null)
                        newDetails += " - " + this.convertDuration(responseObj.items[0].contentDetails.duration);
                    if (responseObj.items[0].contentDetails.definition != null)
                        newDetails += " (" + responseObj.items[0].contentDetails.definition.toUpperCase() + ")";
                    this.LastTappedVideoResolution = responseObj.items[0].contentDetails.definition.toUpperCase();
                    item.videoDetails = newDetails;
                    var listWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
                    this.controller.modelChanged(listWidgetSetup.model);
                } else {
                    Mojo.Log.warn("Details response was missing expected content. This may indicate the YouTube APIs have changed.");
                }
            }
        } else {
            Mojo.Log.error("No usable response from server while getting video details.");
        }
    }.bind(this));
}

//Compare the list of files we know about with the files the server has to see what's new
MainAssistant.prototype.checkForNewFiles = function() {
    Mojo.Log.info("Checking for new files...");
    metubeModel.DoMeTubeListRequest(function(response) {
        if (response && response != "") {
            var responseObj = JSON.parse(response);
            if (responseObj.status == "error") {
                clearInterval(this.FileCheckInt);
                Mojo.Log.error("Error message from server while checking for new files: " + responseObj.msg);
                Mojo.Additions.ShowDialogBox("Server Error", "The server responded to the check file request with: " + responseObj.msg.replace("ERROR: ", ""));
            } else {
                checkList = responseObj;
                if (this.timeOutCount <= appModel.AppSettingsCurrent["TimeoutMax"]) {
                    if (checkList.files && checkList.files.length > this.FileList.files.length) {
                        Mojo.Log.info("A new file has appeared on the server!");
                        clearInterval(this.FileCheckInt);
                        var videoPath = this.findNewFile(checkList);
                        if (videoPath != null && videoPath != "") {
                            //Calculate full URL
                            if (videoPath.indexOf("|") != -1) {
                                //TODO: DEVELOPER MODE
                                videoPath = videoPath.split("|");
                                videoPath = videoPath[0];
                            }

                            //Update video request history (we're forced to assume this result is for the most recent request)
                            updateVideoRequest = this.VideoRequests[this.VideoRequests.length - 1];
                            updateVideoRequest.videoPath = videoPath;
                            this.VideoRequests[this.VideoRequests.length - 1] = updateVideoRequest;

                            //Play the video
                            this.playPreparedVideo(videoPath, true);
                        } else {
                            Mojo.Log.error("Unable to find a video file to play!");
                            clearInterval(this.FileCheckInt);
                            this.enableUI();
                        }
                    }
                    this.timeOutCount++;
                } else {
                    Mojo.Log.warn("No new file found on server before timeout. Giving up now!");
                    Mojo.Additions.ShowDialogBox("Timeout Exceeded", "The video file couldn't be found on server before timeout.<br>The video may be too long to process in time, or its possible the server just needs to do some clean-up. Wait a few minutes and retry, or try a new request.");
                    clearInterval(this.FileCheckInt);

                    this.enableUI();
                }
            }
        } else {
            Mojo.Log.error("No usable response from server while checking for new files: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response to the check file request. Check network connectivity and/or self-host settings.");
            clearInterval(this.FileCheckInt);

            this.enableUI();
        }
    }.bind(this));
}

//Identify which is the new file
MainAssistant.prototype.findNewFile = function(checkList) {
    //Mojo.Log.info("searching checkList for new files: " + JSON.stringify(checkList));
    var knownFiles = [];
    //Load our saved file list into an array for easy comparison
    for (var j = 0; j < this.FileList.files.length; j++) {
        knownFiles.push(metubeModel.decodeResponse(this.FileList.files[j].file));
    }
    // Check each file in response against known file list
    for (var i = 0; i < checkList.files.length; i++) {
        var checkFile = metubeModel.decodeResponse(checkList.files[i].file);
        if (knownFiles.indexOf(checkFile) == -1) {
            Mojo.Log.info("New file found is: " + checkFile);
            return checkFile;
        }
    }
}

//Ask MeTube to prepare a new video file for us
MainAssistant.prototype.addFile = function(theFile) {
    //Mojo.Log.info("Time to submit a file request: " + theFile);
    var quality = "bestvideo";
    if (appModel.AppSettingsCurrent["HDQuality"] != "bestvideo" && this.LastTappedVideoResolution == "HD")
        quality = appModel.AppSettingsCurrent["HDQuality"];

    Mojo.Log.info("QUALITY: " + quality + ", stored: " + appModel.AppSettingsCurrent["HDQuality"]);
    metubeModel.DoMeTubeAddRequest(theFile, quality, function(response) {
        Mojo.Log.info("add response: " + response);
        if (response && response != "" && response.indexOf("status") != -1) {
            var responseObj = JSON.parse(response);
            if (responseObj.status == "ok") {
                this.timeOutCount = 0;
                //Start checking for new files on server
                this.FileCheckInt = setInterval(this.checkForNewFiles.bind(this), 2000);
            } else {
                this.enableUI();

                Mojo.Log.error("Server Error while adding new file request" + responseObj.msg);
                Mojo.Additions.ShowDialogBox("Server Error", "The server responded to the add file request with: " + responseObj.msg.replace("ERROR: ", ""));
            }
        } else {
            this.enableUI();

            Mojo.Log.error("No usable response from server while adding new file request: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer the add file request with a usable response. Check network connectivity and/or self-host settings.");
        }
    }.bind(this));
}

//Figure out how to play the video we requested 
MainAssistant.prototype.playPreparedVideo = function(videoURL) {
    if (this.DownloadFirst) {
        Mojo.Log.info("Playing video with strategy: download first");
        this.downloadVideoFile(videoURL);
    } else {
        Mojo.Log.info("Playing video with strategy: direct stream");
        this.startVideoPlayer(videoURL, true);
    }
}

//Launch the webOS Video Player app with the video to play
MainAssistant.prototype.startVideoPlayer = function(videoURL, isStream) {
    if (isStream) //this is a streaming request
        videoURL = metubeModel.BuildMeTubePlaybackRequest(videoURL);
    //otherwise its a file path
    Mojo.Log.warn("Using video target: " + videoURL);
    useTitle = "YouTube Video";
    if (this.LastTappedVideoTitle)
        useTitle = this.LastTappedVideoTitle;
    else {
        if (isStream) {
            useTitle = this.makeFileNameFromDownloadURL(videoURL);
        }
    }
    Mojo.Log.info("Using video title: " + useTitle);
    this.LastTappedVideoTitle = null;

    //Ask webOS to launch the video player with the new url
    this.videoRequest = new Mojo.Service.Request("palm://com.palm.applicationManager", {
        method: "launch",
        parameters: {
            "id": "com.palm.app.videoplayer",
            "params": {
                "target": videoURL,
                "videoTitle": useTitle
            }
        },
        onSuccess: function(response) {
            Mojo.Log.info("Video player launch success", JSON.stringify(response));
            $("btnGetVideo").focus();
        }.bind(this),
        onFailure: function(response) {
            Mojo.Log.error("Video player launch Failure, " + videoURL + ":", JSON.stringify(response), response.errorText);
        }.bind(this)
    });
    this.enableUI();
    return true;
}

//Actually play the video we requested 
this.downloader = null;
MainAssistant.prototype.downloadVideoFile = function(videoURL) {

    //Clear out previous cancels
    this.cancelDownload = false;

    videoURL = metubeModel.BuildMeTubePlaybackRequest(videoURL);
    this.LastTappedVideoTitle = this.makeFileNameFromDownloadURL(videoURL);

    //Ask webOS to download the video from the URL
    this.downloader = this.controller.serviceRequest('palm://com.palm.downloadmanager/', {
        method: 'download',
        parameters: {
            target: encodeURI(videoURL),
            mime: "video/mp4",
            targetDir: "/media/internal/downloads/",
            targetFilename: ".metubevideo.mp4",
            keepFilenameOnRedirect: false,
            subscribe: true
        },
        onSuccess: function(response) {
            Mojo.Log.info("Video download success", JSON.stringify(response));
            if (response.completed && (response.completionStatusCode == 200 || response.amountReceived == response.amountTotal)) {
                $("txtSearch").mojo.focus();
                this.startVideoPlayer("/media/internal/downloads/.metubevideo.mp4", false);
            } else {
                if (this.cancelDownload) {
                    this.controller.serviceRequest('palm://com.palm.downloadmanager/', {
                        method: 'pauseDownload',
                        parameters: { "ticket": response.ticket },
                        onSuccess: function(e) { Mojo.Log.info("Cancelled download"); },
                        onFailure: function(e) { Mojo.Log.info("Cancelled download"); }
                    });
                    this.enableUI();
                } else {
                    var status = Math.round((response.amountReceived / response.amountTotal) * 100);
                    if (status >= 0)
                        this.disableUI(status + " %");
                    Mojo.Log.info("Download status: " + response.amountReceived + "/" + response.amountTotal);
                }
            }
        }.bind(this),
        onFailure: function(response) {
            Mojo.Log.error("Video download Failure, " + videoURL + ":", JSON.stringify(response), response.errorText);
            this.enableUI();
        }.bind(this)
    });
}

/* Lifecycle Stuff */

MainAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any other cleanup that should happen before
       this scene is popped or another scene is pushed on top */
    Mojo.Event.stopListening(this.controller.get("btnGetVideo"), Mojo.Event.tap, this.handleClick);
    Mojo.Event.stopListening(this.controller.get("searchResultsList"), Mojo.Event.listTap, this.handleListClick);
    // Non-Mojo widgets
    $("btnClear").removeEventListener("click", this.handleClearTap);
};

MainAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is destroyed as 
       a result of being popped off the scene stack */
};

/* Helper Functions */
MainAssistant.prototype.checkForSpecialCases = function(videoRequest) {
    //Test cases
    if (videoRequest.indexOf("!") != -1)
        videoRequest = videoRequest.replace(/!/g, "");
    if (videoRequest.toLowerCase() == "*test")
        videoRequest = "https://www.youtube.com/watch?v=UYPoMjR6-Ao";
    if (videoRequest.toLowerCase() == "*missing")
        videoRequest = "https://www.youtube.com/watch?v=IcrbM1L_BoI";
    return videoRequest;
}

MainAssistant.prototype.decodeEntities = function(text) {
    var entities = [
        ['amp', '&'],
        ['apos', '\''],
        ['#x27', '\''],
        ['#x2F', '/'],
        ['#39', '\''],
        ['#47', '/'],
        ['lt', '<'],
        ['gt', '>'],
        ['nbsp', ' '],
        ['quot', '"']
    ];
    for (var i = 0, max = entities.length; i < max; ++i)
        text = text.replace(new RegExp('&' + entities[i][0] + ';', 'g'), entities[i][1]);
    var emojis = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff]|[\u200d]|[\ufe0f])/g;
    text = text.replace(emojis, ""); //try to remove emojis
    return text;
}

MainAssistant.prototype.convertTimeStamp = function(timeStamp) {
    timeStamp = timeStamp.split("T");
    return timeStamp[0];
}

MainAssistant.prototype.convertDuration = function(duration) {
    duration = duration.replace("PT", "");
    duration = duration.replace("S", "");
    duration = duration.split("M");
    var seconds = duration[duration.length - 1];
    if (seconds < 10)
        seconds = "0" + seconds;
    duration[duration.length - 1] = seconds;
    return duration.join(":");
}

//Try to make strings easier on tiny devices
MainAssistant.prototype.cleanupString = function(str, mxsl) {
    str = str.substring(0, mxsl);
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/[^a-z0-9\s]/gi, '');
    return str;
}

MainAssistant.prototype.makeFileNameFromDownloadURL = function(videoURL) {
    var useTitle = videoURL.split("?video=");
    useTitle = useTitle[1];
    useTitle = useTitle.split("&requestid=");
    useTitle = useTitle[0];
    useTitle = useTitle.replace(".mp4", "");
    return useTitle;
}