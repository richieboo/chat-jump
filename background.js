try {
  const uninstallUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdjSG4SJrTfl2uHBtHYF-_G1Tu7GCJYfl72zObEjs3ah5QtwA/viewform?usp=header';
  chrome.runtime.setUninstallURL(uninstallUrl);
} catch (e) {
  console.error('Error setting uninstall URL:', e);
}
