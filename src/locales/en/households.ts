/** Households: members card, invitation, creation, picker and the gate in front of the app. */
export default {
  name: 'Household name',
  role: 'Role',
  card: {
    title: 'Household and members',
    accountsIntro: 'Accounts that can sign in to this household ({members}).',
    lastLogin: 'last seen {date}',
    neverLoggedIn: 'has not signed in yet',
    locked: 'This email is set at deployment and cannot be removed in the app.',
    removeMember: 'Remove {email}',
    ownerOnly: 'Only the owner can change the members, name and settings of the household.',
    invite: 'Invite',
    removeTitle: 'Remove from household?',
    removeText: '{email} will lose access to this household. Recipes and the plan are not deleted.',
    nameSaved: 'Name saved.',
    nameFailed: 'The name was not saved.',
    roleFailed: 'Could not change the role.',
    removeFailed: 'Could not remove the member.',
  },
  invite: {
    title: 'Invite to household',
    intro:
      'The invited person signs in with this email (using a one-time code sent to them) and will see this household.',
    email: 'Email',
    emailRequired: 'Enter an email.',
    roleHint:
      'An owner can change settings, the family and members. A member does everything related to cooking.',
    submit: 'Invite',
    failed: 'Could not save the invitation.',
  },
  create: {
    title: 'New household',
    intro: 'A new household has its own recipes, meal plan, shopping list and pantry. You will be its owner.',
    namePlaceholder: 'e.g. At my parents',
    nameRequired: 'Enter a household name.',
    submit: 'Create',
    failed: 'Could not create the household.',
  },
  picker: {
    title: 'Choose a household',
    text: 'You are a member of several households.',
  },
  gate: {
    loadFailed: 'Could not load households',
  },
  own: {
    title: 'You are not in any household yet',
    text: 'Create your own household – you will be its owner and can invite others.',
    name: 'Household name',
    defaultName: '{name}’s household',
    create: 'Create household',
    failed: 'Could not create the household.',
    invite:
      'Joining an existing household instead? Send its owner the e-mail you are signed in with ({email}) so they can invite you in Settings. Then reload the page.',
  },
}
