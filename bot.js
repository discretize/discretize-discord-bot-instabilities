require("dotenv").config();

const data = require("./data.json");
const mapping = require("./mappings");
const Discord = require("discord.js");
const client = new Discord.Client();

const CronJob = require("cron").CronJob;

/**
 *
 * @param {Number} level level of the fractal to query instabilities for
 * @param {Number} offset offset in days
 * @returns a formatted string of the instabilities for the required date
 */
const getInstabilities = (level, offset) => {
  // Calculate day of year https://stackoverflow.com/questions/8619879/javascript-calculate-the-day-of-the-year-1-366
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var diff =
    now -
    start +
    (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
  var oneDay = 1000 * 60 * 60 * 24;
  var day = Math.floor(diff / oneDay);

  const instabs = data.instabilities[level.toString()][day + offset];
  // Format it nicely
  return instabs.map((instab) => data.instability_names[instab]).join(" - ");
};

/**
 * finds out the t4 dailies for a given date.
 * @param {Date} targetDate the date to get t4 fractals for
 * @returns a list of the 3 t4 daily fractals
 */
const getT4Dailies = (targetDate) => {
  const day0 = mapping.ROTATION_START;
  const diffDays = Math.floor((targetDate - day0) / (1000 * 60 * 60 * 24));
  const rotationDay = diffDays % mapping.fractalRotation.length;
  const dailies = mapping.fractalRotation[rotationDay].map(
    (index) => mapping.fractals[index]
  );

  return dailies;
};

/**
 * Sends a discord embed to a given channel, which contains the daily fractals, cms and their corresponding instabilities.
 * @param {Object} channel The discord channel to send the embed to
 * @param {Number} offset date offset in days with base point in time today.
 */
const sendDaily = (channel, offset) => {
  var today = new Date();
  var future = new Date();
  future.setDate(today.getDate() + offset);

  const dailies = getT4Dailies(future);

  const embed = new Discord.MessageEmbed()
    .setColor("#00CCCC")
    .setTitle(
      `Instabilities for ${future.getFullYear()}-${
        future.getMonth() + 1
      }-${future.getDate()}`
    )
    .setURL(
      "https://github.com/discretize/discretize-discord-bot-instabilities"
    )
    .setThumbnail("http://old.discretize.eu/_/img/discretize-512.png")
    .addFields(
      { name: "Sunqua Peak", value: getInstabilities(100, offset) },
      { name: "Shattered Observatory", value: getInstabilities(99, offset) },
      { name: "Nightmare", value: getInstabilities(98, offset) }
    );

  dailies
    .filter((fractal) => !fractal.cm)
    .forEach((daily) => {
      embed.addField(
        `${daily.name} (lv.${daily.level})`,
        getInstabilities(daily.level, offset)
      );
    });
  channel.send(embed);
};

/**
 * Broadcasts the instabilities on reset to all servers in the #instabilities channel
 */
const broadcastInstabilities = () => {
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache.forEach((element) => {
      if (element.name === "instabilities") {
        sendDaily(element, 0);
      }
    });
  });
};

client.on("ready", () => {
  client.user.setActivity("instabilities", { type: "WATCHING" });
});

client.on("ready", () => {
  var job = new CronJob(
    "0 1 2 * * *",
    () => {
      broadcastInstabilities();
    },
    null,
    true,
    "Europe/Berlin"
  );
  job.start();
});

function sendHelp(channel) {
  channel.send(
    "```md\n**HELP MENU** - Discretize [dT] bot \n \
    - !today - shows today's instabilities\n \
    - !tomorrow - shows tomorrow's instabilities\n \
    - !in x - shows the instabilities in x days \
            ```"
  );
}

client.on("message", (message) => {
  if (message.content === "!today") {
    sendDaily(message.channel, 0);
  } else if (message.content === "!tomorrow") {
    sendDaily(message.channel, 1);
  } else if (message.content.startsWith("!in")) {
    function help(channel) {
      channel.send(
        "Invalid amount of days. Enter: `!in 7` to get the instabs in 7 days."
      );
    }

    let split = message.content.split(" ");
    if (split.length !== 2) {
      help(message.channel);
      return;
    }
    let offset = Number.parseInt(split[1], 10);
    if (Number.isNaN(offset)) {
      help(message.channel);
    } else {
      sendDaily(message.channel, offset);
    }
  } else if (message.content === "!help") {
    sendHelp(message.channel);
  }
});

client.login(process.env.BOT_TOKEN).then((r) => {
  console.log("Logged in");
});
