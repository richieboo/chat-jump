# Chrome Web Store Submission Guide

This guide walks you through submitting ChatJump to the Chrome Web Store.

## Quick Build & Package

1. **Build the extension:**

   ```bash
   npm run build
   ```

2. **Create ZIP for upload:**

   ```powershell
   Compress-Archive -Path "dist\*" -DestinationPath "chat-jump.zip" -Force
   ```

3. **Upload `chat-jump.zip` to Chrome Web Store**

---

## First-Time Setup

### Step 1: Create Developer Account

1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay the one-time $5 developer registration fee
4. Accept the developer agreement

---

## Required Assets for Store Listing

### Screenshots (Required)

- **Size:** 1280x800 pixels (recommended)
  - Minimum: 640x400 pixels
  - Maximum: 3840x2400 pixels
- **Format:** PNG or JPEG (PNG preferred)
- **Quantity:** At least 1, recommend 3-5
- **Content:** Show ChatJump in action on Google Messages
  - Search panel with results
  - Different search modes
  - Extension integrated with Google Messages

### Store Icon

- ✅ Already have: `icons/icon128.png`

### Promotional Images (Optional but Recommended)

- **Small tile:** 440x280 pixels
- **Marquee:** 1400x560 pixels (for featured placement)

---

## Store Listing Information

### Basic Information

- **Name:** Chat Jump
- **Short Description:** Quickly jump to the conversations you need in Google Messages™.
- **Category:** Productivity or Social & Communication
- **Language:** English

### Detailed Description

```
Chat Jump helps you quickly locate and reopen past chats in Google Messages™ by searching names or keywords — no more scrolling through endless conversations.

HIGHLIGHTS:
• Search your conversations by contact or chat name and open them instantly
• Click any result to jump straight into that chat and continue your conversation
• Choose Full Conversation mode to search through message text when you need deeper results
• Finds what you need fast — from your latest chats to the ones buried deep in history

GETTING THE MOST OUT OF IT:
• Type a name or word to start narrowing down your chats
• Click the magnifying-glass icon or press Enter to scan through older conversations
• Switch between Chat Name and Full Conversation modes depending on what you need
• Click a result to open the chat right away and pick up where you left off
• Press Esc to reset your search when you're done
• Use the Chat Jump toggle button if you want to show or hide the panel

Chat Jump is a small, independent project built with care. If it helps you get to your conversations faster, consider supporting development at https://www.buymeacoffee.com/richieboo
```

### Privacy Practices

**Single Purpose:**

> Search and navigation for Google Messages conversations

**Data Collection Statement:**

> This extension does not collect, store, or transmit any user data. All search and filtering happens locally in your browser.

**Permissions Justification:**

- **Host Permission (messages.google.com):** Required to inject the search interface and access the conversation list for filtering
- **No other permissions required**

### Support & Contact

- **Support Email:** richie@workingdogworx.com
- **Website:** https://richieboo.github.io/chat-jump/

---

## Submission Process

### Step 1: Upload to Chrome Web Store

1. Go to Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
2. Click **"New Item"**
3. Upload `chat-jump.zip`
4. Click **"Save draft"**

### Step 2: Fill in Store Listing

1. **Product Details:**

   - Add name, description, category
   - Upload store icon (128x128)
   - Upload screenshots (3-5 recommended)
   - Add promotional images (optional)

2. **Privacy Practices:**

   - Single purpose: "Search and navigation for Google Messages conversations"
   - Data collection: "This extension does not collect any user data"
   - Justify permissions

3. **Distribution:**
   - Choose visibility (Public, Unlisted, or Private)
   - Select regions/countries

### Step 3: Submit for Review

1. Review all information
2. Click **"Submit for Review"**
3. Wait for review (typically 1-3 business days, sometimes longer)

### Possible Outcomes

- ✅ **Approved and published** - Extension goes live!
- ⚠️ **Rejected with feedback** - Address issues and resubmit

---

## Updates & Maintenance

### To Update the Extension:

1. Update version in `manifest.json`
2. Make your code changes
3. Run `npm run build`
4. Create new ZIP: `Compress-Archive -Path "dist\*" -DestinationPath "chat-jump.zip" -Force`
5. Go to Chrome Web Store Developer Dashboard
6. Select your extension
7. Click **"Upload New Package"**
8. Upload the new `chat-jump.zip`
9. Update store listing if needed
10. Click **"Submit for Review"**

---

## Troubleshooting

### Build Issues

- Make sure dependencies are installed: `npm install`
- Clean build: `npm run clean && npm run build`

### ZIP Issues

- Make sure you're zipping the contents of `dist/`, not the `dist/` folder itself
- Check that `manifest.json` is at the root of the ZIP

### Review Rejection

- Read rejection feedback carefully
- Common issues: privacy policy missing, permissions not justified, misleading screenshots
- Address all issues mentioned
- Resubmit with changes

---

## Quick Reference

**Build Command:**

```bash
npm run build
```

**Package Command:**

```powershell
Compress-Archive -Path "dist\*" -DestinationPath "chat-jump.zip" -Force
```

**Developer Dashboard:**
https://chrome.google.com/webstore/devconsole

**Support Email:**
richie@workingdogworx.com
