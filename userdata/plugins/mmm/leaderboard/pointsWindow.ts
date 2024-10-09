import type Leaderboard from ".";
import ListWindow from "../../../../core/ui/listwindow";


export default class PointsWindow extends ListWindow {
    app: Leaderboard;

    constructor(login: string, app: Leaderboard) {
        super(login);
        this.app = app;
    }
}