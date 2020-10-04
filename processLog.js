const mappings = require('./mappings.js');
const Table = require('easy-table')
const humanFormat = require('human-format');
const prettyMilliseconds = require('pretty-ms');

function toPercentile(num) {
    return (num * 100).toFixed(1) + "%ile";
}

exports.getPersonPercentileEmbed = function (Discord, acc, result) {
    const embed = new Discord.MessageEmbed()
        .setColor("#43ff00")
        .setTitle("Percentiles for " + acc)
        .setURL("https://discretize.eu")
        .setThumbnail(
            "https://discretize.eu/logo.png"
        )
        .setTimestamp();

    let map = new Map;
    result.forEach((elem) => {
        if (map[elem.spec] === undefined) {
            map[elem.spec] = [];
        }
        map[elem.spec].push(elem);
    })

    let desc = ""
    for (const key in map) {
        desc += key + "\n";
        var t = new Table;
        map[key].forEach((boss) => {
            t.newRow();
            t.cell("Boss:", mappings.bosses[boss.boss_id]);
            t.cell("50%ile", humanFormat(boss.T50));
            t.cell("90%ile", humanFormat(boss.T90));
            t.cell("99%ile", humanFormat(boss.T99));
            t.newRow();
            t.cell("50%ile", humanFormat(boss.C50));
            t.cell("90%ile", humanFormat(boss.C90));
            t.cell("99%ile", humanFormat(boss.C99));
            t.newRow();
        })
        desc += "``` " + t.toString() + "```"
        desc += "\n";
    }
    embed.setDescription(desc)
    console.log(desc)
    return embed;
}

exports.getPercentileEmbed = function (Discord, party, member, permalink) {

    const embed = new Discord.MessageEmbed()
        .setColor("#43ff00")
        .setTitle(mappings.bosses[party.boss_id] + " " + permalink)
        .setURL("https://dps.report/" + permalink)
        .setThumbnail(
            "https://discretize.eu/logo.png"
        )
        .setTimestamp();

    var t = new Table;
    member.forEach((member) => {
        t.newRow();
        t.cell("Name", member.acc.substr(0, member.acc.length - 5));
        t.cell("Target", toPercentile(member.t_percentile));
        t.cell("Cleave", toPercentile(member.c_percentile));
        t.newRow();
        t.cell("Name", " " + member.spec);
        t.cell("Target", humanFormat(member.dps_target));
        t.cell("Cleave", humanFormat(member.dps_cleave));
        t.newRow();
    });
    let desc = ""
    desc += "**Duration: **     " + prettyMilliseconds(party.timer) + "\n";
    desc += "**Target DPS: ** " + humanFormat(party.dps_target) + " (" + toPercentile(party.t_percentile) + ")\n";
    desc += "**Cleave DPS: ** " + humanFormat(party.dps_cleave) + " (" + toPercentile(party.c_percentile) + ")\n";

    desc += "```" + t.toString() + "```";

    embed.setDescription(desc);
    return embed;
}