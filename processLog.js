const mappings = require('./mappings.js');
const Table = require('easy-table')
const humanFormat = require('human-format');
const prettyMilliseconds = require('pretty-ms');

exports.processLog = function (db, json, permalink) {

    if (!json.success && json.triggerID !== 23254) {
        return;
    }
    const date = json.timeStart;
    const boss_id = json.triggerID;
    const timer = json.phases[0].end;

    let dps_target = 0, dps_cleave = 0;

    json.players.forEach((player) => {
        dps_target += player.dpsTargets[0][0].dps;
        dps_cleave += player.dpsAll[0].dps;
    });

    db.insertGroupKill(boss_id, date, timer, dps_cleave, dps_target, permalink);

    json.players.forEach((player) => {
        const acc = player.account;
        const name = player.name;
        const spec = player.profession;

        db.insertPlayer(acc, name, spec);

        const dps_targetP = player.dpsTargets[0][0].dps;
        const dps_cleaveP = player.dpsAll[0].dps;

        db.insertPlayerKill(acc, name, spec, boss_id, date, timer, dps_targetP, dps_cleaveP);

    })
}

function toPercentile(num) {
    return (num * 100).toFixed(2) + "%ile";
}

exports.sendPercentileEmbed = function (Discord, channel, party, member, permalink) {

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
        t.cell("Name", member.acc);
        t.cell("Target", toPercentile(member.t_percentile));
        t.cell("Cleave", toPercentile(member.c_percentile));
        t.newRow();
        t.cell("Name", "   " + member.spec);
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

    channel.send(embed);
}