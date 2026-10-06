/** Shopping list: page, generating from the meal plan, editing an item. */
export default {
  printView: { heading: 'Printed {date}' },
  title: 'Shopping list',
  fromPlan: 'From meal plan',
  moreActions: 'More actions',
  print: 'Print list',
  clearChecked: 'Clear purchased',
  subtitle: '{toBuy} to buy · {inCart} in cart',
  inCart: 'In cart ({n})',
  allInCart: 'Everything is in the cart.',
  categoryOther: 'Other',
  confirmDelete: 'Really delete',
  plural: { changes: '{n} change | {n} changes' },
  offline: {
    queued: 'Waiting to be sent: {changes} made while offline.',
    noSignal: 'No signal. You can keep ticking items off; changes will be sent when you are back online.',
  },
  add: {
    label: 'Add an item, e.g. 2 kg potatoes',
    aria: 'Add item',
  },
  empty: {
    title: 'The list is empty',
    text: 'Generate it from your meal plan or add items manually.',
    generate: 'Generate from meal plan',
  },
  item: {
    staple: 'Staple item',
    editAria: 'Edit {name}',
  },
  generate: {
    title: 'Generate from meal plan',
    text: 'Adds up the ingredients of the planned recipes for your family’s servings. Unpurchased items from the previous generation are replaced; purchased and manually added items stay.',
    presets: {
      rest: 'From today to the end of the week',
      this: 'This whole week',
      next: 'Next week',
      custom: 'Custom days',
    },
    from: 'From',
    to: 'To',
    submit: 'Generate',
    errors: {
      pickDates: 'Pick both a start and an end date.',
      order: 'The end date must not be before the start date.',
      tooLong: 'At most {days} at a time.',
      failed: 'Generating failed.',
    },
  },
  edit: {
    title: 'Edit item',
    name: 'Name',
    quantity: 'Quantity',
    unit: 'Unit',
    category: 'Store category',
    errors: {
      nameRequired: 'Enter a name.',
      quantityInvalid: 'Quantity, e.g. 2 or 1.5.',
      saveFailed: 'Saving failed.',
      deleteFailed: 'Deleting failed.',
    },
  },
  snackbar: {
    addFailed: 'The item could not be added.',
    toggleFailed: 'The change was not saved.',
    cleared: 'Removed from cart: {items}.',
  },
}
