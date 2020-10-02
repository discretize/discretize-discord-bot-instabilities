const db = require("./database.js");
const processLog = require("./processLog.js");
const instab = require('./instability.js');

const getUrls = require('get-urls');
const request = require('request');

const Discord = require("discord.js");

const client = new Discord.Client();
const csv = require("csv-parser");
const fs = require("fs");
const results = [];
var CronJob = require("cron").CronJob;

client.on("ready", () => {
    client.user.setActivity("Healbrands", {type: "WATCHING"});

    fs.createReadStream("instabs.csv")
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => {
        });
});

client.on("ready", () => {
    var job = new CronJob(
        "0 1 2 * * *",
        () => {
            instab.sendMessage(Discord, client);
        },
        null,
        true,
        "Europe/Berlin"
    );
    job.start();
});

client.on("message", (message) => {
    if (message.content === "!today") {
        console.log("Today asked by " + message.author.tag);
        instab.sendFromFile(Discord, results, message.channel, 0);
    } else if (message.content === "!tomorrow") {
        console.log("Tomorrow asked by " + message.author.tag);
        instab.sendFromFile(Discord, results, message.channel, 1);
    }
});

client.login(process.env.BOT_TOKEN);
db.connect();

client.on("message", (message) => {
    if (message.content.startsWith("!upload")) {
        const urls = getUrls(message.content);
        urls.forEach((value) => {
            if (value.startsWith("https://dps.report/")) {
                let permalink = value.substr(19);

                request('https://dps.report/getJson?permalink=' + permalink, {json: true}, (err, res, body) => {
                    if (err) {
                        return console.log(err);
                    }
                    processLog.processLog(db, body, permalink);
                    db.partyPercentile(permalink, function (party, members) {
                        processLog.sendPercentileEmbed(Discord, message.channel, party, members, permalink);
                    });
                });
            }
        });
    } else if (message.content.startsWith("!percentile")) {
        const urls = getUrls(message.content);
        urls.forEach((value) => {
            if (value.startsWith("https://dps.report/")) {
                let permalink = value.substr(19);
                db.partyPercentile(permalink, function (party, members) {
                    processLog.sendPercentileEmbed(Discord, message.channel, party, members, permalink);
                });
            }
        });
    }
})