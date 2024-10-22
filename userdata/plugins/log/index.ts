import Plugin from "@core/plugins";
import fs from "fs";

type LogTypes = "messages" | "maps";

const logTypes: LogTypes[] = ["messages", "maps"];

export default class LogPlugin extends Plugin {
	static depends: string[] = [];
	private logPath: string = "/../../../logs";

	async onLoad() {
		for (const type of logTypes) {
			if (!fs.existsSync(import.meta.dirname + this.logPath + `/${type}`)) {
				fs.mkdirSync(import.meta.dirname + this.logPath + `/${type}`, { recursive: true });
			}
		}	

		tmc.server.addListener("Plugin.Log", this.onLog, this);
	}

	async onUnload() {
		tmc.server.removeListener("Plugin.Log", this.onLog);
	}

	async onStart() {

	}

	async onLog(type: LogTypes, data: any) {
		const currentDate = new Date();
		const date = currentDate.getFullYear() + '-' +
			String(currentDate.getMonth() + 1).padStart(2, '0') + '-' +
			String(currentDate.getDate()).padStart(2, '0');

		let buffer = fs.readFileSync(import.meta.dirname + this.logPath + `/${type}/${date}.json`, { flag: 'a+' });
		let logs = JSON.parse(buffer.toString() || "[]");

		logs.push(data);

		fs.writeFileSync(import.meta.dirname + this.logPath + `/${type}/${date}.json`, JSON.stringify(logs));
	}
}
