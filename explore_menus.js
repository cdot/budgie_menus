// Due to the paucity of documentation for menus in Budgie, I decided to
// write a bit of code that would help understand them.
//
// Applications in budgie menus are built from application definitions
// located in .desktop files, found by looking at directories named
// "applications" on the path defined by $XDG_DATA_DIRS. If
// $XDG_DATA_DIRS is not set, then the default path /usr/share/ is
// used.
//
const XDG_DATA_DIRS = process.env.XDG_DATA_DIRS ?? "/usr/share";
//
// User specific desktop entries may be located at
// $XDG_DATA_HOME/applications, which is always searched first. If
// $XDG_DATA_HOME is not set, then the default path ~/.local/share is
// used.
//
const XDG_DATA_HOME =
      process.env.XDG_DATA_HOME ?? `${process.env.HOME}/.local/share`;
//
// The search of $XDG_DATA_DIRS is left to right. The first .desktop file
// with a given name takes precedence over any later file with the same name.
//
// Submenu definitions are found by looking at directories named
// "desktop-directories" in the same $XDG_DATA_DIRS path. Unlike
// applications, duplicate submenu definitions don't override, they
// just result in another submenu with the same name.
//
const Fs = require("fs").promises;
const Path = require("path");

const DATA_DIRS = `${XDG_DATA_HOME}:${XDG_DATA_DIRS}`.split(":");
console.log("Search path", DATA_DIRS);

// Some Categories are renamed by the window system before they appear
// on a menu, so when you add a .desktop file that references the category
// "Utility", the menu entry will end up in "Accessories". This appears
// to be hard-coded.
const RENAME_CATEGORY = {
  Utility: "Accessories",
  System: "System Tools"
};

// Some Categories are reserved and can be ignored by this application
const RESERVED_CATEGORIES = {
  Sceensaver: true, TrayIcon: true, Applet: true, Shell: true
};

// Map from entry filename to entry
const entries = [];

// Lists of entries in each known category
const categories = {};

// A map of directories (submenu) Name to the entry that overrides them
const directories = {};

