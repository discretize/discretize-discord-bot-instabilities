import hikari
import lightbulb
from lightbulb.ext import tasks
from lightbulb.ext.tasks import CronTrigger
import json
import os
from datetime import date, datetime, timedelta
from itertools import chain
from dotenv import load_dotenv

load_dotenv()

bot = lightbulb.BotApp(token = os.getenv('DISCORD_TOKEN'))

# Current rotation is 28th of February 2022 (day of EoD release). Rotation index 1

# Json file containing the instability data
with open("data.json","r") as file:
    x = json.load(file)

# Json file for fractal names and rotation indexing    
with open("mappings.json","r") as file:
    y = json.load(file)

# CM indexes in mappings.json   
cms=[8,9,20]


def get_day_of_year():
    day_of_year = datetime.now().timetuple().tm_yday
    return day_of_year

def get_rotation():
    current_rotation = date(2022, 2, 28).timetuple().tm_yday # 28th of February 2022
    rotation = get_day_of_year()-current_rotation
    while rotation > 15:
        rotation -= 15
    return rotation
        


def get_instabs(day):
    todays_instabilities = []
    for i in y['rotation'][get_rotation()]: 
        todays_instabilities.append(x['instabilities'][f"{y['fractals'][i]['level']}"][day])
        
    todays_instabilities = list(chain(*todays_instabilities))
    return todays_instabilities
    
def assign_names(day):
    instab_names = []
    for i in get_instabs(day):
        instab_names.append(x['instability_names'][i])
    return instab_names

    
def get_cm_instabs(day):
    cm_instabilities = []
    for i in cms:
        cm_instabilities.append(x['instabilities'][f"{y['fractals'][i]['level']}"][day])
        
    cm_instabilities = list(chain(*cm_instabilities))
    return cm_instabilities
    
def assign_cm_names(day):
    cm_instab_names = []
    for i in get_cm_instabs(day):
        cm_instab_names.append(x['instability_names'][i])
    return cm_instab_names

def filter_instabs(level,day):
    filtered_instabs = []
    names = []
    filtered_instabs.append(x['instabilities'][f"{level}"][day-1])
    filtered_instabs = list(chain(*filtered_instabs))
    for i in filtered_instabs:
        names.append(x['instability_names'][i])
    return names


@bot.listen(hikari.StartedEvent) # event in hikari
async def bot_started(event):
    print("Bot has started")
    await bot.update_presence(status=hikari.Status.ONLINE, activity=hikari.Activity(type=hikari.ActivityType.WATCHING, name="instabilities"))


# Daily broadcast of instabilities in #instabilities channel

