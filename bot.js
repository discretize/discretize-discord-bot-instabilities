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

  const instabs =
    data.instabilities[level.toString()][(day + offset - 1) % 365];
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

const sendEmbed = (channel, date, fields) => {
  const embed = new Discord.MessageEmbed()
    .setColor("#00CCCC")
    .setTitle(
      `Instabilities for ${date.getFullYear()}-${
        date.getMonth() + 1
      }-${date.getDate()}`
    )
    .setURL(
      "https://github.com/discretize/discretize-discord-bot-instabilities"
    )
    .setThumbnail("http://old.discretize.eu/_/img/discretize-512.png")
    .addFields(...fields);

  channel.send(embed);
};

const sendT4s = (channel, offset) => {
  const instabs = mapping.fractals.map((fractal) => ({
    name: fractal.name,
    level: fractal.level,
    instabs: getInstabilities(fractal.level, offset),
  }));
  const date = new Date();
  date.setDate(date.getDate() + offset);

  channel.send(
    `All T4 fractals and there instabilities for ${date
      .toISOString()
      .slice(0, 10)}\n${instabs
      .map((frac) => `**${frac.name} (${frac.level})**: ${frac.instabs}`)
      .join("\n")}`
  );
};

const sendFilteredT4 = (channel, level, isWhitelist, instabs) => {
  const DAYS_AHEAD = 29;
  const matchingT4s = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const t4instabs = getInstabilities(level, i)
      .split("-")
      .map((instab) => instab.trim());

    const filtered = t4instabs.filter((value) => instabs.includes(value));
    const t4Object = { day: i, instabs: t4instabs.join(" - ") };
    if (isWhitelist && filtered.length === instabs.length) {
      matchingT4s.splice(-1, 0, t4Object);
    }
    if (!isWhitelist && filtered.length === 0) {
      matchingT4s.splice(-1, 0, t4Object);
    }
  }

  const listOfT4s = matchingT4s
    .sort((a, b) => a.day - b.day)
    .map((t4) => {
      const date = new Date();
      date.setDate(date.getDate() + t4.day);
      return `**${date.toISOString().slice(0, 10)}**: \t\t\t${t4.instabs}`;
    })
    .join("\n");
  channel.send(
    `All days for ${
      mapping.fractals.find((frac) => frac.level === level).name
    } ${
      isWhitelist ? "with" : "without"
    } the instabilities ${instabs}:\n${listOfT4s}`
  );
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

  const fields = [
    { name: "Sunqua Peak", value: getInstabilities(100, offset) },
    { name: "Shattered Observatory", value: getInstabilities(99, offset) },
    { name: "Nightmare", value: getInstabilities(98, offset) },
  ];

  dailies
    .filter((fractal) => !fractal.cm)
    .forEach((daily) => {
      fields.splice(0, 0, {
        name: `${daily.name} (lv.${daily.level})`,
        value: getInstabilities(daily.level, offset),
      });
    });
  sendEmbed(channel, future, fields);
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
    "0 1 0 * * *",
    () => {
      broadcastInstabilities();
    },
    null,
    true,
    "UTC"
  );
  job.start();
});

function sendHelp(channel) {
  channel.send(
    `\`\`\`md
**HELP MENU** - Discretize [dT] bot
  - !today - shows today's instabilities
  - !tomorrow - shows tomorrow's instabilities
  - !in x - shows the instabilities in x days
  - !filter <level> <with|without> <instabs>
  - !t4s <in|at> <offset|date>

Create a channel named #instabilities to receive daily updates on instabilities.
\`\`\``
  );
}

client.on("message", (message) => {
  if (message.content === "!today") {
    sendDaily(message.channel, 0);
  } else if (message.content.startsWith("!t4s")) {
    function help(channel) {
      channel.send(
        "Invalid command arguments. Enter: `!t4s at <YYYY-MM-DD>` to get a list of t4s for a given date and their instabilities"
      );
    }

    const args = message.content.split(" ");
    if (args.length !== 3) {
      help(message.channel);
      return;
    }

    let offset = 0;
    if (message.content.startsWith("!t4s at")) {
      const date = new Date(args[2]);

      var start = new Date();
      var diff = date - start;
      var oneDay = 1000 * 60 * 60 * 24;

      offset = Math.floor(diff / oneDay) + 1;
    } else if (message.content.startsWith("!t4s in")) {
      offset = Number.parseInt(args[2], 10);
      if (Number.isNaN(offset)) {
        help(message.channel);
        return;
      }
    }

    sendT4s(message.channel, offset);
  } else if (message.content === "!tomorrow") {
    sendDaily(message.channel, 1);
  } else if (message.content.startsWith("!filter")) {
    function help(channel) {
      channel.send(
        "Invalid command arguments. Enter: `!filter <Fractal Level> <'with' or 'without'> Instab1-Instab2-Instab3` to get a list of days that contain (or do not contain) the given instabs. Example: `!filter 76 without No Pain, No Gain-Flux Bomb`"
      );
    }
    const args = message.content.split(" ");
    const level = Number.parseInt(args[1]);
    if (Number.isNaN(level) || level < 76) {
      help(message.channel);
      return;
    }
    const isWhitelist = args[2] === "with";

    sendFilteredT4(
      message.channel,
      level,
      isWhitelist,
      args.splice(3).join(" ").split("-")
    );
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
