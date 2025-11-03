(function () {
  // Try to find the chats/contacts sidebar
  function findSidebar(root = document) {
    // Generic sidebar-ish selectors
    const sel = [
      'aside',
      'nav[role="navigation"]',
      '[aria-label*="sidebar" i]',
      '[aria-label*="conversations" i]',
      '[aria-label*="messages" i]'
    ].join(',');

    let el = root.querySelector(sel);
    if (el) return el;

    // Shallow shadow roots (helps on some SPAs)
    for (const host of root.querySelectorAll('*')) {
      if (host.shadowRoot) {
        el = host.shadowRoot.querySelector(sel);
        if (el) return el;
      }
    }
    return null;
  }

  // Find the element inside the sidebar that actually scrolls
  function getScrollableContainer(sidebar) {
    if (!sidebar) return null;

    // If sidebar itself is scrollable, use it
    const s = getComputedStyle(sidebar);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && sidebar.scrollHeight > sidebar.clientHeight) {
      return sidebar;
    }

    // Otherwise, look for a child that scrolls
    const candidates = sidebar.querySelectorAll('*');
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return el;
      }
    }

    return null;
  }

  // What counts as a "chat/contact" entry
  const entriesSelector = [
    'li',
    'a[href]',
    '[role="treeitem"]',
    '[data-testid*="conversation" i]',
    '[data-testid*="chat" i]',
    '[data-qa*="conversation" i]',
    '[data-qa*="chat" i]',
    'h2, h3'
  ].join(',');

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

    // Auto-scroll to load more chats (like repeated Page Down) with stop-on-idle
	function autoScrollSidebar(sidebar, filterFn, onComplete) {
	  const scrollEl = getScrollableContainer(sidebar);
	  if (!scrollEl) {
          if (onComplete) onComplete();
          return;
      }

	  let idleTries = 0;
      const maxIdleTries = 3;
      const interval = 500; // Increased interval for loading

      let lastItemCount = 0;
      let lastScrollHeight = 0;

	  const timer = setInterval(() => {
		try {
          const currentItemCount = sidebar.querySelectorAll(entriesSelector).length;
          const currentScrollHeight = scrollEl.scrollHeight;

          // An attempt is "idle" if both scroll height and item count have stopped changing.
          if (currentScrollHeight === lastScrollHeight && currentItemCount === lastItemCount) {
              idleTries++;
          } else {
              idleTries = 0; // Reset if anything changed.
          }

          lastItemCount = currentItemCount;
          lastScrollHeight = currentScrollHeight;

          // Re-run the filter on every cycle to catch newly loaded items
          filterFn();

		  // Stop if nothing has changed for maxIdleTries
		  if (idleTries >= maxIdleTries) {
			clearInterval(timer);
			console.log("SMS Contact Filter: auto-scroll stopped (no new content).");
            if (onComplete) onComplete();
            return; // Exit the interval callback
		  }

          // If not stopped, log and scroll to the bottom for the next cycle.
          console.log("SMS Contact Filter: Paging for more chats...");
          scrollEl.scrollTop = scrollEl.scrollHeight;

		} catch (e) {
		  console.warn("SMS Contact Filter auto-scroll error:", e);
		  clearInterval(timer);
          if (onComplete) onComplete();
		}
	  }, interval);
	}


  function attachFilter(sidebar) {
    if (!sidebar || document.getElementById('smsContactFilterInput')) return;

    // Wrapper to position the clear "×" button
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.margin = '10px';

    const filter = document.createElement('input');
    filter.type = 'text';
    filter.id = 'smsContactFilterInput';
    filter.placeholder = 'Filter contacts or chat names…';

    // Ask password managers (Bitwarden, etc.) to ignore this field
    filter.setAttribute('autocomplete', 'off');
    filter.setAttribute('autocorrect', 'off');
    filter.setAttribute('autocapitalize', 'off');
    filter.setAttribute('spellcheck', 'false');
    filter.setAttribute('aria-autocomplete', 'none');
    filter.setAttribute('inputmode', 'search');
    filter.setAttribute('role', 'searchbox');
    filter.setAttribute('data-bwignore', 'true');   // Bitwarden
    filter.setAttribute('data-1p-ignore', 'true');  // 1Password
    filter.setAttribute('data-lpignore', 'true');   // LastPass
    filter.name = 'sms-contact-filter-search';
    filter.autocomplete = 'off';

    Object.assign(filter.style, {
      padding: '6px 32px 6px 8px',   // space for the × button
      width: '100%',
      fontSize: '15px',
      boxSizing: 'border-box',
      border: '1px solid #ccc',
      borderRadius: '6px',
      outline: 'none',
      background: 'white'
    });

    // Clear "×" button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '×';
    clearBtn.title = 'Clear filter';
    Object.assign(clearBtn.style, {
      position: 'absolute',
      right: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
      border: 'none',
      background: 'transparent',
      fontSize: '18px',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '0 4px',
      opacity: '0.7'
    });
    clearBtn.addEventListener('mouseenter', () => (clearBtn.style.opacity = '1'));
    clearBtn.addEventListener('mouseleave', () => (clearBtn.style.opacity = '0.7'));

    wrap.appendChild(filter);
    wrap.appendChild(clearBtn);
    sidebar.prepend(wrap);

    // Status message element
    const statusMsg = document.createElement('div');
    statusMsg.id = 'smsContactFilterStatus';
    Object.assign(statusMsg.style, {
      display: 'none', // Initially hidden
      margin: '0 10px 10px 10px',
      fontSize: '13px',
      color: '#666',
      textAlign: 'center',
      transition: 'opacity 0.3s'
    });
    wrap.insertAdjacentElement('afterend', statusMsg);

    const searchOptionsWrap = document.createElement('div');
    Object.assign(searchOptionsWrap.style, {
      display: 'flex',
      justifyContent: 'center',
      gap: '15px',
      margin: '0 10px 10px',
      fontSize: '13px',
      color: '#aaa' // Lighter color for dark theme
    });

    function createRadioOption(value, label, isChecked) {
      const labelEl = document.createElement('label');
      labelEl.style.cursor = 'pointer';
      labelEl.style.display = 'flex';
      labelEl.style.alignItems = 'center';

      const inputEl = document.createElement('input');
      inputEl.type = 'radio';
      inputEl.name = 'searchMode';
      inputEl.value = value;
      inputEl.checked = isChecked;
      inputEl.style.marginRight = '5px';
      
      labelEl.appendChild(inputEl);
      labelEl.appendChild(document.createTextNode(label));
      return labelEl;
    }

    searchOptionsWrap.appendChild(createRadioOption('chatName', 'Chat Name', true));
    searchOptionsWrap.appendChild(createRadioOption('fullConversation', 'Full Conversation', false));
    statusMsg.insertAdjacentElement('afterend', searchOptionsWrap);

    // Re-run filter when the search mode changes
    searchOptionsWrap.addEventListener('change', filterNow);

    // What counts as a "chat/contact" entry is now in the outer scope
    /*
    const entriesSelector = [
      'li',
      'a[href]',
      '[role="treeitem"]',
      '[data-testid*="conversation" i]',
      '[data-testid*="chat" i]',
      '[data-qa*="conversation" i]',
      '[data-qa*="chat" i]',
      'h2, h3'
    ].join(',');
    */

    let isScrolling = false;
    function filterNow() {
      const q = filter.value.trim().toLowerCase();
      const searchModeEl = document.querySelector('input[name="searchMode"]:checked');
      const searchMode = searchModeEl ? searchModeEl.value : 'chatName';
      const entries = sidebar.querySelectorAll(entriesSelector);
      entries.forEach((node) => {
        let textToSearch = '';
        if (searchMode === 'chatName') {
          // Try to find a specific element that might contain the name.
          // This is an educated guess based on common accessibility and structure patterns.
          const nameEl = node.querySelector('[aria-label*="name" i], [data-testid*="name" i], [role="heading"]');
          if (nameEl) {
            textToSearch = (nameEl.textContent || '').trim().toLowerCase();
          } else {
            // If no specific element is found, fall back to the first non-empty line of text.
            // This handles cases where the name is just the first text node in the list item.
            const lines = (node.textContent || '').split('\n').map(line => line.trim()).filter(line => line.length > 0);
            textToSearch = (lines[0] || '').toLowerCase();
          }
        } else { // 'fullConversation'
            textToSearch = (node.textContent || '').trim().toLowerCase();
        }
        node.style.display = !q || textToSearch.includes(q) ? '' : 'none';
      });
    }

    const debouncedFilterAndScroll = debounce(() => {
        const query = filter.value.trim();
        if (query.length > 0) {
            // Always run the initial filter on what's currently visible
            filterNow();
            if (!isScrolling) {
                isScrolling = true;
                statusMsg.textContent = 'Searching for more...';
                statusMsg.style.display = 'block';

                autoScrollSidebar(sidebar, filterNow, () => {
                    // Final filter after scrolling is complete
                    filterNow();
                    statusMsg.textContent = 'All conversations searched.';
                    // isScrolling remains true until filter is cleared
                });
            }
        } else {
            clearFilter();
        }
    }, 300); // 300ms delay after user stops typing

    filter.addEventListener('input', debouncedFilterAndScroll);

    function clearFilter() {
      if (filter.value !== '') filter.value = '';
      filterNow();
      filter.focus();
      isScrolling = false; // Reset scrolling lock
      statusMsg.style.display = 'none';
      statusMsg.textContent = '';
    }

    clearBtn.addEventListener('click', clearFilter);
    filter.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') clearFilter();
    });

    // Re-apply filter when the chat list changes (new messages, etc.)
    new MutationObserver(filterNow).observe(sidebar, {
      childList: true,
      subtree: true
    });

    // Optional best-effort cleanup of password-manager overlays inside our wrapper
    const overlayCleaner = new MutationObserver(() => {
      for (const el of wrap.querySelectorAll('iframe, .bitwarden, .bw-overlay')) {
        el.remove();
      }
    });
    overlayCleaner.observe(wrap, { childList: true, subtree: true });

    // We don't need to auto-scroll on attach anymore
    // It will now trigger on user input
  }

  function boot() {
    const sidebar = findSidebar();
    if (sidebar) attachFilter(sidebar);
  }

  // Watch for when the sidebar appears/changes
  new MutationObserver(boot).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('load', boot);
})();
