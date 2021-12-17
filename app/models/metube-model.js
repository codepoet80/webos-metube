/*
MeTube Model - Mojo
 Version 1.3
 Created: 2020
 Author: Jonathan Wise
 License: MIT
 Description: A model to interact with MeTube wrapper service within a Mojo app.
*/

var MetubeModel = function() {
    this.urlBase = "http://metube.webosarchive.com";
};

//Properties
MetubeModel.prototype.UseCustomGoogleAPIKey = false;
MetubeModel.prototype.CustomGoogleAPIKey = "";
MetubeModel.prototype.UseCustomClientAPIKey = false;
MetubeModel.prototype.CustomClientAPIKey = "";
MetubeModel.prototype.UseCustomServerKey = false;
MetubeModel.prototype.CustomServerKey = "";
MetubeModel.prototype.UseCustomEndpoint = false;
MetubeModel.prototype.CustomEndpointURL = "";
MetubeModel.prototype.ServiceCompatWarning = 0;

MetubeModel.prototype.buildURL = function(actionType) {
    var urlBase = this.urlBase;
    if (this.UseCustomEndpoint == true && this.CustomEndpointURL != "") {
        urlBase = this.CustomEndpointURL;
    }
    //Make sure we don't end up with double slashes in the built URL if there's a custom endpoint
    var urlTest = urlBase.split("://");
    if (urlTest[urlTest.length - 1].indexOf("/") != -1) {
        urlBase = urlBase.substring(0, urlBase.length - 1);
    }
    var path = urlBase + "/" + actionType + ".php";
    return path;
}

//HTTP request for add file
MetubeModel.prototype.DoMeTubeAddRequest = function(videoURL, quality, convert, callback) {
    if (!quality)
        quality = "bestvideo";

    var useURL = this.buildURL("add");
    if (videoURL.indexOf("reddit.com") != -1 || videoURL.indexOf("v.redd.it") != -1) {
        useURL = this.buildURL("add-reddit");
    }
    Mojo.Log.info("Requesting YouTube video: " + videoURL + " from " + useURL + " at quality: " + quality + " with conversion flag: " + convert);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", useURL);
    xmlhttp.setRequestHeader("Client-Id", this.getCurrentClientKey());
    xmlhttp.setRequestHeader("Convert", convert);
    xmlhttp.setRequestHeader("Quality", quality);
    xmlhttp.send(this.encodeRequest(videoURL));
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 404) {
                Mojo.Log.error("Service returned 404 requesting video details. If the service is online, there's probably a version mismatch between service and client.");
                if (this.ServiceCompatWarning == 0) {
                    Mojo.Controller.getAppController().showBanner({ messageText: "Back-end outdated, video source not suppored." }, "", "");
                    this.ServiceCompatWarning++;
                }
            } else {
                //Mojo.Log.info("Details response: " + xmlhttp.responseText);
                if (callback) callback(xmlhttp.responseText);
            }
        }
    }.bind(this);
}

//HTTP request for list files
MetubeModel.prototype.DoMeTubeListRequest = function(callback) {
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", this.buildURL("list"));
    xmlhttp.setRequestHeader("Client-Id", this.getCurrentClientKey());
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//HTTP request for search
MetubeModel.prototype.DoMeTubeSearchRequest = function(searchString, numResults, callback) {
    Mojo.Log.info("Getting search results for '" + searchString + "' from: " + this.buildURL("search"));
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var searchURL = this.buildURL("search") + "?part=snippet&maxResults=" + numResults + "&type=video&q=" + encodeURI(searchString) + this.getCurrentGoogleKey();
    //Mojo.Log.info("Asking server to search with URL: " + searchURL);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", searchURL);
    xmlhttp.setRequestHeader("Client-Id", this.getCurrentClientKey());
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            //Mojo.Log.info("Search response: " + xmlhttp.responseText);
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//HTTP request for video details
MetubeModel.prototype.DoMeTubeDetailsRequest = function(videoId, callback) {
    //Mojo.Log.info("Getting video details from: " + this.buildURL("details"));
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var detailsURL = this.buildURL("details") + "?id=" + videoId + this.getCurrentGoogleKey();
    Mojo.Log.info("Asking server for video details with URL: " + detailsURL);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", detailsURL);
    xmlhttp.setRequestHeader("Client-Id", this.getCurrentClientKey());
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 404) {
                Mojo.Log.error("Service returned 404 requesting video details. If the service is online, there's probably a version mismatch between service and client.");
                if (this.ServiceCompatWarning == 0) {
                    Mojo.Controller.getAppController().showBanner({ messageText: "Back-end outdated, can't get details" }, "", "");
                    this.ServiceCompatWarning++;
                }
            } else {
                //Mojo.Log.info("Details response: " + xmlhttp.responseText);
                if (callback) callback(xmlhttp.responseText);
            }
        }
    }.bind(this);
}

//Form HTTP request URL for playback
MetubeModel.prototype.BuildMeTubePlaybackRequest = function(videoURL) {
    videoURL = videoURL + "&requestid=" + this.encodeRequest(this.getCurrentClientKey() + "|" + videoURL);
    videoURL = this.buildURL("play") + "?video=" + videoURL;
    Mojo.Log.info("Actual video request is: " + videoURL);
    return videoURL;
}

MetubeModel.prototype.getCurrentGoogleKey = function() {
    var retVal = "";
    if (this.UseCustomGoogleAPIKey && this.CustomGoogleAPIKey != "") {
        retVal = "&key=" + this.CustomGoogleAPIKey;
        Mojo.Log.info("Using API key: " + retVal);
    }
    return retVal;
}

MetubeModel.prototype.getCurrentClientKey = function() {
    var retVal = atob(appKeys['clientKey']);
    if (this.UseCustomClientAPIKey) {
        retVal = this.CustomClientAPIKey;
        Mojo.Log.info("Using custom API key: " + retVal);
    }
    return retVal;
}

MetubeModel.prototype.getCurrentServerKey = function() {
    var retVal = atob(appKeys['serverId']);
    if (this.UseCustomServerKey) {
        retVal = this.CustomServerKey;
        Mojo.Log.info("Using custom Server key: " + retVal);
    }
    return retVal;
}

MetubeModel.prototype.encodeRequest = function(request) {
    request = btoa(request);
    if (!this.UseCustomServerKey == true || (this.UseCustomServerKey == true && this.CustomServerKey != "")) {
        var strLen = request.length;
        var randPos = Math.random() * (strLen - 1 - 0) + 0;
        var str1 = request.substring(0, randPos);
        var str2 = request.substring(randPos);
        request = str1 + this.getCurrentServerKey() + str2;
    }
    return request;
}

MetubeModel.prototype.decodeResponse = function(response) {
    if (response.indexOf(this.getCurrentServerKey()) != -1) {
        response = response.replace(this.getCurrentServerKey(), "");
        response = atob(response);
        return response;
    } else {
        if (this.UseCustomServerKey == true && this.CustomServerKey == "")
            return atob(response);
    }
    Mojo.Log.error("Bad response from server: unexpected encoding.");
}