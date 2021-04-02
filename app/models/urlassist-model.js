var URLAssistModel = function() {

};

//Check to see if this app is registered for handling a given URL
URLAssistModel.prototype.checkURLHandling = function(url, success, failure) {
    if (!url || url == "")
        url = "https://www.youtube.com/watch?v=VYVz2qa30G0";

    this.serviceRequest = new Mojo.Service.Request("palm://com.palm.applicationManager", {
        method: "listAllHandlersForUrl",
        parameters: {
            "url": url
        },
        onSuccess: function(responseObj) {
            if (responseObj && responseObj.redirectHandlers) {
                var found = false;
                if (responseObj.redirectHandlers.activeHandler.appId == Mojo.Controller.appInfo.id) {
                    found = true;
                    Mojo.Log.info("Checked URL handler, " + Mojo.Controller.appInfo.id + " found!");
                    if (success)
                        success(responseObj);
                }
                if (!found)
                    failure(responseObj);
            } else {
                Mojo.Log.warn("Unexpected payload in system service request");
                if (failure)
                    failure(responseObj);
            }
        }.bind(this),
        onFailure: function(responseObj) {
            Mojo.Log.error("URL handler list failure: " + JSON.stringify(response));
            failure(responseObj);
        }.bind(this)
    });
}

//Try to Launch URL Assist, or offer to get from App Museum II if not available
URLAssistModel.prototype.tryLaunchURLAssist = function(updater) {
    this.serviceRequest = new Mojo.Service.Request("palm://com.palm.applicationManager", {
        method: "launch",
        parameters: {
            id: "com.palm.app.jonandnic.urlassist",
            params: {}
        },
        onFailure: function(response) {
            updater.CheckForUpdate("URL Assist", function(updaterResponse) {
                if (updaterResponse && updaterResponse.downloadURI) {
                    var stageController = Mojo.Controller.getAppController().getActiveStageController();
                    if (stageController) {
                        this.controller = stageController.activeScene();
                        this.controller.showAlertDialog({
                            title: "URL Assist Not Found",
                            message: "MeTube can be configured to handle YouTube or Reddit video URLs, but it requires a helper app called <b>URL Assist</b>, which wasn't found on your device. Do you want to download it from App Museum II now? (requires Preware)",
                            choices: [{
                                    label: 'Yes',
                                    value: true
                                },
                                {
                                    label: 'No',
                                    value: false
                                }
                            ],
                            allowHTMLMessage: true,
                            onChoose: function(value) {
                                if (value) {
                                    //launch preware with URL
                                    updater.InstallViaPreware(updaterResponse.downloadURI, function(success) {
                                        if (!success) {
                                            Mojo.Controller.getAppController().showBanner({ messageText: "Preware launch failure, check install." }, "", "");
                                        }
                                    }.bind(this));
                                }
                            }.bind(this),
                        });
                    }
                } else {
                    Mojo.Additions.ShowDialogBox("URL Assist Not Found", "MeTube can be configured to handle YouTube or Reddit video URLs, but it requires a helper app called <b>URL Assist</b>, which wasn't found on your device.<br>Download <b>URL Assist</b> from App Museum II to configure this option.");
                }
            }.bind(this))

        }.bind(this)
    });
}