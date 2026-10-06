import { buildImportUrl } from './buildImportUrl.js'

// Klik na ikonu: otvorí Kuchársku knihu s importom receptu zo stránky v aktívnej karte.
chrome.action.onClicked.addListener(async (tab) => {
  const { appUrl } = await chrome.storage.sync.get('appUrl')
  if (!appUrl) return chrome.runtime.openOptionsPage()
  const target = buildImportUrl(appUrl, tab.url)
  if (target) await chrome.tabs.create({ url: target })
})

// Po inštalácii hneď ponúkne zadanie adresy aplikácie.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage()
})
