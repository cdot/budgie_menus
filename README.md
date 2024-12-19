# Budgie Menus
Due to the paucity of documentation for menus in Budgie, I decided to
write a bit of code that would help me understand them.

Applications in budgie menus are built from application definitions
located in .desktop files, found by looking at directories named
"applications" on the path defined by $XDG_DATA_DIRS. If
$XDG_DATA_DIRS is not set, then the default path /usr/share/ is
used.

User specific desktop entries may be located at
$XDG_DATA_HOME/applications, which is always searched first. If
$XDG_DATA_HOME is not set, then the default path ~/.local/share is
used.

The search of $XDG_DATA_DIRS is left to right. The first .desktop file
with a given filename takes precedence over any later file with the same name.
.desktop files define a `Name` key for the application, but these names
can be duplicated (used in several .desktop files); only the filename of
the .desktop file has to be unique.

Submenu definitions are found by looking at directories named
"desktop-directories" in the same $XDG_DATA_DIRS path. Unlike
applications, duplicate submenu definitions don't override, they
just result in another submenu with the same name.

Some Categories are renamed by the window system before they appear
on a menu, so when you add a .desktop file that references the category
"Utility", the menu entry will end up in "Accessories". This appears
to be hard-coded.

This app can be used alongside menulibre (another example of a useful
bit of code let down by piss-poor documentation) and a bit of manual
tweaking of user-specific .desktop files, to create and maintain your
own menus.

Budgie also makes use of "Categories" to categorise applications into menus.
These are predefined application types (see https://specifications.freedesktop.org/menu-spec/latest/) that may work for a lot of people. You can also add your own categories, and create a .directory file for them to create a submenu. Use an existing .directory file as a template.
```
USAGE
    node explore_menus.js [options] <command> [<what>]
COMMANDS
    check - check the menus for consistency
    cat <what> - find entries in category 'what'
	app <what> - find the entry for the application 'what'.
    'what' can be either the menu item, or the full filename of the
    .desktop file
OPTIONS
	-d,--debug - generate debug info
```