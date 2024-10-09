import type Leaderboard from ".";
import ListWindow from "../../../../core/ui/listwindow";

export default class LeaderboardWindow extends ListWindow {
    app: Leaderboard;

    constructor(login: string, app: Leaderboard) {
        super(login);
        this.app = app;
    }
}
