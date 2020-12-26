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

    this.SearchURLBase = "http://metube.webosarchive.com/search.php";
    this.AddURLBase = "http://metube.webosarchive.com/add.php";
    this.ListURLBase = "http://metube.webosarchive.com/list.php";
    this.PlaybackURLBase = "http://metube.webosarchive.com/play.php";
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
    Mojo.Log.info("Item tapped: " + event.item.videoName + ", id: " + event.item.youtubeId + ", selected state: " + event.item.selectedState);
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
        this.DoMeTubeListRequest(function(response) {
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
                Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response to the list request. Check network connectivity.");
            }
        }.bind(this));
    } else {
        //Play the video
        Mojo.Log.info("About to play video from historical path: " + historyPath);
        this.playPreparedVideo(historyPath);
    }
}

//Compare the list of files we know about with the files the server has to see what's new
MainAssistant.prototype.checkForNewFiles = function() {
    Mojo.Log.info("Checking for new files...");
    this.DoMeTubeListRequest(function(response) {
        if (response && response != "") {
            var responseObj = JSON.parse(response);
            if (responseObj.status == "error") {
                clearInterval(this.FileCheckInt);
                Mojo.Log.error("Error message from server while checking for new files: " + responseObj.msg);
                Mojo.Additions.ShowDialogBox("Server Error", "The server responded to the check file request with: " + responseObj.msg.replace("ERROR: ", ""));
            } else {
                checkList = responseObj;
                if (this.timeOutCount <= this.TimeOutMax) {
                    if (checkList.files && checkList.files.length > this.FileList.files.length) {
                        Mojo.Log.info("A new file has appeared on the server!");
                        clearInterval(this.FileCheckInt);
                        var videoPath = this.findNewFile(checkList);
                        if (videoPath != null && videoPath != "") {
                            //Calculate full URL
                            if (videoPath.indexOf("|") != -1) {
                                //TODO: DEVELOPER MODE
                                videoPath = videoPath.split("|");
                                videoPath = videoPatt[0];
                            }

                            //Update video request history (we're forced to assume this result is for the most recent request)
                            updateVideoRequest = this.VideoRequests[this.VideoRequests.length - 1];
                            updateVideoRequest.videoPath = videoPath;
                            this.VideoRequests[this.VideoRequests.length - 1] = updateVideoRequest;

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
            }
        } else {
            clearInterval(this.FileCheckInt);
            Mojo.Log.error("No usable response from server while checking for new files: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response to the check file request. Check network connectivity.");
        }
        //stop spinner
        this.spinnerModel.spinning = false;
        this.controller.modelChanged(this.spinnerModel);
    }.bind(this));
}

//Identify which is the new file
MainAssistant.prototype.findNewFile = function(checkList) {
    //Mojo.Log.info("searching checkList for new files: " + JSON.stringify(checkList));
    var knownFiles = [];
    //Load our saved file list into an array for easy comparison
    for (var j = 0; j < this.FileList.files.length; j++) {
        knownFiles.push(this.decodeResponse(this.FileList.files[j].file));
    }
    // Check each file in response against known file list
    for (var i = 0; i < checkList.files.length; i++) {
        var checkFile = this.decodeResponse(checkList.files[i].file);
        if (knownFiles.indexOf(checkFile) == -1) {
            Mojo.Log.info("File to play is: " + checkFile);
            return checkFile;
        }
    }
}

//Ask MeTube to prepare a new video file for us
MainAssistant.prototype.addFile = function(theFile) {
    //Mojo.Log.info("Time to submit a file request: " + theFile);
    this.DoMeTubeAddRequest(theFile, function(response) {
        Mojo.Log.info("add response: " + response);
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

                Mojo.Log.error("Server Error while adding new file request" + responseObj.msg);
                Mojo.Additions.ShowDialogBox("Server Error", "The server responded to the add file request with: " + responseObj.msg.replace("ERROR: ", ""));
            }
        } else {
            //stop spinner
            this.spinnerModel.spinning = false;
            this.controller.modelChanged(this.spinnerModel);

            Mojo.Log.error("No usable response from server while adding new file request: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer the add file request with a usable response. Check network connectivity.");
        }
    }.bind(this));
}

//Actually play the video we requested 
MainAssistant.prototype.playPreparedVideo = function(videoURL) {

    videoURL = this.BuildMeTubePlaybackRequest(videoURL);

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
            //stop spinner
            this.spinnerModel.spinning = false;
            this.controller.modelChanged(this.spinnerModel);
        }.bind(this),
        onFailure: function(response) {
            Mojo.Log.error("Video player launch Failure, " + videoURL + ":",
                JSON.stringify(response), response.errorText);
            //stop spinner
            this.spinnerModel.spinning = false;
            this.controller.modelChanged(this.spinnerModel);
        }.bind(this)
    });
    return true;
}

