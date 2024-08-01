---
parent: Notes
title: Managing your notes
category: notes
permalink: /notes/management
---
# {{ page.title }}

At some stage I plan to add a management / admin page to the plugin where you can manage
all your existing shared notes.

For now, you can achieve a fairly good management view with [Dataview](https://github.com/blacksmithgu/obsidian-dataview).

Create a query like this:

````
```dataview
TABLE WITHOUT ID
  link(file.path, truncate(file.name, 28)) as Note,
  dateformat(share_updated, "yyyy-MM-dd") as "Shared on", 
  elink(share_link, regexreplace(share_link, "^.*?(\w+)(#.+?|)$", "$1")) as Link,
  choice(regextest("#", share_link), "🔒", "") as "🔒"
WHERE share_link
```
````

To sort with your most recent shares at the top, add `SORT share_updated DESC` under the WHERE line.

If everything worked you should see a table like this of your shared notes. The 🔒 icon indicates that a note was shared with encryption.

![](./note-management.png)
