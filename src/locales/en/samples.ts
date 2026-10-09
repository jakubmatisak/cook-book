/** Basic recipes in Settings: packs by category, adding and removing. */
export default {
  title: 'Basic recipes',
  text: 'Typical Slovak recipes split into packs. Add or remove each pack separately; you can edit the recipes afterwards. Recipes you already have are not duplicated and your own recipes are never deleted when a pack is removed.',
  status: '{imported} of {total}',
  add: 'Add',
  remove: 'Remove',
  groups: {
    ranajky: 'Breakfast',
    desiata: 'Snack',
    olovrant: 'Afternoon snack',
    vecera: 'Dinner',
    polievky: 'Soups',
    hlavne: 'Main courses',
    salaty: 'Salads and sides',
    dezerty: 'Desserts',
    kids: 'Baby food (porridges and purees up to 18 months)',
  },
  removeDialog: {
    title: 'Remove the {group} pack?',
    text: '{recipes} from this pack will be deleted, including their meals in the plan. Your own recipes stay.',
    confirm: 'Remove',
  },
  added: 'Added: {recipes}.',
  none: 'You already have all recipes from this pack.',
  removed: 'Removed: {recipes}.',
}
