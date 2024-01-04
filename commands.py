import hikari
import json
import calendar
from datetime import date, datetime, timedelta
from itertools import chain
from serverdb import *

#
# Update rotation: 01/03/2023
#

# Json file containing the instability data
with open("data.json", "r") as file:
    instability_data = json.load(file)

# Json file for fractal names and rotation indexing
with open("mappings.json", "r") as file:
    fractal_data = json.load(file)

cms = [8, 9, 20, 21]
instablist = [
    "Adrenaline Rush",
    "Afflicted",
    "Boon Overload",
    "Flux Bomb",
    "Fractal Vindicators",
    "Frailty",
    "Hamstrung",
    "Last Laugh",
    "Mists Convergence",
    "No Pain, No Gain",
    "Outflanked",
    "Social Awkwardness",
    "Stick Together",
    "Sugar Rush",
    "Toxic Sickness",
    "Toxic Trail",
    "Vengeance",
    "We Bleed Fire",
]

help_command = """```md\nDiscretize [dT] Bot - Help menu
Bot now includes integrated slash commands. To ease use, you can tab or click options
\t - /today - Shows the instabilities for today
\t - /tomorrow - Shows the instabilities for tomorrow
\t - /in x - Shows the instabilities in x days
\t - /filter <level> <with_without> <instability_1> <instability_2>
\t - !logs - all logs that are in a message containing this command will be formatted pretty
If channel #instabilities is created, the bot will auto broadcast new instabilities every day at 02:00```"""


def get_day_of_year():
    day_of_year = datetime.now().timetuple().tm_yday
    return day_of_year


def get_rotation(day=0):
    current_rotation = date(2024, 1, 1) 
    rotation = (((date.today()+timedelta(day)) - current_rotation).days) % 15
    return rotation


def get_instabs(day):
    if get_day_of_year() > day and calendar.isleap(date.today().year) == False:
        rot_num = (get_day_of_year() + day) % 365
    elif get_day_of_year() > day and calendar.isleap(date.today().year) == True:
        rot_num = (get_day_of_year() + day) % 366
    else:
        rot_num = day - get_day_of_year()
    todays_instabilities = []
    for i in fractal_data["rotation"][get_rotation(rot_num)]:
        todays_instabilities.append(
            instability_data["instabilities"][
                f"{fractal_data['fractals'][i]['level']}"
            ][day]
        )

    todays_instabilities = list(chain(*todays_instabilities))
    return todays_instabilities


def assign_names(day):
    instab_names = []
    for i in get_instabs(day):
        instab_names.append(instability_data["instability_names"][i])
    return instab_names


def get_cm_instabs(day):
    cm_instabilities = []
    for i in cms:
        cm_instabilities.append(
            instability_data["instabilities"][
                f"{fractal_data['fractals'][i]['level']}"
            ][day]
        )

    cm_instabilities = list(chain(*cm_instabilities))
    return cm_instabilities


def assign_cm_names(day):
    cm_instab_names = []
    for i in get_cm_instabs(day):
        cm_instab_names.append(instability_data["instability_names"][i])
    return cm_instab_names


def filter_instabs(level, day):
    filtered_instabs = []
    names = []
    filtered_instabs.append(instability_data["instabilities"][f"{level}"][day - 1])
    filtered_instabs = list(chain(*filtered_instabs))
    for i in filtered_instabs:
        names.append(instability_data["instability_names"][i])
    return names


def send_instabilities(days=0):
    rotation_num = get_rotation(days) % 15
    in_x = get_day_of_year() + days
    if in_x > 365 and calendar.isleap(date.today().year) == False:
        in_x %= 365
    elif in_x > 366 and calendar.isleap(date.today().year) == True:
        in_x %= 366
    embed = hikari.Embed(
        title=f"Instabilities for {date.today()+timedelta(days)}", colour="#00cccc"
    )
    embed.set_thumbnail("https://discretize.eu/logo.png")
    for loop_count, i in enumerate(fractal_data["rotation"][rotation_num]):
        if i not in cms:
            embed.add_field(
                f"{fractal_data['fractals'][i]['name']} (lv.{fractal_data['fractals'][i]['level']})",
                " - ".join(
                    assign_names(in_x)[3 * (loop_count + 1) - 3 : 3 * (loop_count + 1)]
                ),
            )
    for loop_count, i in enumerate(cms):
        if i in fractal_data["rotation"][rotation_num]:
            embed.add_field(
                f"{fractal_data['fractals'][i]['name']} (daily)",
                " - ".join(
                    assign_cm_names(in_x)[
                        3 * (loop_count + 1) - 3 : 3 * (loop_count + 1)
                    ]
                ),
            )
        else:
            embed.add_field(
                f"{fractal_data['fractals'][i]['name']}",
                " - ".join(
                    assign_cm_names(in_x)[
                        3 * (loop_count + 1) - 3 : 3 * (loop_count + 1)
                    ]
                ),
            )
    return embed

def get_boss_emoji(name):
    temp = ""
    for i in spec_emojis.keys():
        if name.split()[0] in i: # split for Ai naming
            temp = f"{i}{spec_emojis[i]}"
    return temp
