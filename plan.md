GNOME has a Do Not Disturb option. However, it can only be manually triggered. 

Our plan: create an extension that enables the user to schedule DND mode. The user can schedule DND to occur:

A) On a schedule (e.g., every day from 10 PM to 7 AM)
B) Based on calendar events (e.g., automatically enable DND during meetings)

The schedules will be customizable, allowing users to set their preferred times and days for DND mode. Schedule can be repeated daily, weekly, or on specific days of the week.

For calendar events, we need to allow the user to select which calendar to monitor. Then, we can set a pattern to enable DND mode during events that match certain criteria (e.g., events with a specific keyword in the title or events from a specific calendar). This should be easy for the user to configure, such as:

Pattern: Contains / Starts With / Ends With / Matches Regex
Enable DND: At event time / X minutes before event / X minutes after event
Disable DND: At event end / X minutes before event end / X minutes after event end

There should be an easy to use prefs pane for the user to do all this. 

If at all possible, we add these as options within GNOME's quick settings button. If that's a no-go, we just use extension prefs instead. 

There are rules you need to follow:

1) The extension must be compatible with the latest version of GNOME - i.e. GNOME 50.
2) The uuid is com.keithvassallo.smart-dnd
3) Follow the rules at ~/LocalCode/docs/antislop.md so your code isn't shite.
4) Follow the rules at ~/LocalCode/docs/ext_rev.md so your extension passes review.
5) Install the Shexli static code analyzer and ensure that your code passes all checks. This is crucial for maintaining code quality and avoiding common pitfalls.

Your job:
- Start by fleshing out a proper plan for this extension.
- We need the UX to be simple and aesthetically pleasing, with clear instructions for users to set up their DND schedules and calendar event triggers, without overloading them with text. 
