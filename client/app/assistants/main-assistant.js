/*
    MeTube helper app for webOS.
    This app depends on a MeTube service, an exposed download directory, and a Google API key for YouTube
    All of the above are provided by webOS Archive at no cost for what remains of the webOS mobile community.
*/

Mojo.Additions = Additions;

function MainAssistant() {
    /* this is the creator function for your scene assistant object. It will be passed all the 
       additional parameters (after the scene name) that were passed to pushScene. The reference
       to the scene controller (this.controller) has not be established yet, so any initialization
       that needs the scene controller should be done in the setup function below. */
}

MainAssistant.prototype.setup = function() {

    this.ServiceURL = "http://metube.webosarchive.com:8081/add";
    this.PlaybackURLBase = "http://metube.webosarchive.com/play";
    this.SearchURLBase = "http://metube.webosarchive.com/search";
    this.ListURLBase = "http://metube.webosarchive.com/list";
    this.ServerCleanupTime = 900000; //This value should match the server's cronjob schedule
    /* This value will be multiplied by 2000 to determine total number of milliseconds the client will wait for the server to finish preparing a video.
       Changing this value allows longer videos, but increases the load on the server, and may have bad interactions with the clean-up time */
    this.TimeOutMax = 15; //TODO: If this becomes a user preferences, it should need exceed (or even approach) the ServerCleanupTime
    this.FileCheckInt;
    this.SearchValue = "";
    this.FileList = [];
    this.VideoRequests = []; //Keep a history of requests, to help resolve race conditions on the server.
    //TODO: We could be even more resilient if we saved this in a preference.

    //Get video button
    this.controller.setupWidget("btnGetVideo",
        this.attributes = {},
        this.model = {
            label: "Submit",
            disabled: false
        }
    );
    //Loading spinner
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
    this.lightListElement = this.controller.get('searchResultsList');
    this.lightInfoModel = {
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
    this.controller.setupWidget('searchResultsList', this.template, this.lightInfoModel);
    //Menu
    this.appMenuAttributes = { omitDefaultItems: false };
    this.appMenuModel = {
        label: "Settings",
        items: [
            { label: "About...", command: 'do-myAbout' }
        ]
    };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttributes, this.appMenuModel);

    //Check for updates
    updaterModel.CheckForUpdate("MeTube", this.handleUpdateResponse.bind(this));
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
    /* put in event handlers here that should only be in effect when this scene is active. For
       example, key handlers that are observing the document */
    Mojo.Event.listen(this.controller.get("btnGetVideo"), Mojo.Event.tap, this.handleClick.bind(this));
    Mojo.Event.listen(this.controller.get("searchResultsList"), Mojo.Event.listTap, this.handleListClick.bind(this));
    // Non-Mojo widgets
    $("btnClear").addEventListener("click", this.handleClearTap.bind(this));
    $("txtYoutubeURL").focus();
};

//Handle menu and button bar commands
MainAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
        switch (event.command) {
            case 'do-myAbout':
                Mojo.Additions.ShowDialogBox("MeTube - " + Mojo.Controller.appInfo.version, "MeTube (modified) client for webOS. Copyright 2021, Jonathan Wise. Distributed under an MIT License.<br>Client source code available at: https://github.com/codepoet80/webos-metube<br>Server source code: https://github.com/codepoet80/metube");
                break;
        }
    }
};

//Handle mojo button taps
MainAssistant.prototype.handleClick = function(event) {
    //start spinner
    this.spinnerModel.spinning = true;
    this.controller.modelChanged(this.spinnerModel);

    //figure out what was requested
    var stageController = Mojo.Controller.getAppController().getActiveStageController();
    if (stageController) {
        this.controller = stageController.activeScene();
        videoRequest = $("txtYoutubeURL").value;
        videoRequest = this.checkForSpecialCases(videoRequest);

        //If this is a URL
        if (videoRequest.indexOf("youtube.com") != -1) {
            this.findOrRequestVideo(videoRequest);
        }
        //Otherwise it must be a search query
        else {
            this.searchYouTube(videoRequest);
        }
    }
}

//Handle non-mojo button taps
MainAssistant.prototype.handleClearTap = function() {
    //Clear the text box
    $("txtYoutubeURL").value = "";

    //Uncheck all items in list
    var listWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    for (var i = 0; i < listWidgetSetup.model.items.length; i++) {
        listWidgetSetup.model.items[i].selectedState = false;
    }
    //Hide List
    $("showResultsList").style.display = "none";

    //Stop spinner
    this.spinnerModel.spinning = false;
    this.controller.modelChanged(this.spinnerModel);

    //Abandon any active queries
    clearInterval(this.FileCheckInt);

    $("txtYoutubeURL").focus();
}

