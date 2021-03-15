function PreferencesAssistant() {
    /* this is the creator function for your scene assistant object. It will be passed all the 
       additional parameters (after the scene name) that were passed to pushScene. The reference
       to the scene controller (this.controller) has not be established yet, so any initialization
       that needs the scene controller should be done in the setup function below. */
}

PreferencesAssistant.prototype.setup = function() {
    document.body.style.backgroundColor = null;
    /* setup widgets here */

    //Timeout picker
    this.controller.setupWidget("listTimeout",
        this.attributes = {
            label: $L("Convert Time"),
            choices: [
                { label: "10 seconds", value: 5 },
                { label: "30 seconds", value: 15 },
                { label: "1 minute", value: 30 },
                { label: "1.5 minutes", value: 45 },
                { label: "2 minutes", value: 60 },
                { label: "3 minutes", value: 90 },
            ]
        },
        this.model = {
            value: appModel.AppSettingsCurrent["TimeoutMax"],
            disabled: false
        }
    );
    //Search result picker
    this.controller.setupWidget("listSearchmax",
        this.attributes = {
            label: $L("Max Results"),
            choices: [
                { label: "10", value: 10 },
                { label: "25", value: 25 },
                { label: "50", value: 50 }
            ]
        },
        this.model = {
            value: appModel.AppSettingsCurrent["SearchResultMax"],
            disabled: false
        }
    );
    //Playback strategy picker
    var strategyDefault = appModel.AppSettingsCurrent["PlaybackStrategy"];
    var strategyDisabled = false;
    if (Mojo.Environment.DeviceInfo.platformVersionMajor < 2) {
        //Download is the only strategy that works on Pre and other older devices, so don't let the user toggle
        strategyDefault = "download";
        strategyDisabled = true;
    }
    this.controller.setupWidget("listStrategy",
        this.attributes = {
            label: $L("Play Strategy"),
            choices: [
                { label: "Stream", value: "stream" },
                { label: "Download", value: "download" }
            ]
        },
        this.model = {
            value: strategyDefault,
            disabled: strategyDisabled
        }
    );
    //HD quality picker
    var hdQuality = appModel.AppSettingsCurrent["HDQuality"];
    var strategyDisabled = false;
    this.controller.setupWidget("listHDQuality",
        this.attributes = {
            label: $L("HD Quality"),
            choices: [
                { label: "HQ", value: "bestvideo" },
                { label: "LQ", value: "worstvideo" }
            ]
        },
        this.model = {
            value: hdQuality,
            disabled: false
        }
    );
    //API Toggles
    this.controller.setupWidget("toggleGoogleAPI",
        this.attributes = {
            trueValue: true,
            falseValue: false
        },
        this.model = {
            value: appModel.AppSettingsCurrent["UseGoogleAPIKey"],
            disabled: false
        }
    );
    this.controller.setupWidget("toggleClientAPI",
        this.attributes = {
            trueValue: true,
            falseValue: false
        },
        this.model = {
            value: appModel.AppSettingsCurrent["UseClientAPIKey"],
            disabled: false
        }
    );
    this.controller.setupWidget("toggleServerKey",
        this.attributes = {
            trueValue: true,
            falseValue: false
        },
        this.model = {
            value: appModel.AppSettingsCurrent["UseServerKey"],
            disabled: false
        }
    );
    this.controller.setupWidget("toggleCustomEndPoint",
        this.attributes = {
            trueValue: true,
            falseValue: false
        },
        this.model = {
            value: appModel.AppSettingsCurrent["UseCustomEndpoint"],
            disabled: false
        }
    );
    //API Text fields
    this.controller.setupWidget("txtGoogleAPI",
        this.attributes = {
            hintText: $L("Your Google API Key"),
            multiline: false,
            enterSubmits: false,
            autoReplace: false,
            textCase: Mojo.Widget.steModeLowerCase
        },
        this.model = {
            value: appModel.AppSettingsCurrent["GoogleAPIKey"],
            disabled: !appModel.AppSettingsCurrent["UseGoogleAPIKey"]
        }
    );
    this.controller.setupWidget("txtClientAPI",
        this.attributes = {
            hintText: $L("Your MeTube API Key"),
            multiline: false,
            enterSubmits: false,
            autoReplace: false,
            textCase: Mojo.Widget.steModeLowerCase
        },
        this.model = {
            value: appModel.AppSettingsCurrent["ClientAPIKey"],
            disabled: !appModel.AppSettingsCurrent["UseClientAPIKey"]
        }
    );
    this.controller.setupWidget("txtServerKey",
        this.attributes = {
            hintText: $L("Your MeTube Server Key"),
            multiline: false,
            enterSubmits: false,
            autoReplace: false,
            textCase: Mojo.Widget.steModeLowerCase
        },
        this.model = {
            value: appModel.AppSettingsCurrent["ServerKey"],
            disabled: !appModel.AppSettingsCurrent["UseServerKey"]
        }
    );
    this.controller.setupWidget("txtEndpointURL",
        this.attributes = {
            hintText: $L("http://your-metube-server.com"),
            multiline: false,
            enterSubmits: false,
            autoReplace: false,
            textCase: Mojo.Widget.steModeLowerCase
        },
        this.model = {
            value: appModel.AppSettingsCurrent["EndpointURL"],
            disabled: !appModel.AppSettingsCurrent["EndpointURL"]
        }
    );

    //OK Button
    this.controller.setupWidget("btnOK", { type: Mojo.Widget.activityButton }, { label: "Done", disabled: false });
    //Menu
    this.appMenuAttributes = { omitDefaultItems: true };
    this.appMenuModel = {
        label: "Settings",
        items: [
            Mojo.Menu.editItem,
            { label: "Reset Settings", command: 'do-resetSettings' }
        ]
    };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttributes, this.appMenuModel);

    /* add event handlers to listen to events from widgets */
    Mojo.Event.listen(this.controller.get("listTimeout"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("listSearchmax"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("listStrategy"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("listHDQuality"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("txtGoogleAPI"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("txtClientAPI"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("txtServerKey"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("txtEndpointURL"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("toggleGoogleAPI"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("toggleClientAPI"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("toggleServerKey"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("toggleCustomEndPoint"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("btnOK"), Mojo.Event.tap, this.okClick.bind(this));
};

PreferencesAssistant.prototype.activate = function(event) {
    /* put in event handlers here that should only be in effect when this scene is active. For
       example, key handlers that are observing the document */
    //this.showBetaFeatures();
};

PreferencesAssistant.prototype.showBetaFeatures = function() {
    //No beta features right now
}

PreferencesAssistant.prototype.handleValueChange = function(event) {

    Mojo.Log.info(event.srcElement.id + " value changed to " + event.value);
    switch (event.srcElement.id) {
        case "listHDQuality":
            {
                if (Mojo.Environment.DeviceInfo.platformVersionMajor < 3 && event.value == "bestvideo") {
                    Mojo.Additions.ShowDialogBox("Experimental Feature", "Most HD Videos do not play on phones. The LQ setting attempts to request a lower bitrate video that is still HD, to try to get more videos to play. It is recommended you leave this setting at LQ on phones.");
                }
                if (Mojo.Environment.DeviceInfo.platformVersionMajor == 3 && event.value == "worstvideo") {
                    Mojo.Additions.ShowDialogBox("Experimental Feature", "Most HD Videos do not play on phones. The LQ setting attempts to request a lower bitrate video that is still HD, to try to get more videos to play. It is recommended you leave this setting at HQ on TouchPad.");
                }
                break;
            }
        case "toggleGoogleAPI":
            {
                var thisWidgetSetup = this.controller.getWidgetSetup("txtGoogleAPI");
                thisWidgetSetup.model.disabled = !event.value;
                this.controller.modelChanged(thisWidgetSetup.model);
                if (event.value)
                    this.controller.get('txtGoogleAPI').mojo.focus();
                break;
            }
        case "toggleClientAPI":
            {
                var thisWidgetSetup = this.controller.getWidgetSetup("txtClientAPI");
                thisWidgetSetup.model.disabled = !event.value;
                this.controller.modelChanged(thisWidgetSetup.model);
                if (event.value)
                    this.controller.get('txtClientAPI').mojo.focus();
                break;
            }
        case "toggleServerKey":
            {
                var thisWidgetSetup = this.controller.getWidgetSetup("txtServerKey");
                thisWidgetSetup.model.disabled = !event.value;
                this.controller.modelChanged(thisWidgetSetup.model);
                if (event.value)
                    this.controller.get('txtServerKey').mojo.focus();
                break;
            }
        case "toggleCustomEndPoint":
            {
                var thisWidgetSetup = this.controller.getWidgetSetup("txtEndpointURL");
                thisWidgetSetup.model.disabled = !event.value;
                this.controller.modelChanged(thisWidgetSetup.model);
                if (event.value)
                    this.controller.get('txtEndpointURL').mojo.focus();
                break;
            }
    }

    //We stashed the preference name in the title of the HTML element, so we don't have to use a case statement
    Mojo.Log.info(event.srcElement.title + " now: " + event.value);
    appModel.AppSettingsCurrent[event.srcElement.title] = event.value;
    appModel.SaveSettings();

    //Show/hide beta features
    this.showBetaFeatures();
};

//Handle menu and button bar commands
PreferencesAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
        switch (event.command) {
            case 'do-goBack':
                Mojo.Controller.stageController.popScene();
                break;
            case 'do-resetSettings':
                appModel.ResetSettings(appModel.AppSettingsDefaults);
                break;
        }
    }
};

PreferencesAssistant.prototype.okClick = function(event) {
    Mojo.Controller.stageController.popScene();
}

PreferencesAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any other cleanup that should happen before
       this scene is popped or another scene is pushed on top */

    Mojo.Event.stopListening(this.controller.get("listSearchmax"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("listTimeout"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("txtGoogleAPI"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("txtClientAPI"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("toggleGoogleAPI"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("toggleClientAPI"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("toggleServerKey"), Mojo.Event.propertyChange, this.handleValueChange);
    Mojo.Event.stopListening(this.controller.get("btnOK"), Mojo.Event.tap, this.okClick.bind(this));

};

PreferencesAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */

};