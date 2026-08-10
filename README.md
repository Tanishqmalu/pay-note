# 💰 Money Manager

A personal money-management web app you can host **for free on GitHub Pages**.
It uses **Firebase Authentication** (Google + email/password login) and
**Cloud Firestore** (real-time database that syncs across all your devices).

## Features
- 🔐 Login with Google or email/password
- 💸 Credit & debit transactions
- 💳 Custom payment methods (Cash, UPI, Card, …)
- 🏷️ Custom tags (Swiggy, Shopping, Meals, …)
- 👥 Shared expenses with **settle-up tracking** (mark who has paid you back)
- 📊 Live summary: income, expense, balance, and total owed to you
- 📱 Responsive UI (works on phone and laptop)
- Default currency: **₹ INR** (change in `js/firebase-config.js`)

---

## Project structure
```
MoneyManagement/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js              # all app logic (auth + Firestore + UI)
│   └── firebase-config.js  # <-- paste your Firebase keys here
├── firestore.rules         # security rules (per-user isolation)
└── README.md
```

---

## Part 1 — Set up Firebase (one time, ~10 min)

You have a Google account, so no new signup is needed.

### 1. Create a Firebase project
1. Go to <https://console.firebase.google.com/>.
2. Click **Add project** → give it a name (e.g. `money-manager`) → continue.
3. Google Analytics is optional; you can turn it off. Click **Create project**.

### 2. Register a Web app
1. On the project overview page, click the **`</>` (Web)** icon.
2. Give it a nickname (e.g. `web`). **Do not** check "Firebase Hosting" (we use GitHub Pages).
3. Click **Register app**. Firebase shows a `firebaseConfig = { ... }` block.
4. Copy those values into **`js/firebase-config.js`**, replacing every `YOUR_...` placeholder.

### 3. Enable Authentication
1. Left menu → **Build → Authentication → Get started**.
2. Open the **Sign-in method** tab.
3. Enable **Email/Password** → Save.
4. Enable **Google** → pick a support email → Save.

### 4. Create the Firestore database
1. Left menu → **Build → Firestore Database → Create database**.
2. Choose a location (pick one near you, e.g. `asia-south1` for India).
3. Start in **production mode** (we'll paste secure rules next).

### 5. Apply the security rules
1. In **Firestore Database → Rules** tab.
2. Replace everything with the contents of **`firestore.rules`** from this repo.
3. Click **Publish**.
   > These rules ensure each user can only read/write their **own** data.

### 6. Authorize your domains
Firebase only allows sign-in from approved domains.
1. **Authentication → Settings → Authorized domains → Add domain**.
2. Add your GitHub Pages domain: `YOUR_USERNAME.github.io`
   (`localhost` is already allowed for local testing).

---

## Part 2 — Test locally (optional but recommended)

Because the app uses ES modules, open it through a local server (not `file://`):

```bash
# from the project folder
python3 -m http.server 8000
```
Then visit <http://localhost:8000>. Sign up, add a transaction, and confirm it appears.

---

## Part 3 — Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `money-manager`).
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Money Manager app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/money-manager.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages**.
4. Under **Build and deployment**, set **Source = Deploy from a branch**,
   **Branch = `main`**, folder **`/ (root)`** → **Save**.
5. Wait ~1 minute. Your app is live at:
   `https://YOUR_USERNAME.github.io/money-manager/`
6. Make sure you added that exact domain in **Firebase → Authorized domains** (Part 1, step 6).

Done! 🎉

---

## How shared expenses work
- Add an expense with the **total you paid** and the list of **people** (you + friends).
- Leave a person's *share* blank to auto-split the remainder **equally**; or type exact amounts.
- "You" are auto-marked settled (it's your own money).
- Each friend shows **owes you** / **settled**; tap **Mark paid** when they repay you.
- The **Owed to you** summary card totals everything still pending across all shared expenses.

## Notes on security
- The Firebase config keys in `firebase-config.js` are **safe to be public** — this is
  standard for Firebase web apps. Your data is protected by the **Firestore security rules**,
  which restrict every document to its owner.
- To change currency/locale, edit `CURRENCY` and `LOCALE` in `js/firebase-config.js`.

## Free-tier limits (Firebase Spark plan)
Plenty for personal use: 50K reads / 20K writes per day, 1 GB stored, unlimited email/Google auth. No credit card required.