//Handle list item taps
MainAssistant.prototype.handleListClick = function(event) {
    Mojo.Log.info("item tapped: " + event.item.videoName + ", id: " + event.item.youtubeId + ", selected state: " + event.item.selectedState);
    var listWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    if (event.item.selectedState) {
        event.item.selectedState = false;
        $("txtYoutubeURL").value = this.SearchValue;
    } else {
        for (var i = 0; i < listWidgetSetup.model.items.length; i++) {
            listWidgetSetup.model.items[i].selectedState = false;
        }
        event.item.selectedState = true;
        $("txtYoutubeURL").value = "https://www.youtube.com/watch?v=" + event.item.youtubeId;
    }
    //Update UI
    var listWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    this.controller.modelChanged(listWidgetSetup.model);
}

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
        this.getFileList(function(response) {
            Mojo.Log.info("Server file list now: " + response);
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
                this.requestFile(videoRequest);
            } else {
                Mojo.Log.error("No usable response from server: " + response);
                Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response. Check network connectivity.");
            }
        }.bind(this));
    } else {
        //Play the video
        Mojo.Log.info("About to play video from historical path: " + historyPath);
        this.playPreparedVideo(historyPath);
    }
}

//Gets a list of files the server has now
MainAssistant.prototype.getFileList = function(callback) {
    Mojo.Log.info("Getting file list: " + this.ListURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", this.ListURLBase);
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            //Mojo.Log.info("File server responded: " + xmlhttp.responseText);
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//Compare the list of files we know about with the files the server has to see what's new
MainAssistant.prototype.checkForNewFiles = function() {
    Mojo.Log.info("Checking for new files...");
    this.getFileList(function(response) {
        if (response && response != "") {
            var checkList = JSON.parse(response);
            if (this.timeOutCount <= this.TimeOutMax) {
                if (checkList.files.length > this.FileList.files.length && response.indexOf("mp4.part") == -1) {
                    Mojo.Log.info("a new file has appeared!");
                    clearInterval(this.FileCheckInt);
                    var videoPath = this.findNewFile(checkList);
                    if (videoPath != null && videoPath != "") {
                        //Calculate full URL
                        videoPath = this.PlaybackURLBase + "/" + videoPath;

                        //Update video request history (we're forced to assume this result is for the most recent request)
                        updateVideoRequest = this.VideoRequests[this.VideoRequests.length - 1];
                        updateVideoRequest.videoPath = videoPath;
                        this.VideoRequests[this.VideoRequests.length - 1] = updateVideoRequest;
                        //Mojo.Log.info("Request history: " + JSON.stringify(this.VideoRequests));

                        //Play the video
                        Mojo.Log.info("About to play video: " + videoPath);
                        this.playPreparedVideo(videoPath);
                    } else {
                        Mojo.Log.error("Unable to find a video file to play!");
                    }
                }
                this.timeOutCount++;
            } else {
                Mojo.Log.warn("No new file found on server before timeout. Giving up now!");
                Mojo.Additions.ShowDialogBox("Timeout Exceeded", "The video file couldn't be found on server before timeout.<br>The video may be too long to process in time, or its possible the server just needs to do some clean-up. Wait a few minutes and retry, or try a new request.");
                clearInterval(this.FileCheckInt);
            }
        } else {
            clearInterval(this.FileCheckInt);
            Mojo.Log.error("No usable response from server: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response. Check network connectivity.");
        }
        //stop spinner
        this.spinnerModel.spinning = false;
        this.controller.modelChanged(this.spinnerModel);
    }.bind(this));
}

//Identify which is the new file
MainAssistant.prototype.findNewFile = function(checkList) {
    Mojo.Log.info("searching checkList for new files: " + JSON.stringify(checkList));
    var knownFiles = [];
    for (var j = 0; j < this.FileList.files.length; j++) {
        knownFiles.push(this.FileList.files[j].file);
    }
    for (var i = 0; i < checkList.files.length; i++) {
        var checkFile = checkList.files[i].file;
        if (knownFiles.indexOf(checkFile) == -1) {
            Mojo.Log.info("file to play is: " + checkFile);
            return checkFile;
        }
    }
}

//Ask the server to prepare a new video file for us
MainAssistant.prototype.requestFile = function(theFile) {
    //Mojo.Log.info("Time to submit a file request: " + theFile);
    this.doMeTubeRequest(theFile, function(response) {
        if (response && response != "" && response.indexOf("status") != -1) {
            var responseObj = JSON.parse(response);
            if (responseObj.status == "ok") {
                this.timeOutCount = 0;
                //Start checking for new files on server
                this.FileCheckInt = setInterval(this.checkForNewFiles.bind(this), 2000);
            } else {
                //stop spinner
                this.spinnerModel.spinning = false;
                this.controller.modelChanged(this.spinnerModel);

                Mojo.Log.error("Server error reported: " + responseObj.msg);
                Mojo.Additions.ShowDialogBox("Server Message", "The server reports: " + responseObj.msg.replace("ERROR: ", "") + "<br>This response usually does not indicate a problem with the server itself, but some upstream dependency (like Google, or the server's file system.)");
            }
        } else {
            //stop spinner
            this.spinnerModel.spinning = false;
            this.controller.modelChanged(this.spinnerModel);

            Mojo.Log.error("No usable response from server: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response. Check network connectivity.");
        }
    }.bind(this));
}

//HTTP request for requestFile
MainAssistant.prototype.doMeTubeRequest = function(youtubeURL, callback) {

    Mojo.Log.info("Requesting YouTube video: " + youtubeURL + " from " + this.ServiceURL);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", this.ServiceURL);
    xmlhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xmlhttp.send(JSON.stringify({ "url": youtubeURL, "quality": "best" }));
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//Actually play the video we requested 
MainAssistant.prototype.playPreparedVideo = function(videoURL) {
    //stop spinner
    this.spinnerModel.spinning = false;
    this.controller.modelChanged(this.spinnerModel);

    //Ask webOS to launch the video player with the new url
    this.videoRequest = new Mojo.Service.Request("palm://com.palm.applicationManager", {
        method: "open",
        parameters: {
            "id": "com.palm.app.videoplayer",
            "params": {
                "target": videoURL
            }
        },
        onSuccess: function(response) {
            Mojo.Log.info("Video player launch success", JSON.stringify(response));
            $("txtYoutubeURL").focus();
        },
        onFailure: function(response) {
            Mojo.Log.error("Video player launch Failure, " + videoURL + ":",
                JSON.stringify(response), response.errorText);
        }
    });
    return true;
}

//Send a search request to MeTube to send to Google for us (never worry about HTTPS encryption again)
MainAssistant.prototype.searchYouTube = function(videoRequest) {
    Mojo.Log.info("Search requested: " + videoRequest)
    this.SearchValue = videoRequest;
    this.getSearchResults(videoRequest, function(response) {
        Mojo.Log.info("ready to process search results!");
        if (response != null && response != "") {
            var responseObj = JSON.parse(response);
            if (responseObj.items && responseObj.items.length > 0) {
                //If we got a good looking response, update the UI
                this.updateSearchResultsList(responseObj.items);
            } else {
                Mojo.Log.warn("Search results were empty. This is unlikely, server, API or connectivity problem possible");
                Mojo.Additions.ShowDialogBox("No results", "The server did not report any matches for the search.");
            }
        } else {
            Mojo.Log.error("No usable response from server: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response. Check network connectivity.");
        }
        //stop spinner
        this.spinnerModel.spinning = false;
        this.controller.modelChanged(this.spinnerModel);
    }.bind(this));
}

//Get the results from Search Request
MainAssistant.prototype.getSearchResults = function(searchString, callback) {
    Mojo.Log.info("Getting search results: " + this.PlaybackURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    //var searchURL = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&type=video&q=" + encodeURI(searchString) + "&key=" + this.APIKey;
    var searchURL = this.SearchURLBase + "?part=snippet&maxResults=25&type=video&q=" + encodeURI(searchString);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", searchURL);
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            //Mojo.Log.info("Google API responded: " + xmlhttp.responseText);
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//Update the UI with search results from Search Request
MainAssistant.prototype.updateSearchResultsList = function(results) {

    var thisWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    thisWidgetSetup.model.items = []; //remove the previous list

    for (var i = 0; i < results.length; i++) {
        thisWidgetSetup.model.items.push({ youtubeId: results[i].id.videoId, videoName: decodeURI(results[i].snippet.title), thumbnail: results[i].snippet.thumbnails.medium.url, selectedState: false });
    }

    Mojo.Log.info("Updating search results widget with " + results.length + " results!");
    $("showResultsList").style.display = "block";
    this.controller.modelChanged(thisWidgetSetup.model);
}

MainAssistant.prototype.checkForSpecialCases = function(videoRequest) {
    //Test cases
    if (videoRequest.toLowerCase() == "*test")
        videoRequest = "https://www.youtube.com/watch?v=UYPoMjR6-Ao";
    if (videoRequest.toLowerCase() == "*missing")
        videoRequest = "https://www.youtube.com/watch?v=IcrbM1L_BoI";

    //Easter eggs
    switch (videoRequest.toLowerCase()) {
        case "*benjamin wyndham":
            videoRequest = "https://www.youtube.com/watch?v=uJ2RYov2s5Y";
            break;
        case "*abigail joan":
            videoRequest = "https://www.youtube.com/watch?v=_P-_OZG6vFY";
            break;
        case "*elisa grace": //TODO: YouTube won't play this video due to a copyright claim
            videoRequest = "https://www.youtube.com/watch?v=EN7m9v1UtRk";
            break;
    }
    return videoRequest;
}

MainAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any other cleanup that should happen before
       this scene is popped or another scene is pushed on top */
};

MainAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is destroyed as 
       a result of being popped off the scene stack */
};