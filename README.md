<div align="center">
  <h1>JobSync Core Services & Data Engine</h1>
  <p>Robust backend infrastructure powering intelligent employment matching and market data aggregation.</p>
</div>

---

## 📖 Overview

The JobSync API serves as the central nervous system for the JobSync platform. Engineered for high performance, reliability, and security, it orchestrates complex data pipelines, user session management, and intelligent data processing. 

At its core, this service manages a **Proprietary Market Data Aggregation Engine**, which continuously ingests, normalizes, and categorizes employment data from across the web. Using advanced AI-driven semantic analysis, we ensure that raw market signals are translated into highly accurate, structured data that seamlessly matches candidates to optimal roles.

## ✨ Core Capabilities

*   **Intelligent Data Aggregation Pipeline:** A resilient, distributed ingestion layer that systematically processes millions of data points across global employment markets, ensuring near real-time data synchronization.
*   **AI-Powered Semantic Analysis:** Integrates Large Language Models (LLMs) via Google Generative AI and Groq to parse complex job descriptions, extract key metadata (e.g., required skills, seniority, salary estimates), and normalize titles across varying industry standards.
*   **Secure Authentication & Authorization:** Implements robust security protocols using JSON Web Tokens (JWT) and OAuth 2.0 via the Google Auth Library, ensuring user data privacy and session integrity.
*   **High-Performance RESTful API:** Built on top of Express.js, the API features optimized routes, strict validation, and comprehensive error handling.
*   **Automated Task Orchestration:** Leverages internal schedulers for precise, automated execution of data aggregation, synchronization, and database cleanup routines.

## 🛠 Technology Stack

*   **Runtime Environment:** [Node.js](https://nodejs.org/) (v18+ Recommended)
*   **Web Framework:** [Express.js](https://expressjs.com/) (Configured as ES Modules)
*   **Database:** [MongoDB](https://www.mongodb.com/) & [Mongoose ORM](https://mongoosejs.com/)
*   **AI / NLP Integration:** Google Generative AI, Groq SDK
*   **Security:** `jsonwebtoken`, `cookie-parser`, `cors`
*   **Job Orchestration:** `node-cron`

## 🏗 System Architecture

The project follows a clean, modular architecture, separating request handling, business logic, and data access.

```text
backend/
├── scripts/                # Database migration and systemic cleanup utilities
└── src/
    ├── api/                # Route Controllers & Handlers
    │   ├── admin.routes.js # Administrative data management
    │   ├── auth.routes.js  # Identity & access management
    │   ├── jobs.routes.js  # Core employment data endpoints
    │   └── me.routes.js    # User-centric operational endpoints
    ├── Db/                 # Database initialization and connection singletons
    ├── middleware/         # Express middleware (e.g., JWT Authentication guards)
    ├── models/             # Mongoose Schemas (User, Job, Data Vectors)
    ├── tasks/              # Data Aggregation & AI Processing pipelines
    ├── utils/              # Shared utility functions and helpers
    └── server.js           # Application Bootstrapper & Middleware configurator
```

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your primary development machine:
- Node.js (v18.x or higher)
- A running MongoDB instance (Local or Atlas Cluster)

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install necessary dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root of the `backend` directory. The application relies on several environment variables for secure operation.

```env
# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/jobsync

# Security
JWT_SECRET=your_super_secret_jwt_key_here

# AI & Processing Engine (Required for Data Normalization)
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_genai_api_key
```

### Running the Service

Start the server in development mode (with hot-reloading via nodemon):
```bash
npm run dev
```

For production environments:
```bash
npm start
```

### Manual Pipeline Triggers

While the **Data Aggregation Engine** runs automatically via scheduled cron jobs, developers can manually trigger sub-routines for testing and verification:

*   **Initialize Aggregation:** `npm run scrape` *(Triggers the proprietary ingestion pipeline)*
*   **Data Validation:** `npm run validate` *(Ensures data structural integrity)*
*   **Data Matching Phase:** `npm run match` *(Triggers advanced AI embedding/matching logic)*

## 📡 API Reference

Below is a brief overview of the core API surfaces available to client applications.

### Authentication (`/api/auth`)
- `POST /signin`: Authenticate via OAuth/credentials and receive a secure HTTP-only JWT.
- `POST /signout`: Invalidate the current session and clear cookies.

### User Operations (`/api/me`)
- `GET /`: Retrieve the profile of the currently authenticated user.
- `PUT /setup`: Update onboarding details and preferences.
- `GET /jobs/saved`: Retrieve jobs bookmarked by the user.

### Job Market Data (`/api/jobs`)
- `GET /`: Retrieve paginated job listings with advanced query filtering.
- `GET /suggestions`: Retrieve AI-suggested jobs based on user profile context.
- `GET /:id`: Fetch detailed, normalized data for a specific role.

## 🔐 Security & Data Privacy

*   **HTTP-Only Cookies:** JWTs are securely stored in HTTP-Only, Secure cookies to prevent XSS attacks.
*   **CORS Policies:** Cross-Origin Resource Sharing is strictly bound to authorized client origins defined in the `.env`.
*   **Data Encryption:** Passwords and sensitive PII are securely hashed prior to database insertion. 

---
*JobSync hub is a proprietary platform. Configuration and inner workings of the data aggregation engine are kept strictly confidential to ensure market competitiveness.*
