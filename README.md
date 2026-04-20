# 💰 Money Mitra — Digital Banking Platform

A full-stack digital banking platform built with **React + Vite** (frontend) and **Node.js + Express** (backend), using **MySQL** as the database.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Required Software](#-required-software-to-install)
- [Step-by-Step Setup](#-step-by-step-setup-after-git-clone)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [Default Admin Credentials](#-default-admin-credentials)
- [Troubleshooting](#-troubleshooting)

---

## 🛠 Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19, Vite, Tailwind CSS        |
| Backend    | Node.js, Express.js                 |
| Database   | MySQL 8                             |
| Auth       | JWT (JSON Web Tokens)               |
| State Mgmt | Zustand                             |
| Charts     | Recharts                            |

---

## 💻 Required Software to Install

Before you begin, make sure you have the following software installed on your computer:

### 1. 🟢 Node.js (v18 or higher)
- **Download:** https://nodejs.org/en/download
- Choose the **LTS (Long Term Support)** version
- This also installs **npm** automatically
- **Verify installation:**
  ```bash
  node -v
  npm -v
  ```

### 2. 🐬 MySQL (v8.0 or higher)
- **Download:** https://dev.mysql.com/downloads/installer/
- Choose **MySQL Installer for Windows**
- During installation, set a **root password** — you will need it later
- Also install **MySQL Workbench** (comes with the installer) for easy database management
- **Verify installation:**
  ```bash
  mysql --version
  ```

### 3. 🔧 Git
- **Download:** https://git-scm.com/downloads
- Required to clone the repository
- **Verify installation:**
  ```bash
  git --version
  ```

### 4. 📝 VS Code (Recommended Editor)
- **Download:** https://code.visualstudio.com/
- Recommended Extensions:
  - ESLint
  - Prettier
  - MySQL (by cweijan)

---

## 🚀 Step-by-Step Setup After Git Clone

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/money-mitra.git
cd money-mitra
```

> ⚠️ Replace `YOUR_USERNAME` and `money-mitra` with the actual GitHub username and repository name.

---

### Step 2 — Set Up the MySQL Database

#### 2a. Open MySQL and create the database

Open **MySQL Workbench** or run this in your terminal:

```bash
mysql -u root -p
```

Enter your MySQL root password when prompted, then run:

```sql
CREATE DATABASE money_mitra;
EXIT;
```

#### 2b. Import the database schema

```bash
mysql -u root -p money_mitra < backend/database/schema.sql
```

#### 2c. (Optional) Seed demo data

```bash
mysql -u root -p money_mitra < backend/database/seed.sql
```

---

### Step 3 — Configure the Backend Environment

```bash
cd backend
copy .env.example .env
```

> On **Mac/Linux**, use `cp .env.example .env`

Now open the `.env` file and **update these values:**

```env
PORT=5000
NODE_ENV=development

# ✅ Update these with your MySQL credentials
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD   ← Change this!
DB_NAME=money_mitra

# JWT Secrets (you can keep these as-is or change them)
JWT_SECRET=money_mitra_super_secret_jwt_key_2024
JWT_REFRESH_SECRET=money_mitra_refresh_secret_2024
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
FRONTEND_URL=http://localhost:5173

APP_NAME=Money Mitra
```

---

### Step 4 — Install Backend Dependencies

Make sure you are inside the `backend` folder:

```bash
cd backend
npm install
```

---

### Step 5 — Initialize the Database via Node Script

```bash
npm run db:init
```

---

### Step 6 — Start the Backend Server

```bash
npm run dev
```

✅ Backend will start at: **http://localhost:5000**

You should see:
```
🚀 Money Mitra Server running on port 5000
✅ Database connected successfully
```

---

### Step 7 — Install Frontend Dependencies

Open a **new terminal window**, then:

```bash
cd frontend
npm install
```

---

### Step 8 — Start the Frontend

```bash
npm run dev
```

✅ Frontend will start at: **http://localhost:5173**

---

### ✅ Both servers must be running at the same time!

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:5173  |
| Backend  | http://localhost:5000  |

---

## 📁 Project Structure

```
money-mitra/
├── backend/
│   ├── database/
│   │   ├── schema.sql          # Database table definitions
│   │   ├── seed.sql            # Sample data
│   │   └── init.js             # DB initialization script
│   ├── src/
│   │   ├── modules/            # Feature modules (auth, cards, loans, etc.)
│   │   ├── middleware/         # Auth, rate limiting, etc.
│   │   └── app.js              # Express app entry point
│   ├── .env.example            # Environment variable template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components
│   │   ├── store/              # Zustand state stores
│   │   └── main.jsx            # React entry point
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## 🔐 Environment Variables

### Backend `.env` (required)

| Variable            | Description                          | Example                    |
|---------------------|--------------------------------------|----------------------------|
| `PORT`              | Port for backend server              | `5000`                     |
| `DB_HOST`           | MySQL host                           | `localhost`                |
| `DB_PORT`           | MySQL port                           | `3306`                     |
| `DB_USER`           | MySQL username                       | `root`                     |
| `DB_PASSWORD`       | MySQL password                       | `yourpassword`             |
| `DB_NAME`           | MySQL database name                  | `money_mitra`              |
| `JWT_SECRET`        | Secret key for JWT tokens            | `any_long_random_string`   |
| `JWT_REFRESH_SECRET`| Secret key for refresh tokens        | `another_long_random_string`|
| `FRONTEND_URL`      | Allowed frontend origin (CORS)       | `http://localhost:5173`    |

---

## 📜 Available Scripts

### Backend (`cd backend`)

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Start backend in development mode    |
| `npm start`        | Start backend in production mode     |
| `npm run db:init`  | Initialize database tables           |
| `npm run db:seed`  | Seed demo data into database         |

### Frontend (`cd frontend`)

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Start frontend dev server            |
| `npm run build`    | Build for production                 |
| `npm run preview`  | Preview production build             |

---

## 👤 Default Admin Credentials

After seeding the database, you can log in with:

| Role    | Email                    | Password    |
|---------|--------------------------|-------------|
| Admin   | `admin@moneymitra.com`   | `Admin@123` |
| User    | `user@moneymitra.com`    | `User@123`  |

> ⚠️ Change these credentials immediately in a production environment!

---

## ❓ Troubleshooting

### ❌ `DB_PASSWORD` error / Can't connect to MySQL
- Make sure MySQL service is running
- Double-check your password in `backend/.env`
- On Windows: Open **Services** → Start **MySQL80**

### ❌ `npm install` fails
- Make sure Node.js version is 18 or above: `node -v`
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

### ❌ Frontend shows blank page or API errors
- Make sure the backend is running on port 5000
- Check that `FRONTEND_URL=http://localhost:5173` is set in `backend/.env`
- Open browser DevTools → Console tab to see error details

### ❌ Port already in use
- Backend: Change `PORT=5000` to `PORT=5001` in `.env`
- Frontend: Run `npm run dev -- --port 5174`

### ❌ MySQL command not found
- Add MySQL to your system PATH
- Or use **MySQL Workbench** GUI to run the SQL commands manually

---

## 📞 Need Help?

If you encounter any issues:
1. Check the **Troubleshooting** section above
2. Open an issue on the GitHub repository
3. Make sure all software versions match the requirements

Or contact the developer directly:

| Platform  | Contact                                                                 |
|-----------|-------------------------------------------------------------------------|
| 💬 WhatsApp | [+91 93398 40967](https://wa.me/919339840967)                        |
| 📧 Gmail    | [ankitdas082006@gmail.com](mailto:ankitdas082006@gmail.com)          |

---

> Made with ❤️ — Money Mitra Digital Banking Platform
