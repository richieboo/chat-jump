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

    // Auto-scroll to load more chats (like repeated Page Down) with stop-on-idle
	function autoScrollSidebar(sidebar, onComplete) {
	  const scrollEl = getScrollableContainer(sidebar);
	  if (!scrollEl) {
          if (onComplete) onComplete();
          return;
      }

	  let idleTries = 0;
      const maxIdleTries = 3;
      const interval = 500; // Increased interval for loading

      let lastItemCount = 0;

	  const timer = setInterval(() => {
		try {
          const currentItemCount = sidebar.querySelectorAll(entriesSelector).length;
          // Check if we are physically at the bottom of the scrollable area.
          // A small buffer (e.g., 5px) helps with rounding issues.
          const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 5;

          // An attempt is "idle" if we are at the bottom AND the item count hasn't changed.
          if (isAtBottom && currentItemCount === lastItemCount) {
              idleTries++;
          } else {
              idleTries = 0; // Reset if we scrolled or new items appeared.
          }

          lastItemCount = currentItemCount;

		  // Stop if no more movement after X tries
		  if (idleTries >= maxIdleTries) {
			clearInterval(timer);
			console.log("SMS Contact Filter: auto-scroll stopped (no new content).");
            if (onComplete) onComplete();
		  } else {
            // Scroll to the very bottom to trigger loading more content.
            scrollEl.scrollTop = scrollEl.scrollHeight;
          }
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
      const entries = sidebar.querySelectorAll(entriesSelector);
      entries.forEach((node) => {
        const text = (node.textContent || '').trim().toLowerCase();
        node.style.display = !q || text.includes(q) ? '' : 'none';
      });
    }

    filter.addEventListener('input', () => {
        const query = filter.value.trim();
        // Trigger scroll only on the first input that creates a filter query
        if (query.length > 0 && !isScrolling) {
            isScrolling = true;
            statusMsg.textContent = 'Searching for more...';
            statusMsg.style.display = 'block';

            autoScrollSidebar(sidebar, () => {
                // Scrolling is done, re-apply final filter
                filterNow();
                statusMsg.textContent = 'All conversations searched.';
                // isScrolling remains true until filter is cleared, preventing re-trigger
            });
        }
        
        // Handle clearing the filter manually by backspacing, etc.
        if (query.length === 0 && isScrolling) {
            clearFilter();
        }

        filterNow();
    });

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
