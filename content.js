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

    // Auto-scroll to load more chats (like repeated Page Down) with stop-on-idle
	function autoScrollSidebar(sidebar, maxIdleTries = 3, interval = 300) {
	  const scrollEl = getScrollableContainer(sidebar);
	  if (!scrollEl) return;

	  let lastScrollTop = scrollEl.scrollTop;
	  let idleTries = 0;

	  const timer = setInterval(() => {
		try {
		  scrollEl.scrollTop += 400; // simulate PageDown
		  // Check if the scroll position changed
		  if (scrollEl.scrollTop === lastScrollTop) {
			idleTries++;
		  } else {
			idleTries = 0; // reset when new content loads
			lastScrollTop = scrollEl.scrollTop;
		  }
		  // Stop if no more movement after X tries
		  if (idleTries >= maxIdleTries) {
			clearInterval(timer);
			console.log("SMS Contact Filter: auto-scroll stopped (no new content).");
		  }
		} catch (e) {
		  console.warn("SMS Contact Filter auto-scroll error:", e);
		  clearInterval(timer);
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

    function filterNow() {
      const q = filter.value.trim().toLowerCase();
      const entries = sidebar.querySelectorAll(entriesSelector);
      entries.forEach((node) => {
        const text = (node.textContent || '').trim().toLowerCase();
        node.style.display = !q || text.includes(q) ? '' : 'none';
      });
    }

    filter.addEventListener('input', filterNow);

    function clearFilter() {
      filter.value = '';
      filterNow();
      filter.focus();
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

    // Kick off auto-scroll to load more chats
    autoScrollSidebar(sidebar);
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
