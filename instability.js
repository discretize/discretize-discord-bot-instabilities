const mappings = require('./mappings');


function nToI(n) {
    return mappings.instabDict[parseInt(n, 10)];
}

function nToF(n) {
    return mappings.fractalDict[n];
}

function strToI(instabString) {
    let splitFrac1 = instabString.split(",");
    let splitFrac2;
    if (instabString.indexOf("/") > 0) {
        const tmpSplit = instabString.split("/");
        splitFrac1 = tmpSplit[0].split(",");
        splitFrac2 = tmpSplit[1].split(",");
    }

    return splitFrac2
        ? `${nToI(splitFrac1[1])} - ${nToI(splitFrac1[2])} - ${nToI(
            splitFrac1[3]
        )} __**OR**__ \n${nToI(splitFrac2[1])} - ${nToI(splitFrac2[2])} - ${nToI(
            splitFrac2[3]
        )}`
        : `${nToI(splitFrac1[1])} - ${nToI(splitFrac1[2])} - ${nToI(
            splitFrac1[3]
        )}`;
}

function generateEmbed(Discord, node) {
    function isCM(df) {
        return df.charAt(0) === "I" || df.charAt(0) === "J" || df.charAt(0) === "U";
    }

    const embed = new Discord.MessageEmbed()
        .setColor("#ff33cc")
        .setTitle("Instabilities for " + node.Date)
        .setURL("https://discretize.eu")
        .setThumbnail(
            "https://wiki.guildwars2.com/images/f/f6/Cracked_Fractal_Encryption.png"
        )
        .addFields(
            {name: "Sunqua Peak", value: strToI(node.CM3)},
            {name: "Shattered Observatory", value: strToI(node.CM2)},
            {name: "Nightmare", value: strToI(node.CM1)}
        )
        .setTimestamp();

    if (!isCM(node.DF1)) {
        embed.addField(nToF(node.DF1.charAt(0)), strToI(node.DF1));
    }
    if (!isCM(node.DF2)) {
        embed.addField(nToF(node.DF2.charAt(0)), strToI(node.DF2));
    }
    if (!isCM(node.DF3)) {
        embed.addField(nToF(node.DF3.charAt(0)), strToI(node.DF3));
    }

    return embed;
}

exports.sendFromFile = function(Discord, results, channel, offset) {
    const m = new Date().getMonth() + 1;
    const d = new Date().getDate() + offset;

    results.forEach((node) => {
        if (
            parseInt(m, 10) === parseInt(node.Date.split("-")[1], 10) &&
            parseInt(d, 10) === parseInt(node.Date.split("-")[0], 10)
        ) {
            console.log("Sent");
            //channel.send(generateClipboardText(node));
            channel.send(generateEmbed(Discord, node));
        }
    });
}

exports.sendMessage = function (Discord, client) {
    let guildOutput = "";
    client.guilds.cache.forEach((guild) => {
        guildOutput = guildOutput + (guild.name + ", ");
        guild.channels.cache.forEach((element) => {
            if (element.name === "instabilities") {
                this.sendFromFile(element, 0);
            }
        });
    });
    console.log("Notified: " + guildOutput);
}