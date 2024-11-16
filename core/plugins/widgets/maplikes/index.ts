import Plugin from "../../../plugins";
import Widget from '../../../ui/widget';
import type { Like } from "../../../plugins/maplikes";
import type { Player } from "../../../playermanager";

export default class MapLikesWidget extends Plugin {
    static depends: string[] = ["database", 'maplikes'];
    widgets: { [key: string]: Widget } = {};
    mapLikes: Like[] = [];

    async onLoad() {
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
        tmc.server.addListener("Plugin.MapLikes.onSync", this.onSync, this);
    };

    async onPlayerConnect(player: Player) {
        const login = player.login;
        await this.updateWidget(login);
        if (this.widgets[login]) {
            await tmc.ui.displayManialink(this.widgets[login]);
        }
    }
    
    async onPlayerDisconnect(player: Player) {
        const login = player.login;
        if (this.widgets[login]) {
            delete this.widgets[login];
        }
    }

    async actionLike(login: string, value: number) {
        if (value > 0)
            await tmc.chatCmd.execute(login, "/++")
        else 
            await tmc.chatCmd.execute(login, "/--")
    }

    async onUnload() {
        for (const login of Object.keys(this.widgets)) {
            delete this.widgets[login];
        }
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
        tmc.server.removeListener("Plugin.MapLikes.onSync", this.onSync);
    }

    async onSync(data: Like[]) {
        this.mapLikes = data;
        await this.updateWidgets();
    }

    async updateWidgets() {
        for (const player of tmc.players.getAll()) {
            await this.updateWidget(player.login);
        }
        await tmc.ui.displayManialinks(Object.values(this.widgets));
    }

    async updateWidget(login: string) {
        let widget = this.widgets[login];
        
        if (!widget) {
            widget = new Widget("core/plugins/widgets/maplikes/widget.twig");      
            widget.pos = { x: 115, y: 60 };   
            widget.recipient = login;
            widget.actions['like'] = tmc.ui.addAction(this.actionLike.bind(this), 1);
            widget.actions['dislike'] = tmc.ui.addAction(this.actionLike.bind(this), -1);
        }

        let positive = 0;
        let total = 0;

        for (const like of this.mapLikes) {
            if (like.vote > 0) {
                positive++;
            }
            total++;
        }

        let percentage = "No Votes";
        
        if (total > 0) {
            percentage = ((positive / total * 100).toFixed(0) || 0) + "%";
        }

        widget.setData({
            percentage: percentage,
            width: (positive / total * 30).toFixed(0),
            mapLike: this.mapLikes.find(like => like.login === login)
        });

        widget.title = "Map Likes ["+this.mapLikes.length+"]";
        widget.size = { width: 45, height: 6 };

        this.widgets[login] = widget;
    }
}