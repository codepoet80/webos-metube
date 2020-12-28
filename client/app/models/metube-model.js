/*
MeTube Model - Mojo
 Version 1.2
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

//HTTP request for add file
MetubeModel.prototype.DoMeTubeAddRequest = function(youtubeURL, callback) {

    Mojo.Log.info("Requesting YouTube video: " + youtubeURL + " from " + this.AddURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", this.AddURLBase);
    //xmlhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xmlhttp.setRequestHeader("Client-Id", atob(appKeys['clientKey']));
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
MetubeModel.prototype.DoMeTubeListRequest = function(callback) {
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", this.ListURLBase);
    xmlhttp.setRequestHeader("Client-Id", atob(appKeys['clientKey']));
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (callback)
                callback(xmlhttp.responseText);
        }
    }.bind(this);
}

//HTTP request for search
MetubeModel.prototype.DoMeTubeSearchRequest = function(searchString, callback) {
    Mojo.Log.info("Getting search results: " + this.SearchURLBase);
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    //var searchURL = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&type=video&q=" + encodeURI(searchString) + "&key=" + this.APIKey;
    var searchURL = this.SearchURLBase + "?part=snippet&maxResults=25&type=video&q=" + encodeURI(searchString);
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", searchURL);
    xmlhttp.setRequestHeader("Client-Id", atob(appKeys['clientKey']));
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
    videoURL = encodeURI(videoURL) + "&requestid=" + this.encodeRequest(atob(appKeys['clientKey']) + "|" + encodeURI(videoURL));
    videoURL = this.PlaybackURLBase + "?video=" + encodeURI(videoURL);
    Mojo.Log.info("Actual video request is: " + videoURL);
    return videoURL;
}

MetubeModel.prototype.encodeRequest = function(request) {
    request = btoa(request);
    var strLen = request.length;
    var randPos = Math.random() * (strLen - 1 - 0) + 0;
    var str1 = request.substring(0, randPos);
    var str2 = request.substring(randPos);
    request = str1 + atob(appKeys["serverId"]) + str2;
    //Mojo.Log.info("encoded request: " + request);
    return request;
}

MetubeModel.prototype.decodeResponse = function(response) {
    if (response.indexOf(atob(appKeys["serverId"])) != -1) {
        response = response.replace(atob(appKeys["serverId"]), "");
        response = atob(response);
        //Mojo.Log.info("decoded response: " + response);
        return response;
    }
    Mojo.Log.error("Bad response from server: unexpected encoding.");
}