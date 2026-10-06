import { buildImportUrl } from './buildImportUrl.js'

const input = document.getElementById('app-url')
const status = document.getElementById('status')

chrome.storage.sync.get('appUrl').then(({ appUrl }) => {
  if (appUrl) input.value = appUrl
})

document.getElementById('form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const value = input.value.trim().replace(/\/+$/, '')
  // Adresa je v poriadku, ak z nej vieme zložiť adresu importu.
  if (!buildImportUrl(value, 'https://example.com')) {
    status.textContent = 'Zadaj adresu s https:// (pri vývoji aj http://localhost).'
    return
  }
  await chrome.storage.sync.set({ appUrl: value })
  input.value = value
  status.textContent = 'Uložené.'
})
