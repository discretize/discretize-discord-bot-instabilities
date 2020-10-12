const db = require("./database.js");
const processLog = require("./processLog.js");
const instab = require("./instability.js");

const http = require("http");
const getUrls = require("get-urls");
const request = require("request");

const Discord = require("discord.js");

const client = new Discord.Client();
const csv = require("csv-parser");
const fs = require("fs");
const results = [];
var CronJob = require("cron").CronJob;

const port = process.env.PORT || 3000;

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

function sendHelp(channel) {
    channel.send(
        "```**HELP MENU** - Discretize [dT] bot \n \
    - !today - shows todays instabilities\n \
    - !tomorrow - shows tomorrows instabilities\n \
    - !upload <optional: categories> <dps.report link> - uploads a log\n \
    - !percentiles <dps.report link> - shows percentiles for a log\n \
    - !verify <api-key> - api-key must be named dtlogbot \n \
    - !addcategory <dps.report link> - adds categories to logs to filter\
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

function uploadLogs(urls, message) {
    const categories = getCategories(message.content, 1);

    urls.forEach((value) => {
        if (value.startsWith("https://dps.report/")) {
            let permalink = value.substr(19);

            request(
                "https://dps.report/getJson?permalink=" + permalink,
                {json: true},
                (err, res, body) => {
                    if (err) {
                        return console.log(err);
                    }
                    db.insertLog(body, permalink);
                    categories.forEach((cat) => {
                        db.addCategory(permalink, cat);
                    });
                    message.react("👍");
                }
            );
        } else {
            message.channel.send("Message is not a valid dps.report link: " + value);
        }
    });
}

client.on("message", (message) => {
    let args = message.content.split(" ");

    if (args[0].toLowerCase() === "!upload") {
        let urls = [];
        if (message.attachments.size > 0) {
            message.attachments.mapValues((v, k) => {
                request.get(v.attachment, function (error, resp, body) {
                    if (!error && resp.statusCode === 200) {
                        urls = getUrls(body);
                        uploadLogs(urls, message);
                    }
                });
            });
        } else {
            uploadLogs(getUrls(message.content), message);
        }
    } else if (args[0].toLowerCase() === "!stats") {
        if (args.length <= 1) {
            // display help
            sendHelp(message.channel);
            return;
        }
        switch (args[1].toLowerCase()) {
            case "category":
                const categories = getCategories(message.content, 2);

                db.allPercentiles(categories, (results) => {
                    message.channel.send(
                        processLog.getPersonPercentileEmbed(
                            Discord,
                            categories.toString(),
                            results
                        )
                    );
                });
                break;
            case "self":
                // give info about personal percentages for verified users
                db.isVerified(message.author.tag, function (result) {
                    if (result.length === 1) {
                        if (result[0].verified) {
                            db.personPercentile(result[0].acc, function (res2) {
                                message.channel.send(
                                    processLog.getPersonPercentileEmbed(
                                        Discord,
                                        result[0].acc,
                                        res2
                                    )
                                );
                            });
                        }
                    } else {
                        message.channel.send(
                            "Your account is not verified yet! Use !verify <api key>!"
                        );
                    }
                });
                break;
            case "log":
                const urls = getUrls(message.content);
                urls.forEach((value) => {
                    if (value.startsWith("https://dps.report/")) {
                        let permalink = value.substr(19);
                        db.partyPercentile(permalink, function (party, members) {
                            let embed = processLog.getPercentileEmbed(
                                Discord,
                                party,
                                members,
                                permalink
                            );
                            message.channel.send(embed);
                        });
                    } else {
                        message.channel.send(
                            "Message is not a valid dps.report link: " + value
                        );
                    }
                });
                break;
        }
    } else if (args[0].toLowerCase() === "!addcategory") {
        const urls = getUrls(message.content);
        const categories = getCategories(message.content, 1);
        urls.forEach((value) => {
            if (value.startsWith("https://dps.report/")) {
                let permalink = value.substr(19);
                categories.forEach((cat) => {
                    db.addCategory(permalink, cat);
                });
                message.react("👍");
            } else {
                message.channel.send(
                    "Message is not a valid dps.report link: " + value
                );
            }
        });
    } else if (args[0].toLowerCase() === "!verify") {
        if (args.length === 1) {
            message.channel.send("Invalid API Key");
            return;
        }
        const api = args[1];

        request(
            "https://api.guildwars2.com/v2/tokeninfo?access_token=" + api,
            {json: true},
            (err, res, body) => {
                if (body.name === "dtlogbot") {
                    request(
                        "https://api.guildwars2.com/v2/account?access_token=" + api,
                        {json: true},
                        (err, res, body2) => {
                            db.verify(body2.name, message.author.tag);
                            message.react("👍");
                        }
                    );
                } else {
                    message.channel.send(
                        "Invalid API-Key name! It must be named 'dtlogbot' not " + body.name
                    );
                }
            }
        );
    }
});

function getCategories(cnt, start) {
    let categories = [];
    const split = cnt.split(" ");
    if (split.length === start) {
        return categories;
    }
    let i = start;
    while (true) {
        if (i === split.length) {
            break;
        }
        if (split[i].startsWith("https://")) {
            break;
        }
        categories.push(split[i]);
        i++;
    }
    return categories;
}

client.login(process.env.BOT_TOKEN);
db.connect();

const server = http.createServer((req, res) => {
    if (req.method !== "GET") {
        res.end(`{"error": "${http.STATUS_CODES[405]}"}`);
    } else {
        if (req.url === "/getDiscordRanks") {
            res.setHeader("Content-Type", "application/json");
            client.guilds.fetch(process.env.DT_DISCORD_ID)
                .then(guild => {
                    guild.members.fetch().then(members => {
                        let grind_count = 0;
                        let trial_count = 0;
                        for (let i = 0; i < members.array().length; i++) {
                            let v = members.array()[i];
                            v.roles.cache.forEach((e) => {
                                if (e.name === "Grind") {
                                    grind_count++;
                                }
                                if (e.name === "Trial") {
                                    trial_count++;
                                }
                            })
                        }
                        let a = JSON.stringify({grind_count: grind_count, trial_count: trial_count});
                        res.writeHead(200);
                        res.end(a);
                    })
                })
                .catch(console.error);
        }else{
            res.statusCode = 404
            res.end(`{"error": "404"}`)
        }
    }
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
