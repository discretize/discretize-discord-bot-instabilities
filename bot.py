import hikari
import lightbulb
from lightbulb.ext import tasks
from lightbulb.ext.tasks import CronTrigger
import os
import calendar
import pytz
from datetime import date, datetime, timedelta
from commands import *
from dotenv import load_dotenv
import re
import requests
import json
from datetime import datetime


load_dotenv()

bot = lightbulb.BotApp(token=os.getenv("BOT_TOKEN"))
tasks.load(bot)


@bot.listen(hikari.StartedEvent)  # event in hikari
async def bot_started(event):
    print("Bot has started")
    await bot.update_presence(
        status=hikari.Status.ONLINE,
        activity=hikari.Activity(
            type=hikari.ActivityType.WATCHING, name="instabilities"
        ),
    )


# Will remove this notification after a month or two
@bot.listen()
async def temporary_info(event: hikari.GuildMessageCreateEvent) -> None:
    if event.is_bot or not event.content:
        return
    legacy_commands = ["!today", "!tomorrow", "!in", "!filter", "!t4s", "!help"]
    for i in legacy_commands:
        if event.content.startswith(f"{i}"):
            await event.message.respond(
                "The prefix commands have been discontinued, please use slash (/today, /tomorrow, /in, /filter)\nFor more info type /help"
            )


@bot.listen(hikari.GuildMessageCreateEvent)
async def prettier_logs(event: hikari.GuildMessageCreateEvent) -> None:

    if event.is_bot or not event.content:
        return

    if "!logs" not in event.content:
        return

    # order of the logs
    encounter_order = [17021, 17028, 16948, 17632, 17949, 17759, 23254, 23254]

    def get_order(log_element):
        _log = log_element["log_content"]
        # special case for ai, thanks arenanet :peepoSpecial:
        if _log["triggerID"] == 23254:
            if "Dark" in _log["fightName"]:
                return 7
            return 6
        return encounter_order.index(_log["triggerID"])

    def is_cm_clear(log_elements):
        copy = encounter_order
        for _log in log_elements:
            trigger_id = _log["log_content"]["triggerID"]
            if trigger_id in encounter_order:
                encounter_order.remove(_log["log_content"]["triggerID"])
        return len(copy) == 0

    # find all dps.report urls in the message
    dps_report_urls = re.findall(r"https://dps\.report/[a-zA-Z-\d_]*", event.content)
    logs = []
    for log_link in dps_report_urls:
        permalink = log_link.replace("https://dps.report/", "")
        url = f"https://dps.report/getJson?permalink={permalink}"
        req = requests.get(url)
        logs.append({"log_link": log_link, "log_content": json.loads(req.content)})

    logs.sort(key=get_order)

    if len(logs) == 0:
        return

    start_time = min(map(lambda elem: elem["log_content"]["timeStart"] + "00", logs))
    start_time = datetime.strptime(
        start_time, "%Y-%m-%d %H:%M:%S %z"
    )

    finish_time = max(map(lambda elem: elem["log_content"]["timeEnd"] + "00", logs))
    finish_time = datetime.strptime(
        finish_time, "%Y-%m-%d %H:%M:%S %z"
    )

    embed = hikari.Embed(
        title=f"Logs - {start_time.strftime('%Y-%m-%d')}", colour="#00cccc"
    )
    embed.set_thumbnail("https://discretize.eu/logo.png")

    if is_cm_clear(logs):
        embed.set_footer(f"CMs cleared in {finish_time-start_time}")

    for log in logs:
        name = log["log_content"]["fightName"]
        duration = log["log_content"]["duration"]
        embed.add_field(
            f"{name} - {duration}",
            log["log_link"],
        )
    await event.message.delete()
    await event.message.respond(embed)


