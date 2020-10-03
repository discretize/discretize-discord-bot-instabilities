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
            instab.sendMessage(Discord, results, client);
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
    } else if (message.content === "!help") {
        message.channel.send("```**HELP MENU** - Discretize [dT] bot \n \
- !today - shows todays instabilities\n \
- !tomorrow - shows tomorrows instabilities\n \
- !upload <optional: categories> <dps.report link> - uploads a log\n \
- !percentiles <dps.report link> - shows percentiles for a log\n \
- !verify <api-key> - api-key must be named dtlogbot \n \
- !addcategory <dps.report link> - adds categories to logs to filter\
        ```");
    }
});

client.login(process.env.BOT_TOKEN);
db.connect();

client.on("message", (message) => {
    if (message.content.startsWith("!upload")) {
        const urls = getUrls(message.content);
        const categories = getCategories(message.content);

        urls.forEach((value) => {
            if (value.startsWith("https://dps.report/")) {
                let permalink = value.substr(19);

                request('https://dps.report/getJson?permalink=' + permalink, {json: true}, (err, res, body) => {
                    if (err) {
                        return console.log(err);
                    }
                    db.insertLog(body, permalink);
                    categories.forEach((cat) => {
                        db.addCategory(permalink, cat);
                    });
                    message.react("👍");
                });
            } else {
                message.channel.send("Message is not a valid dps.report link: " + value);
            }
        });
    } else if (message.content.startsWith("!percentile")) {
        if (message.content.split(" ").length > 1) {
            const urls = getUrls(message.content);
            urls.forEach((value) => {
                if (value.startsWith("https://dps.report/")) {
                    let permalink = value.substr(19);
                    db.partyPercentile(permalink, function (party, members) {
                        let embed = processLog.getPercentileEmbed(Discord, party, members, permalink);
                        message.channel.send(embed);
                    });
                } else {
                    message.channel.send("Message is not a valid dps.report link: " + value);
                }
            });
        } else {
            // give info about personal percentages for verified users
            db.isVerified(message.author.tag, function (result) {
                if (result.length === 1) {
                    if (result[0].verified) {
                        db.personPercentile(result[0].acc, function (res2) {
                            message.channel.send(processLog.getPersonPercentileEmbed(Discord, result[0].acc, res2));
                        });
                    }
                } else {
                    message.channel.send("Your account is not verified yet! Use !verify <api key>!")
                }
            });
        }
    } else if (message.content.startsWith("!addcategory")) {
        const urls = getUrls(message.content);
        const categories = getCategories(message.content);
        urls.forEach((value) => {
            if (value.startsWith("https://dps.report/")) {
                let permalink = value.substr(19);
                categories.forEach((cat) => {
                    db.addCategory(permalink, cat);
                })
                message.react("👍");
            } else {
                message.channel.send("Message is not a valid dps.report link: " + value);
            }
        });
    } else if (message.content.startsWith("!verify")) {
        const split = message.content.split(" ");
        if (split.length === 1) {
            message.channel.send("Invalid API Key");
            return;
        }
        const api = message.content.split(" ")[1];

        request("https://api.guildwars2.com/v2/tokeninfo?access_token=" + api, {json: true}, (err, res, body) => {
            if (body.name === 'dtlogbot') {
                request("https://api.guildwars2.com/v2/account?access_token=" + api, {json: true}, (err, res, body2) => {
                    db.verify(body2.name, message.author.tag)
                    message.react("👍");
                });
            } else {
                message.channel.send("Invalid API-Key name! It must be named 'dtlogbot' not " + body.name);
            }
        });
    }
})

function getCategories(cnt) {
    let categories = [];
    const split = cnt.split(" ");
    if (split.length === 1) {
        return categories;
    }
    let i = 1;
    while (true) {
        if (split[i].startsWith("https://")) {
            break;
        }
        categories.push(split[i]);
        i++;
    }
    return categories;
}