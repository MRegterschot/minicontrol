import MapsWindow from './mapsWindow';
import MapsWindowAdmin from './mapsWindowAdmin';
import Plugin from "..";

export default class Maps extends Plugin {

    async onLoad() {
        tmc.addCommand("/list", this.cmdMaps.bind(this), "Display maps list");
        tmc.addCommand("//list", this.cmdAdmMaps.bind(this), "Display maps list");
    }

    async onUnload() {
        tmc.removeCommand("/list");
        tmc.storage["menu"]?.removeItem("Map List");
    }

    async onStart() {
        tmc.storage["menu"]?.addItem({
            category: "Map",
            title: "Map List",
            action: "/list"
        });
    }

    async cmdMaps(login: any, params: string[]) {
        const window = new MapsWindow(login, params);
        window.size = { width: 190, height: 85 };
        window.setColumns([
            { key: "Index", title: "#", width: 4 },
            { key: "Name", title: "Name", width: 50, action: "Queue" },
            { key: "AuthorName", title: "Author", width: 30 },
            { key: "ATime", title: "Author Time", width: 20 },
            { key: "MapLikes", title: "MapLikes", width: 15 },
            { key: "Rank", title: "Rank", width: 5 },
            { key: "Medal", title: "Medal", width: 5 }            
        ]);
        window.title = "Maps [" + tmc.maps.getMapCount() + "]";
        await window.display()
    }

    async cmdAdmMaps(login: any, params: string[]) {
        const window = new MapsWindowAdmin(login, params);
        window.size = { width: 155, height: 95 };
        window.setColumns([
            { key: "Index", title: "#", width: 4 },
            { key: "Name", title: "Name", width: 50, action: "Queue" },
            { key: "AuthorName", title: "Author", width: 30 },
            { key: "ATime", title: "Author Time", width: 20 },
            { key: "MapLikes", title: "MapLikes", width: 15 }
        ]);
        window.title = "Maps [" + tmc.maps.getMapCount() + "]";
        window.setActions(["Remove"]);
        await window.display()
    }

}