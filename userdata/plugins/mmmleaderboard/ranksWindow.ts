import type MMMLeaderboard from ".";
import ListWindow from "../../../core/ui/listwindow";

export default class RanksWindow extends ListWindow {
    app: MMMLeaderboard;

    constructor(login: string, app: MMMLeaderboard) {
        super(login);
        this.app = app;
    }
}
