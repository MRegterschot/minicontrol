import Plugin from '../../plugins';
import Widget from '../../ui/widget';
import { formatTime, processColorString, escape } from '../..//utils';
import type { Player } from '../../playermanager';

export class Vote {
    type: string;
    question: string;
    value: number;
    timeout: number;
    votes: Map<string, boolean>;
    starter: string;
    vote_ratio: number = 0.5;

    constructor(login: string, type: string, question: string, timeout: number, value: number) {
        this.starter = login;
        this.type = type;
        this.question = question;
        this.timeout = timeout;
        this.value = value;
        this.votes = new Map<string, boolean>();
    }
}

export interface VoteStruct {
    vote: Vote;
    yes: number;
    no: number;
    total: number;
    percent: number;
}

export default class VotesPlugin extends Plugin {
    static depends: string[] = [];
    timeout: number = process.env.VOTE_TIMEOUT ? parseInt(process.env.VOTE_TIMEOUT) : 30;
    ratio: number = process.env.VOTE_RATIO ? parseFloat(process.env.VOTE_RATIO) : 0.55;
    currentVote: Vote | null = null;
    widgets: { [key: string]: Widget } = {};
    readonly origTimeLimit = Number.parseInt(process.env.TALIMIT || "300");
    newLimit = this.origTimeLimit;
    extendCounter = 1;

    async onLoad() {
        tmc.server.addOverride("CancelVote", this.overrideCancel.bind(this));
        tmc.server.addListener("TMC.Vote.Cancel", this.onVoteCancel, this);
        tmc.server.addListener("TMC.Vote.Deny", this.onVoteDeny, this);
        tmc.server.addListener("TMC.Vote.Pass", this.onVotePass, this);
        tmc.server.addListener("Trackmania.BeginMap", this.onBeginRound, this);
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
        if (tmc.game.Name == "TmForever") {
            tmc.server.addListener("Trackmania.EndRace", this.onEndMatch, this);
        } else {
            tmc.server.addListener("Trackmania.Podium_Start", this.onEndMatch, this);
        }
    }

    async onUnload() {
        for (const login of Object.keys(this.widgets)) {
            delete this.widgets[login];
        }
        tmc.server.addListener("TMC.PlayerConnect", this.onPlayerConnect, this);
        tmc.server.addListener("TMC.PlayerDisconnect", this.onPlayerDisconnect, this);
        tmc.server.removeOverride("CancelVote");
        tmc.server.removeListener("TMC.Vote.Cancel", this.onVoteCancel);
        tmc.server.removeListener("TMC.Vote.Deny", this.onVoteDeny);
        tmc.server.removeListener("TMC.Vote.Pass", this.onVotePass);
        tmc.server.removeListener("Trackmania.EndRace", this.onEndMatch);
        tmc.server.removeListener("Trackmania.Podium_Start", this.onEndMatch);
        tmc.server.removeListener("Trackmania.BeginMap", this.onBeginRound);
        this.currentVote = null;
        tmc.removeCommand("//vote");
        tmc.removeCommand("//pass");
        tmc.removeCommand("/skip");
        tmc.removeCommand("/extend");
        tmc.removeCommand("//extend");
        tmc.removeCommand("/yes");
        tmc.removeCommand("/no");
    }

    async onStart() {        
        tmc.addCommand("//vote", this.cmdVotes.bind(this), "Start custom vote");
        tmc.addCommand("//pass", this.cmdPassVote.bind(this), "Pass vote");
        tmc.addCommand("/skip", this.cmdSkip.bind(this), "Start vote to Skip map");
        tmc.addCommand("/extend", this.cmdExtend.bind(this), "Start vote to Extend map");
        tmc.addCommand("//extend", this.cmdAdmExtend.bind(this), "Extend timelimit");
        tmc.addCommand("/yes", this.cmdYes.bind(this), "Vote yes");
        tmc.addCommand("/no", this.cmdNo.bind(this), "Vote no");

        const menu = tmc.storage["menu"];
        if (menu) {
            menu.addItem({
                category: "Map",
                title: "Adm: Extend",
                action: "//extend",
                admin: true
            });

            menu.addItem({
                category: "Votes",
                title: "Adm: Cancel",
                action: "//cancel",
                admin: true
            });

            menu.addItem({
                category: "Votes",
                title: "Adm: Pass",
                action: "//pass",
                admin: true
            });
            

            menu.addItem({
                category: "Votes",
                title: "Skip",
                action: "/skip"
            });
            menu.addItem({
                category: "Votes",
                title: "Extend",
                action: "/extend"
            });
        }
    }

