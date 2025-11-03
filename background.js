const uninstallUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdjSG4SJrTfl2uHBtHYF-_G1Tu7GCJYfl72zObEjs3ah5QtwA/viewform?usp=header';

chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.setUninstallURL(uninstallUrl, () => {
    if (chrome.runtime.lastError) {
      console.error('Error setting uninstall URL:', chrome.runtime.lastError);
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.runtime.setUninstallURL(uninstallUrl, () => {
    if (chrome.runtime.lastError) {
      console.error('Error setting uninstall URL:', chrome.runtime.lastError);
    }
  });
});