# Daily broadcast of daily fractals and their instabilities in #instabilities channel
@tasks.task(CronTrigger("1 0 * * *"))  # UTC time
async def daily_instabilities_broadcast():
    reset = datetime.now().replace(hour=0, minute=0, second=0, tzinfo=pytz.utc)
    reset_end = datetime.now().replace(hour=0, minute=5, second=0, tzinfo=pytz.utc)
    if datetime.now(pytz.utc) >= reset and datetime.now(pytz.utc) <= reset_end:
        async for i in bot.rest.fetch_my_guilds():
            guild = i.id
            channels = await bot.rest.fetch_guild_channels(guild)
            for j in channels:
                if j.name == "instabilities":
                    await bot.rest.create_message(
                        channel=j.id, content=send_instabilities()
                    )


daily_instabilities_broadcast.start()


@bot.command
@lightbulb.command("help", "Shows list of commands")
@lightbulb.implements(lightbulb.SlashCommand)
async def help(ctx):
    await ctx.respond(help_command)


@bot.command
@lightbulb.command("today", "Shows today instabilities")
@lightbulb.implements(lightbulb.SlashCommand)
async def today(ctx):
    await ctx.respond(send_instabilities())


@bot.command
@lightbulb.command("tomorrow", "Shows instabilities for tomorrow")
@lightbulb.implements(lightbulb.SlashCommand)
async def tomorrow(ctx):
    await ctx.respond(send_instabilities(1))


@bot.command
@lightbulb.option("days", "Input the number of days", type=int)
@lightbulb.command("in", "Shows instabilities in x days")
@lightbulb.implements(lightbulb.SlashCommand)
async def in_x(ctx):
    await ctx.respond(send_instabilities(ctx.options.days))


# Try to shorten this mess of a code for filter command in future


@bot.command
@lightbulb.option("level", "Input the desired level to be filtered", type=int)
@lightbulb.option(
    "with_without",
    "Select whether you want to include or exclude instabilities",
    required=False,
    default="without",
    choices=["with", "without"],
)
@lightbulb.option(
    "instability_2",
    "Input the desired instability to filter out",
    required=False,
    choices=instablist,
)
@lightbulb.option(
    "instability_1",
    "Input the desired instability to filter out",
    required=False,
    choices=instablist,
)
@lightbulb.command("filter", "Filters the desired level with or without instabilities")
@lightbulb.implements(lightbulb.SlashCommand)
async def filter(ctx):
    filter_message = ""
    curr_date = date.today()
    day = get_day_of_year() + 1
    filter_message += f"Filtered instabilities for **{ctx.options.level}**:\n"

    if ctx.options.with_without == "with":
        for i in range(30):
            if ctx.options.instability_1 != None and ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(
                    ctx.options.level, day
                ) and ctx.options.instability_2 in filter_instabs(
                    ctx.options.level, day
                ):
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level, day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
                else:
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
                    continue
            elif ctx.options.instability_1 != None or ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(
                    ctx.options.level, day
                ) or ctx.options.instability_2 in filter_instabs(
                    ctx.options.level, day
                ):
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level, day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
                else:
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
                    continue
            else:
                curr_date += timedelta(1)
                if day > 365 and calendar.isleap(date.today().year) == False:
                    day -= 365
                elif day > 366 and calendar.isleap(date.today().year) == True:
                    day -= 366
                else:
                    day += 1
                continue
        await ctx.respond(filter_message)
    else:
        for i in range(30):
            if ctx.options.instability_1 != None and ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(
                    ctx.options.level, day
                ) and ctx.options.instability_2 in filter_instabs(
                    ctx.options.level, day
                ):
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
                    continue
                else:
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level, day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
            elif ctx.options.instability_1 != None or ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(
                    ctx.options.level, day
                ) or ctx.options.instability_2 in filter_instabs(
                    ctx.options.level, day
                ):
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
                    continue
                else:
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level, day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year) == False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year) == True:
                        day -= 366
                    else:
                        day += 1
            else:
                filter_message += f"**{curr_date}**:\t"
                for j in filter_instabs(ctx.options.level, day):
                    filter_message += j + " - "
                filter_message = filter_message[:-3]
                filter_message += "\n"
                curr_date += timedelta(1)
                if day > 365 and calendar.isleap(date.today().year) == False:
                    day -= 365
                elif day > 366 and calendar.isleap(date.today().year) == True:
                    day -= 366
                else:
                    day += 1
        await ctx.respond(filter_message)


bot.run()
