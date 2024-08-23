import Plugin from "../../../core/plugins";

export default class MMMLeaderboard extends Plugin {
    static depends: string[] = ["game:Trackmania"];

    async onLoad() {
        tmc.server.addListener("TMC.PlayerFinish", this.onPlayerFinish, this);
    }

    async onUnload() {
        tmc.server.removeListener("TMC.PlayerFinish", this.onPlayerFinish.bind(this));
    }

    async onPlayerFinish(data: any) {
        console.log(data);
    }
}