// Regex that defines keys in .desktop files that we can ignore when
// compraing the files.
const IGNORE_CHECK = /^(Comment|_Path|_File|Categories|GenericName\[|Name\[)/;

/**
 * Make sure all keys in the other entry are consistent with chosen.
 * The other entry may have been updated by a system installation.
 * @param {string} file the filename e.g floon.desktop
 * @param {object} chosen the entry that is dominating
 * @param {object} other the entry that was found later in the search (and
 * was probably installed with the package)
 */
function crossCheckEntry(file, chosen, other) {
  const mismatches = [];
  for (const key of Object.keys(other)) {
    if (IGNORE_CHECK.exec(key))
      continue;
    if (other[key] != chosen[key])
      mismatches.push(key);
  }

  if (mismatches.length > 0) {
    console.error(`Warning: ${file} is overridden, but keys don't match`);
    console.error(`+=${Path.join(chosen._Path, file)}`);
    console.error(`-=${Path.join(other._Path, file)}`);
    for (const key of mismatches) {
      if (chosen[key])
        console.error(`+${key}=${chosen[key]}`);
      if (other[key])
        console.error(`-${key}=${other[key]}`);
    }
  }
}

/**
 * Load a .desktop or .directory format file. The parse is stupid,
 * it just looks for Key=Value.
 * @param {string} path path to the directory
 * @param {string} file file within the directory
 * @return {object} an object containing all the keys defined in the
 * file
 */
function loadDesktopFile(path, file) {
  return Fs.readFile(Path.join(path, file), { encoding: 'utf8' })
  .then(content => {
    const lines = content.split(/\r?\n/);
    const entry = {};
    for (const line of lines) {
      const match = /^(.*?)=(.*)$/.exec(line);
      if (match)
        entry[match[1]] = match[2];
    }
    return entry;
  });
}

/**
 * Load and analyse a .desktop file. If the file defines an application
 * it records it in the global list of entries and extracts the categories,
 * building a lookup. 
 * @param {string} path path to the directory
 * @param {string} file file within the directory
 * @return {Promise} a promise that resolves to undefined
 */
function analyseApplication(path, file) {
  return loadDesktopFile(path, file)
  .then(entry => {
    if (entry.Type == "Application") {
      if (!entry.NoDisplay) {
        console.debug(`\tLoading ${entry.Name} from ${file}`);
        entry._Path = path;
        entry.Categories = (entry.Categories ?? "Other")
        .split(";")
        .filter(c => c && c.length > 0)
        .filter(c => !RESERVED_CATEGORIES[c]);

        if (entries[file])
          if (!crossCheckEntry(file, entries[file], entry))
            return;

        entries[file] = entry;
        for (let c of entry.Categories) {
          if (RENAME_CATEGORY[c])
            c = RENAME_CATEGORY[c];
          if (!categories[c]) {
            console.debug(`\tCategory '${c}'`);
            categories[c] = [ entry ];
          } else
            categories[c].push(entry);
        }
      }
    }
  });
}

/**
 * Load and analyse a .directory file. This just checks for the
 * case where a user file overrides a package installed file.
 * @param {string} path path to the directory
 * @param {string} file file within the directory
 * @return {Promise} a promise that resolves to undefined
 */
function analyseDirectory(path, file) {
  return loadDesktopFile(path, file)
  .then(entry => {
    if (directories[entry.Name])
      console.error("Warning: Duplicate submenu ", entry.Name,
                    "is defined in ",
                    Path.join(directories[entry.Name]._Path,
                              directories[entry.Name]._File),
                    "and also in",
                    Path.join(path, file));
    else {
      entry._File = file;
      entry._Path = path;
      directories[entry.Name] = path;
    }
  });
}

/**
 * Format a category for output.
 * @param {string} name the index of the category in the global categories
 * @return {string} the category description
 */
function formatCategory(name) {
  const category = categories[name];
  if (!category)
    return `Unknown category '${name}'`;
  return `${name} is used in ${category.map(entry => entry.Name).join(", ")}`;
}

/**
 * Format an application entry for output.
 * @param {string} name the index of the entry in the global entries
 * @return {string} the application description
 */
function formatEntry(name) {
  let entry = entries[name];
  if (!entry) {
    for (const e of Object.keys(entries)) {
      if (entries[e].Name === name) {
        name = e;
        entry = entries[e];
        break;
      }
    }
    if (!entry)
      return `Can't find a .desktop file for '${name}'`;
  }
  return `${entry.Name} is defined in ${Path.join(entry._Path, name)}`;
}

/**
 * Scan a /applications directory and analyse the .desktop files
 * therein
 * @param {string} dir path to the directory
 */
function scanAppsDir(dir) {
  console.debug("Scanning", dir);
  return Fs.readdir(dir)
  .then(files => {
    if (dir == "/usr/share/applications") {
      const cunt = files.filter(f => /\.desktop$/.test(f));
      if (cunt.indexOf("org.gnome.clocks.desktop") < 0)
        throw new Error("FUCK");
    }
    let promises = Promise.resolve();
    for (const file of files.filter(f => /\.desktop$/.test(f))) {
      promises = promises
      .then(() => analyseApplication(dir, file));
    }
    return promises;
  })
  .catch(e => {
    console.debug(e);
  });
}

/**
 * Scan a /desktop-directories directory and analyse the .directory files
 * therein
 * @param {string} dir path to the directory
 */
function scanMenuDir(dir) {
  console.debug("Scanning", dir);
  return Fs.readdir(dir)
  .then(files => {
    let promises = Promise.resolve();
    for (const file of files)
      if (/\.directory$/.test(file)) {
        promises = promises
        .then(() => analyseDirectory(dir, file));
      }
    return promises;
  })
  .catch(e => {
    //console.error(e);
  });
}

// Build a promise to load and check the menu tree
let promises = Promise.resolve();
for (const datadir of DATA_DIRS) {
  promises = promises
  .then(() => scanAppsDir(Path.join(datadir, "applications")))
  .then(() => scanMenuDir(Path.join(datadir, "desktop-directories")));
}

const DESCRIPTION = [
  "**",
  "DESCRIPTION",
  "\tDump desktop files used to build Budgie menus",
  "USAGE",
  `\tnode ${Path.relative(".", process.argv[1])} [options] <command> [<what>]`,
  "COMMANDS",
  "\tcheck - check the menus for consistency",
  "\tcat <what> - find entries in category 'what'",
  "\tapp <what> - find the entry for the application 'what'. 'what' can be either the menu item, or the full filename of the .desktop file",
  "OPTIONS",
  "\t-d,--debug - generate debug info"
].join("\n");

let debug = false, command, what;
for (let i = 2; i < process.argv.length; i++) {
  switch (process.argv[i]) {
  case "-d": case "--debug":
    debug = true;
    break;
  default:
    if (command) {
      if (what)
        throw new Error(`Already got <what> for ${command}${DESCRIPTION}`);
      what = process.argv[i];
    } else
      command = process.argv[i];
  }
}

if (!debug) console.debug = () => {};

// Run the promise to build the menu tree, and execute whatever command
// is required.
promises
.then(() => {
  switch (command) {
  case "check": // check is a side effect of promises
    console.log("Check finished");
    break;
  case "cat": // Describe a category
    if (!what)
      throw new Error(`cat <what>\n${DESCRIPTION}`);
    console.log(formatCategory(what));
    break;
  case "app": // Describe an application
    if (!what)
      throw new Error(`entry <what>\n${DESCRIPTION}`);
    console.log(formatEntry(what));
    break;
  default:
    throw new Error(`Unknown command '${command}'${DESCRIPTION}`);
  }
});
