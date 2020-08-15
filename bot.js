const Discord = require("discord.js");
const client = new Discord.Client();
const csv = require("csv-parser");
const fs = require("fs");
const results = [];
var CronJob = require("cron").CronJob;

const instabDict = {
  1: "Adrenaline Rush",
  2: "Afflicted",
  3: "Boon Overload",
  4: "Flux Bomb",
  5: "Fractal Vindicators",
  6: "Frailty",
  7: "Hamstrung",
  8: "Last Laugh",
  9: "Mists Convergence",
  10: "No Pain, No Gain",
  11: "Outflanked",
  12: "Social Awkwardness",
  13: "Stick Together",
  14: "Sugar Rush",
  15: "Toxic Trail",
  16: "Vengeance",
  17: "We Bleed Fire",
};

const fractalDict = {
  A: "Aetherblade",
  B: "Aquatic Ruins",
  C: "Captain Mai Trin",
  D: "Chaos Isles",
  E: "Cliffside",
  F: "Deepstone",
  G: "Molten Boss",
  H: "Molten Furnace",
  I: "Nightmare",
  J: "Shattered Observatory",
  K: "Sirens Reef",
  L: "Snowblind",
  M: "Solid Ocean",
  N: "Swampland",
  O: "Thaumnova Reactor",
  P: "Twilight Oasis",
  Q: "Uncategorized",
  R: "Underground Facility",
  S: "Urban Battleground",
  T: "Volcanic",
};

client.on("ready", () => {
  client.user.setActivity("Healbrands", { type: "WATCHING" });

  fs.createReadStream("instabs.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {});
});

client.on("ready", () => {
  var job = new CronJob(
    "0 1 2 * * *",
    () => {
      sendMessage();
    },
    null,
    true,
    "Europe/Berlin"
  );
  job.start();
});

function nToI(n) {
  return instabDict[parseInt(n, 10)];
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

function generateClipboardText(node) {
  let str = `__Instabilities on ${node.Date}:__\n**99CM**: 99cmi\n**100CM**: 100cmi\n**name1**: df1\n**name2**: df2\n**name3**: df3`;

  function replaceUndefined(string) {
    let tmpStr = string.replace(
      "**undefined**: undefined - undefined - undefined",
      ""
    );
    tmpStr = tmpStr.replace(
      "**Nightmare**: undefined - undefined - undefined",
      ""
    );
    tmpStr = tmpStr.replace(
      "**Shattered Observatory**: undefined - undefined - undefined",
      ""
    );
    return tmpStr;
  }

  str = str.replace("99cmi", strToI(node.CM1));
  str = str.replace("100cmi", strToI(node.CM2));
  str = str.replace("name1", fractalDict[node.DF1.charAt(0)]);
  str = str.replace("df1", strToI(node.DF1));
  str = str.replace("name2", fractalDict[node.DF2.charAt(0)]);
  str = str.replace("df2", strToI(node.DF2));
  str = str.replace("name3", fractalDict[node.DF3.charAt(0)]);
  str = str.replace("df3", strToI(node.DF3));

  return replaceUndefined(str);
}

function generateEmbed(node) {
  function isCM(df) {
    return df.charAt(0) === "I" || df.charAt(0) === "J";
  }
  const embed = new Discord.MessageEmbed()
    .setColor("#ff33cc")
    .setTitle("Instabilities for " + node.Date)
    .setURL("https://discretize.eu")
    .setThumbnail(
      "https://wiki.guildwars2.com/images/f/f6/Cracked_Fractal_Encryption.png"
    )
    .addFields(
      { name: "Shattered Observatory", value: strToI(node.CM2) },
      { name: "Nightmare", value: strToI(node.CM1) }
    )
    .setTimestamp();

  if (!isCM(node.DF1)) {
    embed.addField(fractalDict[node.DF1.charAt(0)], strToI(node.DF1));
  }
  if (!isCM(node.DF2)) {
    embed.addField(fractalDict[node.DF2.charAt(0)], strToI(node.DF2));
  }
  if (!isCM(node.DF3)) {
    embed.addField(fractalDict[node.DF3.charAt(0)], strToI(node.DF3));
  }
  return embed;
}

function sendFromFile(channel, offset) {
  const m = new Date().getMonth() + 1;
  const d = new Date().getDate() + offset;

  results.forEach((node) => {
    if (
      parseInt(m, 10) === parseInt(node.Date.split("-")[1], 10) &&
      parseInt(d, 10) === parseInt(node.Date.split("-")[0], 10)
    ) {
      console.log("Sent");
      //channel.send(generateClipboardText(node));
      channel.send(generateEmbed(node));
    }
  });
}

function sendMessage() {
  let guildOutput = "";
  client.guilds.cache.forEach((guild) => {
    guildOutput = guildOutput + (guild.name + ", ");
    guild.channels.cache.forEach((element) => {
      if (element.name === "instabilities") {
        sendFromFile(element, 0);
      }
    });
  });
  console.log("Notified: " + guildOutput);
}

client.on("message", (message) => {
  if (message.content === "!today") {
    console.log("Today asked by " + message.author.tag);
    sendFromFile(message.channel, 0);
  } else if (message.content === "!tomorrow") {
    console.log("Tomorrow asked by " + message.author.tag);
    sendFromFile(message.channel, 1);
  }
});

client.login("NTAyMDk3MTc1NTgxNTU2NzM2.W8csbw.2km34ZuC4IBKruuZM0Q7an9O8Bo");
