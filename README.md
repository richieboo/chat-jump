# Chat Jump

## Build Steps

1. Install dependencies (first time only):  
   `npm install`
2. Produce the distributable bundle:  
   `npm run build`

The build step copies `background.js`, `content.js`, `manifest.json`, `info.html`, and the `icons/` folder into `dist/`.  
Remember to bump the `version` field in `manifest.json` before each release.

## Create Chrome Web Store Zip

After running the build, package everything inside `dist/` into a zip. Example PowerShell command:

`Compress-Archive -Path dist\* -DestinationPath chat-jump-<version>.zip -Force`

Upload that archive to the Chrome Web Store Developer Dashboard.

## Optional: Generate a .crx for Side-Loading

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Pack extension…**.
4. Choose the `dist` directory as the extension root and provide your private key if you have one (Chrome can generate one).

Chrome will emit both a `.crx` file and a `.pem` key. Keep the `.pem` safe for future signed builds.