@tasks.task(CronTrigger("1 1 * * *"),auto_start=True)
async def daily_instabilities_broadcast():
    today_instabs=get_day_of_year()
    get_instabs(today_instabs)
    get_cm_instabs(today_instabs)
    assign_names(today_instabs)
    assign_cm_names(today_instabs)
    embed = hikari.Embed(title=f"Instabilities for {date.today()}",colour="#00cccc")
    embed.set_thumbnail("https://discretize.eu/logo.png")
    for loop_count, i in enumerate(y['rotation'][get_rotation()]):
        if i not in cms:
            embed.add_field(f"{y['fractals'][i]['name']} (lv.{y['fractals'][i]['level']})", " - ".join(assign_names(today_instabs)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    for loop_count, i in enumerate(cms):
        embed.add_field(f"{y['fractals'][i]['name']}"," - ".join(assign_cm_names(today_instabs)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    async for i in bot.rest.fetch_my_guilds():
        guild = i.id
        channels = await bot.rest.fetch_guild_channels(guild)
        for j in channels:
            if j.name == "instabilities":
                await bot.rest.create_message(channel=j.id,content=embed)

    
@bot.command
@lightbulb.command("help","Shows list of commands")
@lightbulb.implements(lightbulb.SlashCommand)
async def help(ctx):
    await ctx.respond("```md\nHelp menu - Discretize [dT] Bot\n\t- /today - shows today's instabilities\n\t- /tomorrow - shows tomorrow's instabilities\n\t- /in x - shows the instabilities in x days\n\t- /filter <level> <with|without> <instabs>\n\t- /t4s <in|at> <offset|date>\n\nCreate a channel named #instabilities to receive daily updates on instabilities.```")

@bot.command
@lightbulb.command("today","Shows today instabilities")
@lightbulb.implements(lightbulb.SlashCommand)
async def today(ctx):
    today_instabs=get_day_of_year()
    get_instabs(today_instabs)
    get_cm_instabs(today_instabs)
    assign_names(today_instabs)
    assign_cm_names(today_instabs)
    embed = hikari.Embed(title=f"Instabilities for {date.today()}",colour="#00cccc")
    embed.set_thumbnail("https://discretize.eu/logo.png")
    for loop_count, i in enumerate(y['rotation'][get_rotation()]):
        if i not in cms:
            embed.add_field(f"{y['fractals'][i]['name']} (lv.{y['fractals'][i]['level']})", " - ".join(assign_names(today_instabs)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    for loop_count, i in enumerate(cms):
        embed.add_field(f"{y['fractals'][i]['name']}"," - ".join(assign_cm_names(today_instabs)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    await ctx.respond(embed)


@bot.command
@lightbulb.command("tomorrow","Shows instabilities for tomorrow")
@lightbulb.implements(lightbulb.SlashCommand)
async def tomorrow(ctx):
    tomorrow_instab=get_day_of_year()+1
    get_instabs(tomorrow_instab)
    get_cm_instabs(tomorrow_instab)
    assign_names(tomorrow_instab)
    assign_cm_names(tomorrow_instab)
    embed = hikari.Embed(title=f"Instabilities for {date.today()+timedelta(1)}",colour="#00cccc")
    embed.set_thumbnail("https://discretize.eu/logo.png")
    for loop_count, i in enumerate(y['rotation'][get_rotation()+1]):
        if i not in cms:
            embed.add_field(f"{y['fractals'][i]['name']} (lv.{y['fractals'][i]['level']})", " - ".join(assign_names(tomorrow_instab)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    for loop_count, i in enumerate(cms):
        embed.add_field(f"{y['fractals'][i]['name']}"," - ".join(assign_cm_names(tomorrow_instab)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    await ctx.respond(embed)
    

@bot.command
@lightbulb.option("days", "Input the number of days",type=int)
@lightbulb.command("in","Shows instabilities in x days")
@lightbulb.implements(lightbulb.SlashCommand)
async def in_x(ctx):
    rotation_num = get_rotation()+ctx.options.days
    while rotation_num >= 15:
        rotation_num -= 15
    in_x=get_day_of_year()+ctx.options.days
    get_instabs(in_x)
    get_cm_instabs(in_x)
    assign_names(in_x)
    assign_cm_names(in_x)
    embed = hikari.Embed(title=f"Instabilities for {date.today()+timedelta(ctx.options.days)}",colour="#00cccc")
    embed.set_thumbnail("https://discretize.eu/logo.png")
    for loop_count, i in enumerate(y['rotation'][rotation_num]):
        if i not in cms:
            embed.add_field(f"{y['fractals'][i]['name']} (lv.{y['fractals'][i]['level']})", " - ".join(assign_names(in_x)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    for loop_count, i in enumerate(cms):
        embed.add_field(f"{y['fractals'][i]['name']}"," - ".join(assign_cm_names(in_x)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    await ctx.respond(embed)


@bot.command
@lightbulb.option("level","Input the desired level to be filtered",type=int)
@lightbulb.option("with_without","Select whether you want to include or exclude instabilities",required=False,default="without",choices=["with","without"])
@lightbulb.option("instability_2","Input the desired instability to filter out",required=False,choices=["Adrenaline Rush","Afflicted","Boon Overload","Flux Bomb","Fractal Vindicators","Frailty","Hamstrung","Last Laugh","Mists Convergence","No Pain, No Gain","Outflanked","Social Awkwardness","Stick Together","Sugar Rush","Toxic Sickness","Toxic Trail","Vengeance","We Bleed Fire"])
@lightbulb.option("instability_1","Input the desired instability to filter out",required=False,choices=["Adrenaline Rush","Afflicted","Boon Overload","Flux Bomb","Fractal Vindicators","Frailty","Hamstrung","Last Laugh","Mists Convergence","No Pain, No Gain","Outflanked","Social Awkwardness","Stick Together","Sugar Rush","Toxic Sickness","Toxic Trail","Vengeance","We Bleed Fire"])
@lightbulb.command("filter","Filters the desired level with or without instabilities")
@lightbulb.implements(lightbulb.SlashCommand)
async def filter(ctx):
    filter_message = ""
    curr_date = date.today()
    day = get_day_of_year()+1
    if ctx.options.instability_1 != None and ctx.options.instability_2 != None and ctx.options.with_without == "without":
        filter_message += f"Filtered instabilities for **{ctx.options.level}** without **{ctx.options.instability_1}** and **{ctx.options.instability_2}** instabilities:\n"
    elif (ctx.options.instability_1 != None or ctx.options.instability_2 != None) and ctx.options.with_without == "without":
        if ctx.options.instability_1 != None:
            filter_message += f"Filtered instabilities for **{ctx.options.level}** without the **{ctx.options.instability_1}** instability:\n"
        else:
            filter_message += f"Filtered instabilities for **{ctx.options.level}** without the **{ctx.options.instability_2}** instability:\n"
    elif ctx.options.instability_1 != None and ctx.options.instability_2 != None and ctx.options.with_without == "with":
        filter_message += f"Filtered instabilities for **{ctx.options.level}** with **{ctx.options.instability_1}** and **{ctx.options.instability_2}** instabilities:\n"
    elif (ctx.options.instability_1 != None or ctx.options.instability_2 != None) and ctx.options.with_without == "with":
        if ctx.options.instability_1 != None:
            filter_message += f"Filtered instabilities for **{ctx.options.level}** with the **{ctx.options.instability_1}** instability:\n"
        else:
            filter_message += f"Filtered instabilities for **{ctx.options.level}** with the **{ctx.options.instability_2}** instability:\n"
    else:
        filter_message += f"Filtered instabilities for **{ctx.options.level}**:\n"
    
    if ctx.options.with_without == "with":
        for i in range(30):
            if ctx.options.instability_1 != None and ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) or ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    day += 1
                else:
                    curr_date += timedelta(1)
                    day += 1
                    continue
            elif ctx.options.instability_1 != None or ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) or ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    day += 1
                else:
                    curr_date += timedelta(1)
                    day += 1
                    continue
            else:
                curr_date += timedelta(1)
                day += 1
                continue
        await ctx.respond(filter_message) 
    else:
        for i in range(30):
            if ctx.options.instability_1 != None and ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) or ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    curr_date += timedelta(1)
                    day += 1
                    continue
                else:
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    day += 1
            elif ctx.options.instability_1 != None or ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) or ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    curr_date += timedelta(1)
                    day += 1
                    continue
                else:
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    day += 1
            else:
                filter_message += f"**{curr_date}**:\t"
                for j in filter_instabs(ctx.options.level,day):
                    filter_message += j + " - "
                filter_message = filter_message[:-3]
                filter_message += "\n"
                curr_date += timedelta(1)
                day += 1
        await ctx.respond(filter_message)   
    

tasks.load(bot)
bot.run()
