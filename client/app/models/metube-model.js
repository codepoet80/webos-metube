/*
MeTube Model - Mojo
 Version 1.3
 Created: 2020
 Author: Jonathan Wise
 License: MIT
 Description: A model to interact with MeTube wrapper service within a Mojo app.
*/

var MetubeModel = function() {
    this.SearchURLBase = "http://metube.webosarchive.com/search.php";
    this.AddURLBase = "http://metube.webosarchive.com/add.php";
    this.ListURLBase = "http://metube.webosarchive.com/list.php";
    this.PlaybackURLBase = "http://metube.webosarchive.com/play.php";
};

//Properties
MetubeModel.prototype.UseCustomGoogleAPIKey = false;
MetubeModel.prototype.CustomGoogleAPIKey = "";
MetubeModel.prototype.UseCustomClientAPIKey = false;
MetubeModel.prototype.CustomClientAPIKey = "";

//HTTP request for add file
MetubeModel.prototype.DoMeTubeAddRequest = function(youtubeURL, callback) {

    Mojo.Log.info("Requesting YouTube video: " + youtubeURL + " from " + this.AddURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", this.AddURLBase);
    xmlhttp.setRequestHeader("Client-Id", this.getCurrentClientKey());
    xmlhttp.send(this.encodeRequest(youtubeURL));
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//HTTP request for list files
MetubeModel.prototype.DoMeTubeListRequest = function(callback) {
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", this.ListURLBase);
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
    Mojo.Log.info("Getting search results: " + this.SearchURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var searchURL = this.SearchURLBase + "?part=snippet&maxResults=" + numResults + "&type=video&q=" + encodeURI(searchString) + this.getCurrentGoogleKey();
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

//Form HTTP request URL for playback
MetubeModel.prototype.BuildMeTubePlaybackRequest = function(videoURL) {
    videoURL = videoURL + "&requestid=" + this.encodeRequest(this.getCurrentClientKey() + "|" + videoURL);
    videoURL = this.PlaybackURLBase + "?video=" + videoURL;
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
    if (this.UseCustomClientAPIKey && this.CustomClientAPIKey != "") {
        retVal = this.CustomClientAPIKey;
        Mojo.Log.info("Using custom API key: " + retVal);
    }
    return retVal;
}

MetubeModel.prototype.encodeRequest = function(request) {
    request = btoa(request);
    var strLen = request.length;
    var randPos = Math.random() * (strLen - 1 - 0) + 0;
    var str1 = request.substring(0, randPos);
    var str2 = request.substring(randPos);
    request = str1 + atob(appKeys["serverId"]) + str2;
    return request;
}

MetubeModel.prototype.decodeResponse = function(response) {
    if (response.indexOf(atob(appKeys["serverId"])) != -1) {
        response = response.replace(atob(appKeys["serverId"]), "");
        response = atob(response);
        return response;
    }
    Mojo.Log.error("Bad response from server: unexpected encoding.");
}