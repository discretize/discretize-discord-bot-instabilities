import hikari
import lightbulb
from lightbulb.ext import tasks
from lightbulb.ext.tasks import CronTrigger
import json
import os
import calendar
from datetime import date, datetime, timedelta
from itertools import chain
from dotenv import load_dotenv

load_dotenv()

bot = lightbulb.BotApp(token = os.getenv('BOT_TOKEN'))
tasks.load(bot)

# Current rotation is 28th of February 2022 (day of EoD release). Rotation index 1

# Json file containing the instability data
with open("data.json","r") as file:
    instability_data = json.load(file)

# Json file for fractal names and rotation indexing    
with open("mappings.json","r") as file:
    fractal_data = json.load(file)

# CM indexes in mappings.json   
cms=[8,9,20]

help_command = """```md\nDiscretize [dT] Bot - Help menu
Bot now includes integrated slash commands. To ease use, you can tab or click options
\t - /today - Shows the instabilities for today
\t - /tomorrow - Shows the instabilities for tomorrow
\t - /in x - Shows the instabilities in x days
\t - /filter <level> <with_without> <instability_1> <instability_2>
If channel #instabilities is created, the bot will auto broadcast new instabilities every day at 01:00```"""

def get_day_of_year():
    day_of_year = datetime.now().timetuple().tm_yday
    return day_of_year

def get_rotation():
    current_rotation = date(2022, 2, 28) # 28th of February 2022
    rotation = (date.today()-current_rotation).days
    while rotation > 15:
        rotation -= 15
    return rotation
        


def get_instabs(day):
    todays_instabilities = []
    for i in fractal_data['rotation'][get_rotation()]: 
        todays_instabilities.append(instability_data['instabilities'][f"{fractal_data['fractals'][i]['level']}"][day])
        
    todays_instabilities = list(chain(*todays_instabilities))
    return todays_instabilities
    
def assign_names(day):
    instab_names = []
    for i in get_instabs(day):
        instab_names.append(instability_data['instability_names'][i])
    return instab_names

    
def get_cm_instabs(day):
    cm_instabilities = []
    for i in cms:
        cm_instabilities.append(instability_data['instabilities'][f"{fractal_data['fractals'][i]['level']}"][day])
        
    cm_instabilities = list(chain(*cm_instabilities))
    return cm_instabilities
    
def assign_cm_names(day):
    cm_instab_names = []
    for i in get_cm_instabs(day):
        cm_instab_names.append(instability_data['instability_names'][i])
    return cm_instab_names

def filter_instabs(level,day):
    filtered_instabs = []
    names = []
    filtered_instabs.append(instability_data['instabilities'][f"{level}"][day-1])
    filtered_instabs = list(chain(*filtered_instabs))
    for i in filtered_instabs:
        names.append(instability_data['instability_names'][i])
    return names