    async onPlayerConnect(player: Player) {
        const login = player.login;
        this.updateWidget(login);
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

    async onEndMatch() {
        this.newLimit = this.origTimeLimit;
        this.currentVote = null;
        this.hideWidgets();
        tmc.server.emit("TMC.Vote.Cancel", { vote: this.currentVote });
    }

    async onBeginRound() {
        this.currentVote = null;
        this.newLimit = this.origTimeLimit;        
        this.hideWidgets();        
        if (this.extendCounter > 1) {
            tmc.server.send("SetTimeAttackLimit", this.origTimeLimit * 1000);            
        }
        this.extendCounter = 1;
    }

    async passVote(login: string, args: string[]) {
        if (!this.currentVote) {
            tmc.chat("There is no vote in progress.");
            return;
        }
        await this.endVote(true);
    }

    overrideCancel(login: string, args: string[]) {
        if (this.currentVote) {
            tmc.chat("Vote cancelled by admin.");
            this.cancelVote(login);
            return true;
        }
        return false;
    }

    cancelVote(login: string) {
        tmc.server.emit("TMC.Vote.Cancel", { vote: this.currentVote });
        this.currentVote = null;
        this.hideWidgets();
    }

    async cmdVotes(login: string, args: string[]) {
        if (args.length < 1) {
            tmc.chat("Please specify a vote type", login);
            return;
        }
        const type = args.shift() || "";
        const question = args.join(" ");
        await this.startVote(login, type, question);
    }

    async cmdSkip(login: string, args: string[]) {
        await this.startVote(login, "Skip", "¤info¤Skip map?");
    }

    async cmdExtend(login: string, args: string[]) {
        // let minutes = Number.parseInt(args[0]) || 5;   
        let minutes = 5;  
        if (minutes < 1) minutes = 1;
        if (minutes > 10) minutes = 10;

        let message = `¤info¤Extend map by ¤white¤${minutes} ¤info¤min?`;
        await this.startVote(login, "Extend", message, minutes);
    }

    async startVote(login: string, type: string, question: string, value: number = -1) {
        if (!tmc.admins.includes(login)) {
            const allowedVotes = ["Skip", "Extend"];
            if (!allowedVotes.includes(type)) {
                tmc.chat("You are not allowed to start this type of vote.", login);
                return;
            }
        }

        if (this.currentVote) {
            tmc.chat("There is already a vote in progress.", login);
            return;
        }
        this.currentVote = new Vote(login, type, question, Date.now() + this.timeout * 1000, value);
        this.currentVote.vote_ratio = this.ratio;
        await this.vote(login, true);

        await this.updateWidgets();

        await this.checkVote();
    }

    async cmdYes(login: string, args: string[]) {
        await this.vote(login, true);
    }

    async cmdNo(login: string, args: string[]) {
        await this.vote(login, false);
    }

    async cmdPassVote(login: string, args: string[]) {
        await this.endVote(true);
    }

    async vote(login: string, vote: boolean) {
        if (!this.currentVote) {
            tmc.chat("There is no vote in progress.");
            return;
        }

        this.currentVote.votes.set(login, vote);

        // if everyone on the server has voted, end the vote
        let players = tmc.players.getAll();
        let votedPlayers = Array.from(this.currentVote.votes.keys());

        // check if every player is in votedPlayers
        let allVoted = players.every((player) => votedPlayers.includes(player.login));

        if (allVoted) {
            await this.endVote();
            return;
        }
    }

    async checkVote() {
        if (!this.currentVote) {
            this.hideWidgets();
            return;
        }
        if (this.currentVote.timeout < Date.now()) {
            await this.endVote(false);
            return;
        } else {
            setTimeout(this.checkVote.bind(this), 1000);
            await this.updateWidgets();
        }
    }

    async endVote(forcePass: boolean = false) {
        if (!this.currentVote) {
            this.hideWidgets();
            return;
        }

        const votes = Array.from(this.currentVote.votes.values());
        const yes = votes.filter((vote) => vote).length;
        const no = votes.filter((vote) => !vote).length;
        const total = yes + no;
        const percent = Math.round((yes / total) * 100);

        if (forcePass) {
            tmc.chat('¤info¤Admin passed the vote');
            tmc.server.emit("TMC.Vote.Pass", { vote: this.currentVote, yes: yes, no: no, total: total, percent: percent });
        } else if (percent >= this.ratio * 100) {
            tmc.chat(`¤info¤Vote: ¤white¤${this.currentVote.question}`);
            tmc.chat(`¤info¤Vote passed: ¤white¤${yes} / ${no} (${percent}%)`);
            tmc.server.emit("TMC.Vote.Pass", { vote: this.currentVote, yes: yes, no: no, total: total, percent: percent });
        } else {
            tmc.chat(`¤info¤Vote: ¤white¤${this.currentVote.question}`);
            tmc.chat(`¤info¤Vote did not pass: ¤white¤${yes} / ${no} (${percent}%)`);
            tmc.server.emit("TMC.Vote.Deny", { vote: this.currentVote, yes: yes, no: no, total: total, percent: percent });
        }

        this.currentVote = null;
        this.hideWidgets();
    }

    async updateWidgets() {
        if (!this.currentVote) {
            this.hideWidgets();
            return;
        }

        const yes = Array.from(this.currentVote.votes.values()).filter((vote) => vote).length;
        const no = Array.from(this.currentVote.votes.values()).filter((vote) => !vote).length;
        const total = yes + no;
        const percent = yes / total;

        for (const player of tmc.players.getAll()) {
            this.updateWidget(player.login, yes, no, total, percent);
        }

        await tmc.ui.displayManialinks(Object.values(this.widgets));
    }

    async updateWidget(login: string, yes: number = 0, no: number = 0, total: number = 0, percent: number = 0) {
        if (!this.currentVote) {
            this.hideWidgets();
            return;
        }

        let widget = this.widgets[login];
        
        if (!widget) {
            widget = new Widget("core/plugins/votes/widget.twig");
            widget.pos = { x: 0, y: 60 };
            widget.actions['yes'] = tmc.ui.addAction(this.vote.bind(this), true);
            widget.actions['no'] = tmc.ui.addAction(this.vote.bind(this), false);
            widget.recipient = login;
        }

        widget.setData({
            voted: this.currentVote.votes.get(login),
            yes,
            no,
            vote: this.currentVote,
            total,
            yes_ratio: percent,
            voteText: `${(await tmc.players.getPlayer(this.currentVote.starter)).nickname} asks ${processColorString(escape(this.currentVote.question))}`,
            time_percent: (this.currentVote.timeout - Date.now()) / (this.timeout * 1000),
            timer: formatTime(Math.floor(Math.abs(Date.now() - this.currentVote.timeout))).replace(/\.\d\d\d/, "")
        });

        this.widgets[login] = widget;
    }

    hideWidgets() {
        for (const login of Object.keys(this.widgets)) {
            this.widgets[login].destroy();
            delete this.widgets[login];
        }
    }

    cmdAdmExtend(_login: string, params: string[]) {
        this.extendCounter += 1;
        const seconds = params[0] ? parseInt(params[0]) : this.origTimeLimit;
        this.newLimit += seconds;
        tmc.server.send("SetTimeAttackLimit", this.newLimit * 1000);
        tmc.chat(`¤info¤Time limit extended by ¤white¤${seconds} ¤info¤seconds.`);
    }

    onVotePass(data: VoteStruct) {
        if (data.vote.type === "Skip") {
            tmc.server.send("NextMap");
            return;
        }
        if (data.vote.type === "Extend") {
            this.extendCounter += 1;
            this.newLimit += data.vote.value * 60;
            tmc.server.send("SetTimeAttackLimit", this.newLimit * 1000);
            return;
        }
    }

    onVoteDeny(data: VoteStruct) {

    }

    onVoteCancel(data: VoteStruct) {

    }
}