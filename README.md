# Discretize Discord Instability Bot

The purpose of this discord bot is to display instabilities for fractals in the game guild wars 2.

There are several commands available:

- `!today` - Prints todays instabilities.
- `!tomorrow` - Prints tomorrows instabilities.
- `!in x` - Prints the instabilities in x days.
- `!filter <level> <with|without> <instabs> ` - Filters a given level for instabilities (upcoming 30 days) and prints a list of days that match the constraints.
- `!t4s <in|at> <offset|date>` - Prints out all t4 fractals for a given date.

Asides from providing the data when asked the bot will also notify every server that it has been added to. The broadcast happens at reset and is delivered in the `#instabilities` (mind the exact spelling) channel.

![Example printout](https://cdn.discordapp.com/attachments/504607260316663813/894177872565129236/unknown.png)

## Adding the bot to your own discord server

Click [here](https://discord.com/api/oauth2/authorize?client_id=502097175581556736&permissions=274877975552&scope=bot)

## Credits

This bot uses the [fractal instability data](https://github.com/Invisi/gw2-fotm-instabilities) collected by Invisi, which is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

## Privacy

This bot does not store, process, or collect any data whatsoever. However, the bot needs to listen to every message being sent to be able to reply appropriately. This can be verified fairly easily in the code. If you dont believe me, feel free to host the bot yourself.
