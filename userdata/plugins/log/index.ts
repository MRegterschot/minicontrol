import Plugin from "@core/plugins";
import fs from "fs";

export default class LogPlugin extends Plugin {
	static depends: string[] = [];

	async onLoad() {
		tmc.server.addListener("Plugin.Log.message", this.onMessage, this);
	}

	async onUnload() {
		tmc.server.removeListener("Plugin.Log.message", this.onMessage);
	}

	async onStart() {

	}

	async onMessage(data: any) {
		const currentDate = new Date();
		const date = currentDate.getFullYear() + '-' +
			String(currentDate.getMonth() + 1).padStart(2, '0') + '-' +
			String(currentDate.getDate()).padStart(2, '0');

		if (!fs.existsSync(import.meta.dirname + "/../../../logs/messages")) {
			fs.mkdirSync(import.meta.dirname + "/../../../logs/messages", { recursive: true });
		}

		let buffer = fs.readFileSync(`${import.meta.dirname}/../../../logs/messages/${date}.json`, { flag: 'a+' });
		let logs = JSON.parse(buffer.toString() || "[]");

		logs.push(data);

		fs.writeFileSync(`${import.meta.dirname}/../../../logs/messages/${date}.json`, JSON.stringify(logs));
	}
}
