(function () {
  console.info("SMS Contact Filter: content script executing");
  // Try to find the chats/contacts sidebar
  function findSidebar(root = document) {
    // Generic sidebar-ish selectors
    const sel = [
      "aside",
      'nav[role="navigation"]',
      "nav.conversation-list",
      '[aria-label*="sidebar" i]',
      '[aria-label*="conversations" i]',
      '[aria-label*="messages" i]',
    ].join(",");

    let el = root.querySelector(sel);
    if (el) return el;

    // Shallow shadow roots (helps on some SPAs)
    for (const host of root.querySelectorAll("*")) {
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
    if (
      (s.overflowY === "auto" || s.overflowY === "scroll") &&
      sidebar.scrollHeight > sidebar.clientHeight
    ) {
      return sidebar;
    }

    // Otherwise, look for a child that scrolls
    const candidates = sidebar.querySelectorAll("*");
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (
        (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      ) {
        return el;
      }
    }

    return null;
  }

  function setLoadingIndicatorSuppressed(sidebar, suppressed) {
    const scrollEl = getScrollableContainer(sidebar);
    if (!scrollEl) return;
    if (suppressed) {
      scrollEl.classList.add("scf-hide-loading");
    } else {
      scrollEl.classList.remove("scf-hide-loading");
    }
  }

  const entryDetectors = [
    {
      name: "mws-conversation-list-item",
      find(sidebar) {
        return Array.from(
          sidebar.querySelectorAll("mws-conversation-list-item")
        );
      },
    },
    {
      name: "anchor-list-item",
      find(sidebar) {
        return Array.from(
          sidebar.querySelectorAll("a.list-item[data-e2e-conversation]")
        ).map((el) => el.closest("mws-conversation-list-item") || el);
      },
    },
    {
      name: "role-option",
      find(sidebar) {
        return Array.from(
          sidebar.querySelectorAll('[role="option"][data-e2e-conversation]')
        ).map((el) => el.closest("mws-conversation-list-item") || el);
      },
    },
  ];

  let activeEntryDetector = entryDetectors[0];
  let lastSampleLogKey = "";

  function uniqueElements(elements) {
    const out = [];
    const seen = new Set();
    for (const el of elements) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      out.push(el);
    }
    return out;
  }

  function clickLoadMoreButton(sidebar) {
    if (!sidebar) return false;
    const selector = [
      "button.load-more",
      "button[data-e2e-conversation-list-load-more]",
      'button[aria-label*="load more" i]',
    ].join(",");
    const btn = sidebar.querySelector(selector);
    if (btn && !btn.disabled) {
      btn.click();
      console.info("SMS Contact Filter: clicked Load more conversations");
      return true;
    }
    return false;
  }

  function collectConversationEntries(sidebar) {
    if (!sidebar) return [];

    if (activeEntryDetector) {
      const activeMatches = uniqueElements(activeEntryDetector.find(sidebar));
      if (activeMatches.length > 0) return activeMatches;
    }

    for (const detector of entryDetectors) {
      const matches = uniqueElements(detector.find(sidebar));
      if (matches.length > 0) {
        activeEntryDetector = detector;
        console.info(
          "SMS Contact Filter: switched detector to",
          detector.name,
          "matches",
          matches.length
        );
        return matches;
      }
    }

    return [];
  }

  function countConversationEntries(sidebar) {
    return collectConversationEntries(sidebar).length;
  }

  function firstConversationEntry(sidebar) {
    const entries = collectConversationEntries(sidebar);
    return entries.length ? entries[0] : null;
  }

  function findStartChatButton(sidebar) {
    const selectors = [
      "[data-e2e-start-chat]",
      "[data-e2e-conversation-start-chat]",
      'button[aria-label*="start chat" i]',
      'button[aria-label*="new conversation" i]',
      'button[aria-label*="start new" i]',
    ];

    const roots = [];
    if (sidebar) {
      roots.push(sidebar);
      let ancestor = sidebar.parentElement;
      while (ancestor) {
        roots.push(ancestor);
        ancestor = ancestor.parentElement;
      }
    }
    roots.push(document);

    const visited = new Set();
    for (const root of roots) {
      if (!root || visited.has(root)) continue;
      visited.add(root);
      for (const selector of selectors) {
        const el = root.querySelector?.(selector);
        if (el) return el;
      }
    }
    return null;
  }

  function findStartChatBlock(startChatButton, sidebar) {
    if (!startChatButton) return null;

    const containerSelectors = [
      "[data-e2e-start-chat-container]",
      "[data-e2e-sidebar-header]",
      '[role="toolbar"]',
      "header",
      ".conversation-list-header",
      ".sidebar-header",
    ];

    for (const selector of containerSelectors) {
      const block = startChatButton.closest(selector);
      if (block && block !== sidebar) {
        return block;
      }
    }

    let candidate = startChatButton.parentElement;
    while (
      candidate &&
      candidate !== sidebar &&
      candidate.childElementCount === 1
    ) {
      candidate = candidate.parentElement;
    }

    if (
      candidate &&
      candidate !== document.body &&
      candidate !== document.documentElement
    ) {
      return candidate;
    }

    return startChatButton.parentElement;
  }

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
      if (onComplete) onComplete("complete");
      return null;
    }

    setLoadingIndicatorSuppressed(sidebar, false);

    let idleTries = 0;
    const maxIdleTries = 3;
    const interval = 500; // Increased interval for loading

    let lastItemCount = 0;
    let lastScrollHeight = 0;
    let cancelled = false;

    function finish(reason) {
      if (cancelled) return;
      cancelled = true;
      clearInterval(timer);
      setLoadingIndicatorSuppressed(sidebar, true);
      try {
        onComplete?.(reason);
      } catch (err) {
        console.warn(
          "SMS Contact Filter: auto-scroll completion handler error",
          err
        );
      }
    }

    const timer = setInterval(() => {
      if (cancelled) return;

      try {
        const currentItemCount = countConversationEntries(sidebar);
        const currentScrollHeight = scrollEl.scrollHeight;

        // Re-run the filter on every cycle to catch newly loaded items
        filterFn();

        if (clickLoadMoreButton(sidebar)) {
          idleTries = 0;
          return;
        }

        // An attempt is "idle" if both scroll height and item count have stopped changing.
        if (
          currentScrollHeight === lastScrollHeight &&
          currentItemCount === lastItemCount
        ) {
          idleTries++;
        } else {
          idleTries = 0; // Reset if anything changed.
        }

        lastItemCount = currentItemCount;
        lastScrollHeight = currentScrollHeight;

        if (idleTries >= maxIdleTries) {
          // Before giving up, try one last time to hit Load more if it appeared late
          if (clickLoadMoreButton(sidebar)) {
            idleTries = 0;
            return;
          }

          console.log(
            "SMS Contact Filter: auto-scroll stopped (no new content)."
          );
          finish("complete");
          return; // Exit the interval callback
        }

        // If not stopped, log and scroll to the bottom for the next cycle.
        console.log("SMS Contact Filter: Paging for more chats...");
        scrollEl.scrollTop = scrollEl.scrollHeight;
      } catch (e) {
        console.warn("SMS Contact Filter auto-scroll error:", e);
        finish("error");
      }
    }, interval);

    return (reason = "cancelled") => {
      if (cancelled) return;
      cancelled = true;
      clearInterval(timer);
      setLoadingIndicatorSuppressed(sidebar, true);
      try {
        onComplete?.(reason);
      } catch (err) {
        console.warn(
          "SMS Contact Filter: auto-scroll cancellation handler error",
          err
        );
      }
    };
  }

  function attachFilter(sidebar) {
    if (!sidebar || document.getElementById("smsContactFilterInput")) return;

    const controlsContainer = document.createElement("div");
    Object.assign(controlsContainer.style, {
      background: "rgba(33, 150, 243, 0.12)",
      border: "1px solid rgba(33, 150, 243, 0.35)",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
      padding: "14px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      fontFamily: 'Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    });
    // Wrapper to position the clear "×" button
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.maxWidth = "100%";

    let placedNearStartChat = false;
    let horizontalMargin = "10px";

    const startChatButton = findStartChatButton(sidebar);
    if (startChatButton) {
      const startChatBlock = findStartChatBlock(startChatButton, sidebar);
      const host = startChatBlock?.parentElement;
      if (host) {
        host.insertBefore(controlsContainer, startChatBlock.nextSibling);
        placedNearStartChat = true;
      } else if (startChatBlock) {
        startChatBlock.insertAdjacentElement("afterend", controlsContainer);
        placedNearStartChat = true;
      }
    }

    if (!placedNearStartChat) {
      const parent = sidebar.parentElement;
      if (parent) {
        parent.insertBefore(controlsContainer, parent.firstChild);
      } else {
        sidebar.prepend(controlsContainer);
      }
    } else {
      horizontalMargin = "12px";
    }

    controlsContainer.style.margin = placedNearStartChat
      ? `8px ${horizontalMargin} 6px ${horizontalMargin}`
      : "10px";
    controlsContainer.appendChild(wrap);

    const filter = document.createElement("input");
    filter.type = "text";
    filter.id = "smsContactFilterInput";
    filter.placeholder = "Filter contacts or chats...";

    // Ask password managers (Bitwarden, etc.) to ignore this field
    filter.setAttribute("autocomplete", "off");
    filter.setAttribute("autocorrect", "off");
    filter.setAttribute("autocapitalize", "off");
    filter.setAttribute("spellcheck", "false");
    filter.setAttribute("aria-autocomplete", "none");
    filter.setAttribute("inputmode", "search");
    filter.setAttribute("role", "searchbox");
    filter.setAttribute("data-bwignore", "true"); // Bitwarden
    filter.setAttribute("data-1p-ignore", "true"); // 1Password
    filter.setAttribute("data-lpignore", "true"); // LastPass
    filter.name = "sms-contact-filter-search";
    filter.autocomplete = "off";

    Object.assign(filter.style, {
      padding: "6px 84px 6px 14px", // space for buttons on the right
      width: "100%",
      fontSize: "15px",
      fontFamily: "inherit",
      boxSizing: "border-box",
      border: "1px solid rgba(0,0,0,0.2)",
      borderRadius: "8px",
      outline: "none",
      background: "#ffffff",
      color: "#0d1724",
      transition: "box-shadow 0.2s, border-color 0.2s",
    });

    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.textContent = "🔍";
    searchBtn.title = "Run search";
    searchBtn.setAttribute("aria-label", "Run search");
    Object.assign(searchBtn.style, {
      position: "absolute",
      right: "18px",
      top: "50%",
      transform: "translateY(-50%)",
      border: "none",
      background: "transparent",
      color: "#1f88e0",
      fontSize: "20px",
      fontFamily: "inherit",
      lineHeight: "1",
      cursor: "pointer",
      padding: "4px 6px",
    });

    searchBtn.addEventListener("mouseenter", () => {
      if (!searchBtn.disabled) {
        searchBtn.style.filter = "brightness(1.2)";
        searchBtn.style.transform = "translateY(-50%) scale(1.05)";
      }
    });
    searchBtn.addEventListener("mouseleave", () => {
      searchBtn.style.filter = "none";
      searchBtn.style.transform = "translateY(-50%) scale(1)";
    });

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "×";
    clearBtn.title = "Clear filter";
    clearBtn.setAttribute("aria-label", "Clear filter");
    Object.assign(clearBtn.style, {
      position: "absolute",
      right: "6px",
      top: "50%",
      transform: "translateY(-50%)",
      border: "none",
      background: "transparent",
      fontSize: "18px",
      fontFamily: "inherit",
      lineHeight: "1",
      cursor: "pointer",
      padding: "0 4px",
      opacity: "0.7",
    });
    clearBtn.addEventListener(
      "mouseenter",
      () => (clearBtn.style.opacity = "1")
    );
    clearBtn.addEventListener(
      "mouseleave",
      () => (clearBtn.style.opacity = "0.7")
    );

    wrap.appendChild(filter);
    wrap.appendChild(searchBtn);
    wrap.appendChild(clearBtn);

    filter.addEventListener("focus", () => {
      filter.style.borderColor = "#64b5f6";
      filter.style.boxShadow = "0 0 0 3px rgba(100, 181, 246, 0.25)";
    });
    filter.addEventListener("blur", () => {
      filter.style.borderColor = "rgba(0,0,0,0.2)";
      filter.style.boxShadow = "none";
    });

    // Inject a style rule for hiding elements robustly
    const style = document.createElement("style");
    style.textContent = `
      .scf-hidden {
        display: none !important;
      }
      .scf-dimmed {
        opacity: 0.25 !important;
      }
      .scf-match-button {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: rgba(25, 118, 210, 0.65);
        color: #fff;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        line-height: 1.3;
      }
      .scf-match-button:hover,
      .scf-match-button:focus {
        background: rgba(25, 118, 210, 0.8);
        outline: none;
      }
      .scf-hide-loading [role="progressbar"],
      .scf-hide-loading mws-progress-indicator,
      .scf-hide-loading mws-linear-progress,
      .scf-hide-loading mws-circular-progress,
      .scf-hide-loading .mdc-linear-progress,
      .scf-hide-loading .mdc-circular-progress {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    // Status message element
    const statusMsg = document.createElement("div");
    statusMsg.id = "smsContactFilterStatus";
    Object.assign(statusMsg.style, {
      display: "none", // Initially hidden
      margin: "0",
      fontSize: "13px",
      textAlign: "center",
      transition: "opacity 0.3s",
    });
    controlsContainer.appendChild(statusMsg);

    const searchOptionsWrap = document.createElement("div");
    Object.assign(searchOptionsWrap.style, {
      display: "flex",
      justifyContent: "center",
      gap: "15px",
      margin: "0",
      fontSize: "13px",
    });
    controlsContainer.appendChild(searchOptionsWrap);

    const optionLabelNodes = [];
    const prefersDarkScheme = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    );
    let isDarkMode = prefersDarkScheme ? prefersDarkScheme.matches : true;

    function applyOptionLabelColors() {
      const optionTextColor = isDarkMode
        ? "rgba(255, 255, 255, 0.82)"
        : "rgba(0, 0, 0, 0.75)";
      for (const node of optionLabelNodes) {
        node.style.color = optionTextColor;
      }

      searchOptionsWrap.style.color = isDarkMode
        ? "rgba(255, 255, 255, 0.8)"
        : "rgba(0, 0, 0, 0.65)";

      statusMsg.style.color = isDarkMode
        ? "rgba(255, 255, 255, 0.78)"
        : "rgba(51, 51, 51, 0.85)";
    }

    function createRadioOption(value, label, isChecked) {
      const labelEl = document.createElement("label");
      labelEl.style.cursor = "pointer";
      labelEl.style.display = "flex";
      labelEl.style.alignItems = "center";
      labelEl.style.fontFamily = "inherit";
      labelEl.style.color = "inherit";
      labelEl.style.gap = "6px";

      const inputEl = document.createElement("input");
      inputEl.type = "radio";
      inputEl.name = "searchMode";
      inputEl.value = value;
      inputEl.checked = isChecked;
      inputEl.style.marginRight = "0";
      inputEl.style.accentColor = "#64b5f6";

      labelEl.appendChild(inputEl);
      const textNode = document.createElement("span");
      textNode.textContent = label.replace(/:\s*$/, "");
      textNode.style.fontWeight = "500";
      labelEl.appendChild(textNode);
      optionLabelNodes.push(textNode);
      return labelEl;
    }

    searchOptionsWrap.appendChild(
      createRadioOption("chatName", "Chat Name", true)
    );
    searchOptionsWrap.appendChild(
      createRadioOption("fullConversation", "Full Conversation", false)
    );

    applyOptionLabelColors();

    if (prefersDarkScheme) {
      const handleSchemeChange = (event) => {
        isDarkMode = event.matches;
        applyOptionLabelColors();
      };
      if (typeof prefersDarkScheme.addEventListener === "function") {
        prefersDarkScheme.addEventListener("change", handleSchemeChange);
      } else if (typeof prefersDarkScheme.addListener === "function") {
        prefersDarkScheme.addListener(handleSchemeChange);
      }
    }

    const matchesWrap = document.createElement("div");
    Object.assign(matchesWrap.style, {
      display: "none",
      margin: `6px ${horizontalMargin} 12px ${horizontalMargin}`,
      padding: "10px 12px 12px 12px",
      borderRadius: "10px",
      border: "1px solid rgba(33, 150, 243, 0.35)",
      background: "rgba(13, 23, 36, 0.78)",
      boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
      maxHeight: "200px",
      overflowY: "auto",
      position: "relative",
      fontFamily: 'Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    });

    const matchesCloseBtn = document.createElement("button");
    matchesCloseBtn.type = "button";
    matchesCloseBtn.textContent = "×";
    matchesCloseBtn.title = "Hide matches";
    Object.assign(matchesCloseBtn.style, {
      position: "absolute",
      top: "6px",
      right: "6px",
      width: "22px",
      height: "22px",
      border: "none",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.15)",
      color: "#bbdefb",
      fontSize: "16px",
      lineHeight: "1",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0",
    });

    const matchesHeader = document.createElement("div");
    matchesHeader.textContent = "Matches";
    Object.assign(matchesHeader.style, {
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: "#64b5f6",
      marginBottom: "8px",
    });

    const matchesList = document.createElement("div");
    Object.assign(matchesList.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    matchesWrap.append(matchesCloseBtn, matchesHeader, matchesList);
    matchesCloseBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearMatches(true);
      if (isScrolling) {
        stopSearch("user");
      } else {
        cancelActiveScroll("cancelled");
      }
      filter.focus();
    });
    matchesCloseBtn.addEventListener("mouseenter", () => {
      matchesCloseBtn.style.background = "rgba(255,255,255,0.3)";
      matchesCloseBtn.style.color = "#ffffff";
    });
    matchesCloseBtn.addEventListener("mouseleave", () => {
      matchesCloseBtn.style.background = "rgba(255,255,255,0.15)";
      matchesCloseBtn.style.color = "#bbdefb";
    });
    controlsContainer.insertAdjacentElement("afterend", matchesWrap);

    searchOptionsWrap.addEventListener("change", () => {
      lastSampleLogKey = "";
      suppressMatchesPanel = false;
      if (isScrolling) {
        stopSearch("cancelled");
        statusMsg.style.display = "none";
        statusMsg.textContent = "";
      } else {
        cancelActiveScroll();
      }
      hasLoadedAll = false;
      filterNow();
    });

    let isScrolling = false;
    let hasLoadedAll = false;
    let cancelAutoScroll = null;
    let lastMatchesSignature = "";
    let suppressMatchesPanel = false;

    function clearMatches(setSuppressed = false) {
      if (setSuppressed) suppressMatchesPanel = true;
      matchesWrap.style.display = "none";
      matchesList.textContent = "";
      lastMatchesSignature = "";
    }

    function getEntryKey(node, fallbackIndex) {
      const conversational = node.getAttribute("data-e2e-conversation");
      if (conversational) return conversational;
      const anchor = node.querySelector("a[href]");
      if (anchor?.dataset?.e2eConversation)
        return anchor.dataset.e2eConversation;
      if (anchor?.href) return anchor.href;
      const idAttr = node.id;
      if (idAttr) return idAttr;
      const nameEl = node.querySelector(
        "[data-e2e-conversation-name], h2.name"
      );
      if (nameEl?.textContent) {
        return `name:${nameEl.textContent.trim().toLowerCase()}`;
      }
      return `idx:${fallbackIndex}`;
    }

    function renderMatches(matches) {
      if (suppressMatchesPanel) {
        clearMatches(true);
        return;
      }

      if (!matches || matches.length === 0) {
        clearMatches(false);
        return;
      }

      const signature = matches.map((match) => match.key).join("|");
      if (signature === lastMatchesSignature) {
        return;
      }
      lastMatchesSignature = signature;

      matchesWrap.style.display = "block";
      matchesList.textContent = "";

      const seen = new Set();
      for (const { node, key } of matches) {
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const nameEl = node.querySelector(
          "[data-e2e-conversation-name], h2.name"
        );
        const snippetEl = node.querySelector(
          "[data-e2e-conversation-snippet], .snippet-text"
        );
        const timestampEl = node.querySelector(
          "[data-e2e-conversation-timestamp], mws-relative-timestamp, time"
        );
        const name =
          (nameEl?.textContent || "").trim() || "Unnamed conversation";
        const snippet = (snippetEl?.textContent || "").trim();
        const timestamp = (timestampEl?.textContent || "").trim();

        const button = document.createElement("button");
        button.type = "button";
        button.className = "scf-match-button";
        button.title = "Jump to conversation";

        const primaryLine = document.createElement("div");
        primaryLine.textContent = name;
        Object.assign(primaryLine.style, {
          fontWeight: "600",
          color: "#ffffff",
        });

        const secondaryLine = document.createElement("div");
        secondaryLine.textContent = snippet || "—";
        Object.assign(secondaryLine.style, {
          fontSize: "12px",
          color: "rgba(255, 255, 255, 0.85)",
          opacity: snippet ? 0.85 : 0.5,
          marginTop: "2px",
        });

        button.append(primaryLine);
        button.append(secondaryLine);
        if (timestamp) {
          const timeLine = document.createElement("div");
          timeLine.textContent = timestamp;
          Object.assign(timeLine.style, {
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.7)",
            marginTop: snippet ? "3px" : "2px",
          });
          button.append(timeLine);
        }

        button.addEventListener("click", () => {
          try {
            clearMatches(true);
            stopSearch("match");
            const clickable = node.querySelector('a, [role="option"], button');
            if (clickable) {
              clickable.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                })
              );
            } else {
              node.click?.();
            }
            node.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch (err) {
            console.warn(
              "SMS Contact Filter: unable to focus conversation from match list",
              err
            );
          }
        });

        matchesList.appendChild(button);
      }
    }

    function filterNow() {
      const q = filter.value.trim().toLowerCase();
      const searchModeEl = document.querySelector(
        'input[name="searchMode"]:checked'
      );
      const searchMode = searchModeEl ? searchModeEl.value : "chatName";
      const entries = collectConversationEntries(sidebar);
      if (q && entries.length === 0) {
        console.warn(
          "SMS Contact Filter: no entries detected; active detector",
          activeEntryDetector?.name
        );
      }

      if (!q) {
        lastSampleLogKey = "";
      }

      const matches = [];

      entries.forEach((node, index) => {
        let textToSearch = "";
        if (searchMode === "chatName") {
          const nameEl = node.querySelector(
            "[data-e2e-conversation-name], h2.name"
          );
          if (nameEl) {
            textToSearch = (nameEl.textContent || "").trim().toLowerCase();
          } else {
            const lines = (node.textContent || "")
              .trim()
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0);
            textToSearch = (lines[0] || "").toLowerCase();
          }
        } else {
          textToSearch = (node.textContent || "").trim().toLowerCase();
        }

        if (index === 0 && q) {
          const sampleLogKey = `${searchMode}:${q}`;
          if (sampleLogKey !== lastSampleLogKey) {
            console.debug("SMS Contact Filter: sample entry text", {
              query: q,
              textToSearch,
              searchMode,
              includes: textToSearch.includes(q),
            });
            lastSampleLogKey = sampleLogKey;
          }
        }

        const match = !q || textToSearch.includes(q);
        const shouldHide = q && !match && hasLoadedAll;
        const shouldDim = q && !match && !hasLoadedAll;
        node.classList.toggle("scf-hidden", shouldHide);
        node.classList.toggle("scf-dimmed", shouldDim);

        if (q && match) {
          matches.push({ node, key: getEntryKey(node, index) });
        }
      });

      renderMatches(q ? matches : []);
    }

    function setSearchingState(active) {
      if (active) {
        searchBtn.disabled = false;
        searchBtn.textContent = "🛑";
        searchBtn.style.background = "transparent";
        searchBtn.style.opacity = "1";
        searchBtn.style.fontSize = "20px";
        searchBtn.style.padding = "4px 6px";
        searchBtn.style.color = "#e53935";
        searchBtn.setAttribute("aria-label", "Stop search");
      } else {
        searchBtn.disabled = false;
        searchBtn.textContent = "🔍";
        searchBtn.style.opacity = "1";
        searchBtn.style.fontSize = "20px";
        searchBtn.style.padding = "4px 6px";
        searchBtn.style.background = "transparent";
        searchBtn.style.color = "#64b5f6";
        searchBtn.setAttribute("aria-label", "Run search");
      }
      searchBtn.style.cursor = "pointer";
    }

    function cancelActiveScroll(reason = "cancelled") {
      if (cancelAutoScroll) {
        const cancel = cancelAutoScroll;
        cancelAutoScroll = null;
        cancel(reason);
      }
      if (reason !== "complete") {
        setLoadingIndicatorSuppressed(sidebar, true);
      }
    }

    function stopSearch(reason = "user") {
      const wasScrolling = isScrolling;
      const hadActiveScroll = Boolean(cancelAutoScroll);
      cancelActiveScroll(reason);
      hasLoadedAll = true;
      filterNow();

      if (!hadActiveScroll) {
        if (reason === "match") {
          statusMsg.style.display = "block";
          statusMsg.textContent = "Stopped to show selected conversation.";
        } else if (wasScrolling) {
          statusMsg.style.display = "block";
          statusMsg.textContent =
            reason === "user" ? "Search stopped early." : "Search cancelled.";
        } else if (reason !== "user") {
          statusMsg.style.display = "block";
          statusMsg.textContent = "Search cancelled.";
        } else {
          statusMsg.style.display = "none";
          statusMsg.textContent = "";
        }
      }

      isScrolling = false;
      setSearchingState(false);
    }

    function startSearch() {
      if (isScrolling) return;
      const query = filter.value.trim();
      if (query.length === 0) {
        clearFilter();
        return;
      }

      cancelActiveScroll("cancelled");
      lastSampleLogKey = "";
      hasLoadedAll = false;
      isScrolling = true;
      suppressMatchesPanel = false;
      filterNow();

      statusMsg.textContent = "Searching for more...";
      statusMsg.style.display = "block";
      setSearchingState(true);
      setLoadingIndicatorSuppressed(sidebar, false);

      cancelAutoScroll = autoScrollSidebar(
        sidebar,
        filterNow,
        (finalReason = "complete") => {
          cancelAutoScroll = null;
          if (finalReason !== "cancelled") {
            hasLoadedAll = true;
            filterNow();
          }

          if (finalReason === "complete") {
            statusMsg.textContent = "All conversations searched.";
            statusMsg.style.display = "block";
          } else if (finalReason === "match") {
            statusMsg.textContent = "Stopped to show selected conversation.";
            statusMsg.style.display = "block";
          } else if (finalReason === "user") {
            statusMsg.textContent = "Search stopped early.";
            statusMsg.style.display = "block";
          } else if (finalReason === "cancelled") {
            statusMsg.style.display = "none";
            statusMsg.textContent = "";
          } else {
            statusMsg.textContent = "Search cancelled.";
            statusMsg.style.display = "block";
          }

          isScrolling = false;
          setSearchingState(false);
          setLoadingIndicatorSuppressed(sidebar, true);
        }
      );

      if (!cancelAutoScroll) {
        hasLoadedAll = true;
        filterNow();
        statusMsg.textContent = "All conversations searched.";
        statusMsg.style.display = "block";
        isScrolling = false;
        setSearchingState(false);
        setLoadingIndicatorSuppressed(sidebar, true);
      }
    }

    filter.addEventListener("input", () => {
      const value = filter.value;
      if (!value.trim()) {
        clearFilter();
        return;
      }

      cancelActiveScroll();
      isScrolling = false;
      hasLoadedAll = false;
      lastSampleLogKey = "";
      suppressMatchesPanel = false;
      statusMsg.style.display = "none";
      statusMsg.textContent = "";
      setSearchingState(false);
      filterNow();
    });

    searchBtn.addEventListener("click", () => {
      if (isScrolling) {
        stopSearch("user");
      } else {
        startSearch();
      }
    });

    function clearFilter() {
      cancelActiveScroll();
      if (filter.value !== "") filter.value = "";
      lastSampleLogKey = "";
      hasLoadedAll = false;
      isScrolling = false;
      suppressMatchesPanel = false;
      filterNow();
      filter.focus();
      statusMsg.style.display = "none";
      statusMsg.textContent = "";
      setSearchingState(false);
    }

    clearBtn.addEventListener("click", clearFilter);
    filter.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (isScrolling) {
          stopSearch("user");
        } else {
          startSearch();
        }
      } else if (e.key === "Escape") {
        clearFilter();
      }
    });

    sidebar.addEventListener(
      "pointerdown",
      (event) => {
        const insideControls = controlsContainer.contains(event.target);
        const insideMatches = matchesWrap.contains(event.target);

        if (
          !insideControls &&
          !insideMatches &&
          matchesWrap.style.display === "block"
        ) {
          clearMatches(true);
        }

        if (isScrolling && !insideControls && !insideMatches) {
          stopSearch("user");
        }
      },
      { passive: true, capture: true }
    );

    // Re-apply filter when the chat list changes (new messages, etc.)
    new MutationObserver(filterNow).observe(sidebar, {
      childList: true,
      subtree: true,
    });

    // Optional best-effort cleanup of password-manager overlays inside our wrapper
    const overlayCleaner = new MutationObserver(() => {
      for (const el of wrap.querySelectorAll(
        "iframe, .bitwarden, .bw-overlay"
      )) {
        el.remove();
      }
    });
    overlayCleaner.observe(wrap, { childList: true, subtree: true });

    // Auto-scroll now runs only when the user explicitly starts a search
  }

  let bootObserver;
  function boot() {
    const sidebar = findSidebar();
    if (sidebar) {
      console.info("SMS Contact Filter: sidebar located", sidebar);
      if (bootObserver) bootObserver.disconnect(); // Stop observing once we're done
      attachFilter(sidebar);
    }
  }

  // Watch for when the sidebar appears/changes
  bootObserver = new MutationObserver(boot);
  bootObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("load", boot);
})();
