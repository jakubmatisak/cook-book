/** Public recipes: list, detail, copying into your own household and publishing a recipe. */
export default {
  title: 'Public recipes',
  subtitle: 'Recipes shared by households in the app. You can add them to your own recipes.',
  search: 'Search by name',
  categories: 'Meal type',
  by: 'From: {name}',
  mine: 'Your recipe',
  public: 'Public',
  empty: {
    title: 'Nothing here yet',
    text: 'A household owner can publish a recipe from its menu (the three dots on the recipe).',
  },
  emptyFiltered: { title: 'Nothing found', text: 'Try another word or meal type.' },
  detail: {
    from: 'Shared by: {name}',
    copy: 'Add to my recipes',
    copied: 'The recipe is in your recipes.',
    open: 'Open',
    alreadyMine: 'This is a recipe of your household.',
    openMine: 'Open my recipe',
    source: 'Recipe source',
    notFound: {
      title: 'Recipe not found',
      text: 'The author may have hidden or deleted it.',
      back: 'Back to public recipes',
    },
  },
  visibility: {
    publish: 'Publish recipe',
    hide: 'Hide from others',
    publishTitle: 'Publish the recipe?',
    publishText:
      'Everyone signed in to the app, including other households, can see and copy a public recipe. It is shown with your household name.',
    hideTitle: 'Hide the recipe?',
    hideText: 'Only your household will see the recipe. Copies others already made stay with them.',
    published: 'The recipe is public.',
    hidden: 'The recipe is private.',
    chip: 'Public',
  },
}