//Send a search request to MeTube to send to Google for us (never worry about HTTPS encryption again)
MainAssistant.prototype.searchYouTube = function(videoRequest) {
    Mojo.Log.info("Search requested: " + videoRequest)
    this.SearchValue = videoRequest;
    this.DoMeTubeSearchRequest(videoRequest, function(response) {
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
                    Mojo.Log.warn("Search results were empty. This is unlikely, server, API or connectivity problem possible");
                    Mojo.Additions.ShowDialogBox("No results", "The server did not report any matches for the search.");
                }
            }
        } else {
            Mojo.Log.error("No usable response from server while searching YouTube: " + response);
            Mojo.Additions.ShowDialogBox("Server Error", "The server did not answer with a usable response to the search request. Check network connectivity.");
        }
        //stop spinner
        this.spinnerModel.spinning = false;
        this.controller.modelChanged(this.spinnerModel);
    }.bind(this));
}

//Update the UI with search results from Search Request
MainAssistant.prototype.updateSearchResultsList = function(results) {

    var thisWidgetSetup = this.controller.getWidgetSetup("searchResultsList");
    thisWidgetSetup.model.items = []; //remove the previous list

    for (var i = 0; i < results.length; i++) {
        thisWidgetSetup.model.items.push({ youtubeId: results[i].id.videoId, videoName: decodeURI(this.decodeEntities(results[i].snippet.title)), thumbnail: results[i].snippet.thumbnails.medium.url, selectedState: false });
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

    return text;
}

MainAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any other cleanup that should happen before
       this scene is popped or another scene is pushed on top */
};

MainAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is destroyed as 
       a result of being popped off the scene stack */
};

/* MeTube Helper Functions */

//HTTP request for add file
MainAssistant.prototype.DoMeTubeAddRequest = function(youtubeURL, callback) {

    Mojo.Log.info("Requesting YouTube video: " + youtubeURL + " from " + this.AddURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", this.AddURLBase);
    //xmlhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xmlhttp.setRequestHeader("Client-Id", appKeys['clientKey']);
    xmlhttp.send(this.encodeRequest(youtubeURL));
    //xmlhttp.send(JSON.stringify({ "url": youtubeURL, "quality": "best" }));
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//HTTP request for list files
MainAssistant.prototype.DoMeTubeListRequest = function(callback) {
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", this.ListURLBase);
    xmlhttp.setRequestHeader("Client-Id", appKeys['clientKey']);
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//HTTP request for search
MainAssistant.prototype.DoMeTubeSearchRequest = function(searchString, callback) {
    Mojo.Log.info("Getting search results: " + this.SearchURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    //var searchURL = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&type=video&q=" + encodeURI(searchString) + "&key=" + this.APIKey;
    var searchURL = this.SearchURLBase + "?part=snippet&maxResults=25&type=video&q=" + encodeURI(searchString);
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", searchURL);
    xmlhttp.setRequestHeader("Client-Id", appKeys['clientKey']);
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            //Mojo.Log.info("Search response: " + xmlhttp.responseText);
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//Form HTTP request URL for playback
MainAssistant.prototype.BuildMeTubePlaybackRequest = function(videoURL) {
    videoURL = encodeURI(videoURL) + "&requestid=" + this.encodeRequest(appKeys['clientKey'] + "|" + encodeURI(videoURL));
    videoURL = this.PlaybackURLBase + "?video=" + videoURL;
    Mojo.Log.info("Actual video request is: " + videoURL);
    return videoURL;
}

MainAssistant.prototype.encodeRequest = function(request) {
    request = btoa(request);
    var strLen = request.length;
    var randPos = Math.random() * (strLen - 1 - 0) + 0;
    var str1 = request.substring(0, randPos);
    var str2 = request.substring(randPos);
    request = str1 + appKeys["serverId"] + str2;
    //Mojo.Log.info("encoded request: " + request);
    return request;
}

MainAssistant.prototype.decodeResponse = function(response) {
    if (response.indexOf(appKeys["serverId"]) != -1) {
        response = response.replace(appKeys["serverId"], "");
        response = atob(response);
        //Mojo.Log.info("decoded response: " + response);
        return response;
    }
    Mojo.Log.error("Bad response from server: unexpected encoding.");
}