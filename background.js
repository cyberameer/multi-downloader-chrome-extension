// Background service worker for Instant Multi Downloader Pro
chrome.action.onClicked.addListener((tab) => {
  // Open the downloader in a new tab
  chrome.tabs.create({
    url: chrome.runtime.getURL('downloader.html'),
    active: true
  });
});

// Listen for download completion
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('Download completed:', delta.id);
  }
});

// Keep service worker alive
let keepAlive = setInterval(() => {
  console.log('Instant Downloader service worker running...');
}, 60000);

chrome.runtime.onStartup.addListener(() => {
  console.log('Instant Downloader Pro started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Instant Downloader Pro installed');
});