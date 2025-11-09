# Chat Jump GitHub Pages Site

This folder contains the GitHub Pages website for Chat Jump.

## Setup Instructions

1. **Push to GitHub:**
   ```bash
   git add docs/
   git commit -m "Add GitHub Pages site"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Under "Branch", select **main** and **/docs** folder
   - Click **Save**

3. **Access Your Site:**
   - Your site will be available at: `https://richieboo.github.io/chat-jump/`
   - It may take a few minutes to deploy

## Updating the Site

After you get your Chrome Web Store URL:

1. Edit `docs/index.html`
2. Find the "Install Chat Jump" button (search for `https://chrome.google.com/webstore/`)
3. Replace with your actual Chrome Web Store extension URL
4. Commit and push changes

```bash
git add docs/index.html
git commit -m "Update Chrome Web Store link"
git push origin main
```

The site will automatically redeploy with your changes.

