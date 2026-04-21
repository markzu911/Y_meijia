<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run locally

This project uses an Express backend to call Gemini, and the backend reads the API key from `.env`.
It also proxies the SaaS `launch / verify / consume` endpoints used for user info and integral checks.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env`, then set `GEMINI_API_KEY`
3. If needed, update `SAAS_API_BASE_URL` to your SaaS backend address
4. Run the app:
   `npm run dev`
