Authentication flow:

- click extension icon
- enter your Zendesk domain
- click "Save Settings"

Redirects to a static github page

TODO:

- When published, removed the KEY from the manifest.json, and update the oath redirect url to the new generated one


Ticket Notifications Outline:
Tickets with Status = New
- status = New
- created_at 30 seconds or less since created
- group_id = "US Support Center"

Tickets with Status = Open
The team always want to know when a ticket is in the status open because it means that there is a conversation to be had with a customer.

- status = open
- updated_at 30 seconds or less since updated
- group_id = "US Support Center"

Logic and actions:

Critical
If one or more tickets with the status of "New" were created in the last 30 seconds (or dropdown time) and their group id is "US Support Center" then play a custom sound.

Nice
If one or more tickets with the status of "New" were created in the last 30 seconds (or dropdown time) and their group id is "US Support Center" then play a custom sound, contribute to the number on the icon and appear in the notification "X new tickets".

Critical
If one or more tickets with the status of "Open" were updated in the last 30 seconds (or dropdown time) and their group id is "US Support Center" then play a custom sound.

Nice
If one or more tickets with the status of "Open" were updated in the last 30 seconds (or dropdown time) and their group id is "US Support Center" then play a custom sound, contribute to the number on the icon and appear in the notification "X open tickets".