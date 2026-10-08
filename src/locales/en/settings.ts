/** Settings: account, appearance, household, meal plan, pantry and export. */
export default {
  mine: 'My settings',
  household: 'Household',
  ownerOnly: 'Only the owner can change the household settings.',
  changeFailed: 'The change was not saved.',
  account: {
    title: 'Account',
    household: 'Household: {name} · {people} in the family',
    loggedIn:
      'Signed in as {email}. Signing out makes this browser forget you, so you will need to sign in again next time.',
    logout: 'Sign out',
  },
  appearance: {
    title: 'Appearance',
    aria: 'Light or dark appearance',
    system: 'Match device',
    light: 'Light',
    dark: 'Dark',
  },
  density: {
    title: 'Interface density',
    aria: 'Size of fields, buttons, lists and tables',
    compact: 'Compact',
    comfortable: 'Comfortable',
    default: 'Spacious',
    hint: 'Applies on a computer. On a phone the interface is always compact.',
  },
  plan: {
    title: 'Meal plan',
    slots: 'Meals of the day',
    slotsHint: 'Turned-off meals are hidden in the plan while they are empty.',
    weekStart: 'Week starts on',
    weekdays: { monday: 'Monday', sunday: 'Sunday', saturday: 'Saturday' },
    childPortion: 'Default child portion',
    factorTimesAdult: '{factor} × adult',
    childPortionHint: 'Used when you add a new child in the "At the table" section.',
  },
  capture: {
    title: 'Add a recipe from the web with one click',
    bookmarkTitle: 'Browser bookmark (easiest)',
    bookmarkText:
      'Works in any browser, nothing to install. Drag the button below to your bookmarks bar. When you are on a recipe page, click that bookmark and the recipe is loaded into the Cookbook.',
    bookmarkButton: 'To the cookbook',
    bookmarkHint:
      'Do not click the button here, just drag it to the bookmarks bar (or right-click it and choose "Add bookmark").',
    extensionTitle: 'Chrome extension',
    extensionText: 'An icon in the Chrome toolbar that adds the recipe on the open page with one click.',
    extensionDownload: 'Download the extension (.zip)',
    step1: 'Unzip the downloaded file into a folder.',
    step2: 'In Chrome open chrome://extensions and turn on "Developer mode".',
    step3: 'Click "Load unpacked" and choose the unzipped folder.',
    step4: 'In the extension settings (they open by themselves) paste this app address:',
    copyAddress: 'Copy the app address',
    copied: 'The address is copied.',
    copyFailed: 'The address could not be copied.',
  },
  others: {
    title: 'Recipes from others',
    label: 'Show recipes from others',
    hint: 'Public recipes of other households appear in Recipes and on Home together with yours. You can hide them in the filter at any time.',
  },
  kids: {
    title: 'Baby food recipes',
    label: 'Show baby food recipes',
    hint: 'Porridges, purees and first foods. When off, baby food recipes are hidden across the whole app (list, planning, suggestions) and the Baby and toddler category is not offered.',
  },
  pantry: {
    title: 'Pantry and recipes',
    ignoreSpices: 'Ignore spices in “What can I cook”',
    ignoreSpicesHint:
      'Spices do not count as missing, so you will also see recipes you can cook without them.',
  },
  export: {
    title: 'Backup and export',
    intro:
      'A backup downloads all recipes, meal plans and lists as a JSON file; we recommend doing it once a month. You can also download recipes as a readable text file (Markdown). You can print to PDF from a recipe, the meal plan and the shopping list in the Print menu; choose Save as PDF in the print window.',
    exportData: 'Export data',
    recipesMarkdown: 'Recipes as Markdown',
    exported: 'Export downloaded.',
    recipesExported: 'Recipes downloaded.',
    failed: 'The export failed.',
    recipesFailed: 'The recipe export failed.',
  },
}
