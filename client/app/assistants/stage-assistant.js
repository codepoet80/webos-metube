Mojo.Additions = Additions;

var updaterModel = null;
var metubeModel = null;
var appModel = null;

function StageAssistant() {
    /* this is the creator function for your stage assistant object */
}

StageAssistant.prototype.setup = function() {
    /* this function is for setup tasks that have to happen when the stage is first created */
    this.controller.pushScene({ name: "main" });
    this.controller.setWindowOrientation("free");
    updaterModel = new UpdaterModel();
    metubeModel = new MetubeModel();
    appModel = new AppModel();
};