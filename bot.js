const instab = require("./instability.js");
const Discord = require("discord.js");

const client = new Discord.Client();
const csv = require("csv-parser");
const fs = require("fs");
const results = [];
var CronJob = require("cron").CronJob;


client.on("ready", () => {
    client.user.setActivity("Instabilities", {type: "WATCHING"});

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
            instab.sendMessage(Discord, results, client);
        },
        null,
        true,
        "Europe/Berlin"
    );
    job.start();
});

function sendHelp(channel) {
    channel.send(
        "```**HELP MENU** - Discretize [dT] bot \n \
    - !today - shows today's instabilities\n \
    - !tomorrow - shows tomorrow's instabilities\n \
            ```"
    );
}

client.on("message", (message) => {
    if (message.content === "!today") {
        console.log("Today asked by " + message.author.tag);
        instab.sendFromFile(Discord, results, message.channel, 0);
    } else if (message.content === "!tomorrow") {
        console.log("Tomorrow asked by " + message.author.tag);
        instab.sendFromFile(Discord, results, message.channel, 1);
    } else if (message.content === "!help") {
        sendHelp(message.channel);
    }
});