def send_instabilities(days=0):
    rotation_num = get_rotation()+days
    while rotation_num >= 15:
        rotation_num -= 15
    in_x=get_day_of_year()+days
    if in_x > 365 and calendar.isleap(date.today().year) == False:
        in_x -= 365
    elif in_x > 366 and calendar.isleap(date.today().year) == True:
        in_x -= 366
    get_instabs(in_x)
    get_cm_instabs(in_x)
    assign_names(in_x)
    assign_cm_names(in_x)
    embed = hikari.Embed(title=f"Instabilities for {date.today()+timedelta(days)}",colour="#00cccc")
    embed.set_thumbnail("https://discretize.eu/logo.png")
    for loop_count, i in enumerate(fractal_data['rotation'][rotation_num]):
        if i not in cms:
            embed.add_field(f"{fractal_data['fractals'][i]['name']} (lv.{fractal_data['fractals'][i]['level']})", " - ".join(assign_names(in_x)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    for loop_count, i in enumerate(cms):
        if i in fractal_data['rotation'][rotation_num]:
            embed.add_field(f"{fractal_data['fractals'][i]['name']} (daily)"," - ".join(assign_cm_names(in_x)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
        else:
            embed.add_field(f"{fractal_data['fractals'][i]['name']}"," - ".join(assign_cm_names(in_x)[3 * (loop_count+1)-3 : 3 * (loop_count+1)]))
    return embed

@bot.listen(hikari.StartedEvent) # event in hikari
async def bot_started(event):
    print("Bot has started")
    await bot.update_presence(status=hikari.Status.ONLINE, activity=hikari.Activity(type=hikari.ActivityType.WATCHING, name="instabilities"))
    

# Will remove this notification after a month or two
@bot.listen()
async def temporary_info(event: hikari.GuildMessageCreateEvent) -> None:
    if event.is_bot or not event.content:
        return    
    legacy_commands = ["!today","!tomorrow","!in","!filter","!t4s","!help"]
    for i in legacy_commands:
        if event.content.startswith(f"{i}"):
            await event.message.respond("The prefix commands have been discontinued, please use slash (/today, /tomorrow, /in, /filter)\nFor more info type /help")
            
# Daily broadcast of daily fractals and their instabilities in #instabilities channel

@tasks.task(CronTrigger("0 0 * * *")) # cron is using UTC time
async def daily_instabilities_broadcast():
    reset = datetime.now().replace(hour=0, minute=59, second=0) # bandaid solution 
    reset_end = datetime.now().replace(hour=1, minute=5, second=0)
    if datetime.now() >= reset and datetime.now() <= reset_end: 
        async for i in bot.rest.fetch_my_guilds():
            guild = i.id
            channels = await bot.rest.fetch_guild_channels(guild)
            for j in channels:
                if j.name == "instabilities":
                    await bot.rest.create_message(channel=j.id,content=send_instabilities())

daily_instabilities_broadcast.start()
    
@bot.command
@lightbulb.command("help","Shows list of commands")
@lightbulb.implements(lightbulb.SlashCommand)
async def help(ctx):
    await ctx.respond(help_command)

@bot.command
@lightbulb.command("today","Shows today instabilities")
@lightbulb.implements(lightbulb.SlashCommand)
async def today(ctx):
    await ctx.respond(send_instabilities())


@bot.command
@lightbulb.command("tomorrow","Shows instabilities for tomorrow")
@lightbulb.implements(lightbulb.SlashCommand)
async def tomorrow(ctx):
    await ctx.respond(send_instabilities(1))
    

@bot.command
@lightbulb.option("days", "Input the number of days",type=int)
@lightbulb.command("in","Shows instabilities in x days")
@lightbulb.implements(lightbulb.SlashCommand)
async def in_x(ctx):
    await ctx.respond(send_instabilities(ctx.options.days))


# Try to shorten this mess of a code for filter command in future

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
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) and ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
                else:
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
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
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
                else:
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
                    continue
            else:
                curr_date += timedelta(1)
                if day > 365 and calendar.isleap(date.today().year)==False:
                    day -= 365
                elif day > 366 and calendar.isleap(date.today().year)==True:
                    day -= 366
                else:
                    day += 1
                continue
        await ctx.respond(filter_message) 
    else:
        for i in range(30):
            if ctx.options.instability_1 != None and ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) and ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
                    continue
                else:
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
            elif ctx.options.instability_1 != None or ctx.options.instability_2 != None:
                if ctx.options.instability_1 in filter_instabs(ctx.options.level,day) or ctx.options.instability_2 in filter_instabs(ctx.options.level,day):
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
                    continue
                else:
                    filter_message += f"**{curr_date}**:\t"
                    for j in filter_instabs(ctx.options.level,day):
                        filter_message += j + " - "
                    filter_message = filter_message[:-3]
                    filter_message += "\n"
                    curr_date += timedelta(1)
                    if day > 365 and calendar.isleap(date.today().year)==False:
                        day -= 365
                    elif day > 366 and calendar.isleap(date.today().year)==True:
                        day -= 366
                    else:
                        day += 1
            else:
                filter_message += f"**{curr_date}**:\t"
                for j in filter_instabs(ctx.options.level,day):
                    filter_message += j + " - "
                filter_message = filter_message[:-3]
                filter_message += "\n"
                curr_date += timedelta(1)
                if day > 365 and calendar.isleap(date.today().year)==False:
                    day -= 365
                elif day > 366 and calendar.isleap(date.today().year)==True:
                    day -= 366
                else:
                    day += 1
        await ctx.respond(filter_message)   

@bot.command
@lightbulb.command("time","Show time")
@lightbulb.implements(lightbulb.SlashCommand)
async def time(ctx):
    t = datetime.now()    
    await ctx.respond(t)
    
bot.run()
