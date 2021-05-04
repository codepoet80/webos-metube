/*
ShareBoard Model - Mojo
 Version 0.1
 Created: 2021
 Author: Jonathan Wise
 License: MIT
 Description: A model to interact with a share service
*/

var ShareServiceModel = function() {
    this.urlBase = "http://share.webosarchive.com/";
};

//Properties
ShareServiceModel.prototype.UseCustomShare = false;
ShareServiceModel.prototype.CustomShareUser = "";
ShareServiceModel.prototype.CustomSharePhrase = "";
ShareServiceModel.prototype.UseCustomEndpoint = false;
ShareServiceModel.prototype.CustomEndpointURL = "";
ShareServiceModel.prototype.CustomClientId = "";
//ShareServiceModel.prototype.ServiceCompatWarning = 0;

ShareServiceModel.prototype.buildURL = function(actionType) {
    var urlBase = this.urlBase;
    if (this.UseCustomEndpoint == true && this.CustomEndpointURL != "") {
        urlBase = this.CustomEndpointURL;
    }
    //Make sure we don't end up with double slashes in the built URL if there's a custom endpoint
    var urlTest = urlBase.split("://");
    if (urlTest[urlTest.length - 1].indexOf("/") != -1) {
        urlBase = urlBase.substring(0, urlBase.length - 1);
    }
    var path = urlBase + "/" + actionType + ".php" + "?username=" + this.getCurrentShareUser();
    return path;
}

//HTTP request for add file
ShareServiceModel.prototype.DoShareAddRequest = function(content, contentType, callback) {

    var useURL = this.buildURL("share-text");
    Mojo.Log.info("Adding share: " + content + " of type " + contentType + " from URL " + useURL);

    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", useURL);
    xmlhttp.setRequestHeader("client-id", this.getCurrentClientKey());
    xmlhttp.setRequestHeader("share-phrase", this.getCurrentSharePhrase());
    xmlhttp.setRequestHeader("content-type", contentType);
    xmlhttp.send(content);
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 404) {
                Mojo.Log.error("Share service returned 404 sharing content. If the service is online, there's probably a version mismatch between service and client.");
                Mojo.Controller.getAppController().showBanner({ messageText: "Error sharing: 404 at endpoint" }, "", "");
                if (callback) callback(false);
                return false;
            } else {
                Mojo.Log.info("ShareServiceModel got response: " + xmlhttp.responseText);
                if (xmlhttp.responseText && xmlhttp.responseText != "") {
                    try {
                        var responseObj = JSON.parse(xmlhttp.responseText);
                        if (responseObj.error) {
                            Mojo.Log.error("Share service returned error: " + responseObj.error);
                            Mojo.Controller.getAppController().showBanner({ messageText: "Error sharing: " + responseObj.error }, "", "");
                        } else {
                            Mojo.Log.info("Share success! " + xmlhttp.responseText);
                            if (callback) {
                                callback(xmlhttp.responseText);
                            } else {
                                Mojo.Controller.getAppController().showBanner({ messageText: "Content shared!" }, "", "");
                            }
                            return true;
                        }
                    } catch (ex) {
                        Mojo.Controller.getAppController().showBanner({ messageText: "Error sharing: server response malformed" }, "", "");
                        Mojo.Log.error("Share service response could not be parsed: " + xmlhttp.responseText);
                    }
                } else {
                    Mojo.Controller.getAppController().showBanner({ messageText: "Error sharing: server response empty" }, "", "");
                    Mojo.Log.error("Share service response was empty: " + xmlhttp.responseText);
                }
                if (callback) callback(false);
                return false;
            }
        }
    }.bind(this);
}

//HTTP request for list files
ShareServiceModel.prototype.DoShareListRequest = function(callback) {
    this.retVal = "";
    if (callback)
        callback = callback.bind(this);

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", this.buildURL("get-shares"));
    xmlhttp.setRequestHeader("client-id", this.getCurrentClientKey());
    xmlhttp.setRequestHeader("share-phrase", this.getCurrentSharePhrase());
    xmlhttp.send();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 404) {
                Mojo.Log.error("Share service returned 404 sharing content. If the service is online, there's probably a version mismatch between service and client.");
                Mojo.Controller.getAppController().showBanner({ messageText: "Error sharing: 404 at endpoint" }, "", "");
                if (callback) callback(false);
                return false;
            } else {
                Mojo.Log.info("ShareServiceModel got response: " + xmlhttp.responseText);
                if (xmlhttp.responseText && xmlhttp.responseText != "") {
                    try {
                        var responseObj = JSON.parse(xmlhttp.responseText);
                        if (responseObj.error) {
                            Mojo.Log.error("Share service returned error: " + responseObj.error);
                            Mojo.Controller.getAppController().showBanner({ messageText: "Error getting shares: " + responseObj.error }, "", "");
                        } else {
                            Mojo.Log.info("Share List success! " + xmlhttp.responseText);
                            if (callback) {
                                callback(xmlhttp.responseText);
                            } else {
                                Mojo.Controller.getAppController().showBanner({ messageText: "Content shared!" }, "", "");
                            }
                            return true;
                        }
                    } catch (ex) {
                        Mojo.Controller.getAppController().showBanner({ messageText: "Error getting shares: server response malformed" }, "", "");
                        Mojo.Log.error("Share service response could not be parsed: " + xmlhttp.responseText);
                    }
                } else {
                    Mojo.Controller.getAppController().showBanner({ messageText: "Error getting shares: server response empty" }, "", "");
                    Mojo.Log.error("Share service response was empty: " + xmlhttp.responseText);
                }
                if (callback) callback(false);
                return false;
            }
        }
    }.bind(this);
}

//Form HTTP request URL for playback
ShareServiceModel.prototype.BuildMeTubePlaybackRequest = function(videoURL) {
    videoURL = videoURL + "&requestid=" + this.encodeRequest(this.getCurrentClientKey() + "|" + videoURL);
    videoURL = this.buildURL("play") + "?video=" + videoURL;
    Mojo.Log.info("Actual video request is: " + videoURL);
    return videoURL;
}

ShareServiceModel.prototype.getCurrentClientKey = function() {
    var retVal = atob(appKeys['shareBoardClientKey']);
    if (this.UseCustomEndpoint) {
        retVal = this.CustomClientId;
        Mojo.Log.info("Using custom shareboard client key: " + retVal);
    }
    return retVal;
}

ShareServiceModel.prototype.getCurrentShareUser = function() {
    var retVal = appKeys['shareBoardUser'];
    if (this.UseCustomShare) {
        retVal = this.CustomShareUser;
        Mojo.Log.info("Using custom Share User: " + retVal);
    }
    return retVal;
}

ShareServiceModel.prototype.getCurrentSharePhrase = function() {
    var retVal = atob(appKeys['sharePhrase']);
    if (this.UseCustomShare) {
        retVal = this.CustomSharePhrase;
        Mojo.Log.info("Using custom Share Phrase: " + retVal);
    }
    return retVal;
}