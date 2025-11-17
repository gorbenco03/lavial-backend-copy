# 🚌 Lavial Backend API

<div align="center">

![Lavial Logo](https://img.shields.io/badge/Lavial-Backend-6366f1?style=for-the-badge&logo=buffer&logoColor=white)

**Backend API production-ready pentru platforma de rezervare bilete de autocar Lavial**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat&logo=stripe&logoColor=white)](https://stripe.com/)

*Dezvoltat de [Chiril Gorbenco](https://github.com/gorbenco03)*

</div>

---

## 📋 Cuprins

- [Despre](#-despre)
- [Caracteristici](#-caracteristici)
- [Stack Tehnologic](#-stack-tehnologic)
- [Instalare](#-instalare)
- [Configurare](#-configurare)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)
- [Contribuții](#-contribuții)
- [Licență](#-licență)

---

## 🎯 Despre

**Lavial** este o platformă modernă de rezervare bilete de autocar care conectează orașe din România și Republica Moldova. Acest backend oferă o API RESTful robustă pentru gestionarea rutelor, rezervărilor, plăților și biletelor.

### Aplicație Mobile
Această aplicație este disponibilă în **App Store** și **Google Play Store**. Backend-ul oferă suport complet pentru:
- ✅ Rezervări în timp real
- ✅ Plăți securizate cu Stripe (Apple Pay, Google Pay, Card)
- ✅ Generare automată de bilete PDF cu QR codes
- ✅ Notificări email
- ✅ Gestionare promo codes și reduceri pentru studenți

---

## ✨ Caracteristici

- 🔐 **Securitate**: Helmet, CORS configurat, rate limiting, validare input
- 💳 **Plăți**: Integrare completă Stripe cu suport pentru Apple Pay și Google Pay
- 📧 **Email**: Trimite automat bilete PDF către clienți
- 🎫 **Bilete**: Generare PDF cu QR codes pentru validare
- 🎟️ **Promo Codes**: Sistem flexibil de coduri promoționale
- 🎓 **Reduceri Studenți**: Suport pentru reduceri speciale pentru studenți
- 📊 **Admin API**: Endpoints pentru gestionarea rutelor și datelor
- 🚀 **Production Ready**: Optimizat pentru deployment în producție

---

## 🛠️ Stack Tehnologic

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB cu Mongoose ODM
- **Payment**: Stripe API
- **Email**: Nodemailer
- **PDF**: PDFKit
- **QR Codes**: QRCode

### Security & Middleware
- **Helmet**: Securitate HTTP headers
- **CORS**: Cross-Origin Resource Sharing
- **Rate Limiting**: Protecție împotriva DDoS
- **Express Validator**: Validare input
- **Compression**: Comprimare răspunsuri
- **Morgan**: Logging HTTP requests

---

## 📦 Instalare

### Cerințe
- Node.js >= 18.x
- MongoDB (local sau MongoDB Atlas)
- npm sau yarn

### Pași de instalare

1. **Clonează repository-ul**
```bash
git clone https://github.com/gorbenco03/lavial-backend.git
cd lavial-backend
```

2. **Instalează dependențele**
```bash
npm install
```

3. **Configurează variabilele de mediu**
```bash
cp .env.example .env
```

Editează fișierul `.env` și completează cu datele tale (vezi secțiunea [Configurare](#-configurare)).

4. **Pornește MongoDB** (dacă folosești local)
```bash
# macOS/Linux cu Homebrew
brew services start mongodb-community

# sau cu Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

5. **Populează database-ul cu date inițiale**
```bash
npm run seed
```

6. **Pornește serverul**
```bash
# Development mode (cu hot reload)
npm run dev

# Production build
npm run build
npm start
```

Serverul va rula pe `http://localhost:3000` (sau portul configurat în `.env`).

---

## ⚙️ Configurare

### Variabile de Mediu

Creează un fișier `.env` în root-ul proiectului bazat pe `.env.example`:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/lavial
# sau pentru MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lavial

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Email (SendGrid sau SMTP)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
EMAIL_FROM=noreply@lavial.com

# CORS
CORS_ORIGINS=http://localhost:3000,https://app.lavial.com
FRONTEND_URL=https://app.lavial.com
```

### Configurare Stripe

1. Creează un cont pe [Stripe Dashboard](https://dashboard.stripe.com)
2. Obține **Secret Key** din secțiunea **API Keys**
3. Pentru webhooks în development:
```bash
# Instalează Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/payments/webhook
```
4. Copiază webhook secret-ul afișat și adaugă-l în `.env`

### Configurare Email

#### Opțiunea 1: SendGrid (Recomandat)
1. Creează cont pe [SendGrid](https://sendgrid.com)
2. Generează un API Key
3. Configurează în `.env`:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
```

#### Opțiunea 2: Gmail SMTP
1. Activează "App Passwords" în contul Google
2. Configurează în `.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Configurare MongoDB

#### Local
```bash
brew install mongodb-community
brew services start mongodb-community
```

#### MongoDB Atlas (Cloud - Recomandat pentru producție)
1. Creează cont pe [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Creează un cluster gratuit
3. Obține connection string
4. Adaugă în `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lavial
```

---

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Orașe și Rute

#### Obține toate orașele
```
GET /api/cities
```

**Response:**
```json
{
  "cities": ["Chișinău", "Brașov", "Sibiu", "Alba Iulia", ...]
}
```

#### Obține destinații dintr-un oraș
```
GET /api/destinations/:from
```

#### Caută informații despre o călătorie
```
POST /api/trips/search
```

**Request:**
```json
{
  "from": "Chișinău",
  "to": "Brașov",
  "date": "2024-12-25T00:00:00.000Z"
}
```

### Rezervări

#### Creează rezervare
```
POST /api/bookings
```

**Request:**
```json
{
  "from": "Chișinău",
  "to": "Brașov",
  "date": "2024-12-25T00:00:00.000Z",
  "passenger": {
    "name": "Ion",
    "surname": "Popescu",
    "email": "ion@example.com",
    "phone": "0712345678"
  },
  "promoCode": "WELCOME10",
  "studentDiscount": 10
}
```

#### Obține rezervare
```
GET /api/bookings/:bookingId
```

### Plăți

#### Creează Payment Intent (Stripe)
```
POST /api/payments/payment-sheet
```

**Request:**
```json
{
  "bookingId": "BK-A1B2C3D4"
}
```

**Response:**
```json
{
  "paymentIntent": "pi_xxx_secret_xxx",
  "ephemeralKey": "ek_xxx",
  "customer": "cus_xxx"
}
```

#### Webhook Stripe
```
POST /api/payments/webhook
```
(Apelat automat de Stripe când plata este procesată)

### Bilete

#### Obține bilet
```
GET /api/tickets/:ticketId
```

#### Obține bilete după email
```
GET /api/tickets/email/:email
```

#### Validează QR code
```
POST /api/tickets/validate
```

**Request:**
```json
{
  "qrToken": "uuid-token"
}
```

### Promo Codes

#### Validează cod promoțional
```
POST /api/promo/validate
```

**Request:**
```json
{
  "code": "WELCOME10",
  "subtotal": 125
}
```

### Admin (Gestionare Rute)

#### Obține toate rutele
```
GET /api/admin/routes?active=true
```

#### Creează rută
```
POST /api/admin/routes
```

#### Actualizează rută
```
PATCH /api/admin/routes/:id
```

#### Șterge rută
```
DELETE /api/admin/routes/:id
```

---

## 🚀 Deployment

### Railway (Recomandat - Gratis)

1. Creează cont pe [Railway](https://railway.app)
2. Conectează repository-ul GitHub
3. Adaugă MongoDB din Marketplace
4. Configurează environment variables în dashboard
5. Deploy automat la fiecare push!

### Heroku

```bash
heroku create lavial-api
heroku addons:create mongolab:sandbox
heroku config:set STRIPE_SECRET_KEY=sk_live_xxx
# ... alte variabile
git push heroku main
```

### VPS (Digital Ocean, AWS, etc.)

```bash
# Build
npm run build

# Start cu PM2
npm install -g pm2
pm2 start dist/server.js --name lavial-api
pm2 save
pm2 startup
```

### Docker (Opțional)

Creează un `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test cities endpoint
curl http://localhost:3000/api/cities

# Test trip search
curl -X POST http://localhost:3000/api/trips/search \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Chișinău",
    "to": "Brașov",
    "date": "2024-12-25T00:00:00.000Z"
  }'
```

---

## 📝 Scripts Disponibile

```bash
npm run dev          # Development cu hot reload
npm run build        # Build pentru production
npm start            # Start production server
npm run seed         # Populează database-ul cu date inițiale
npm run check-routes # Verifică rutele disponibile
```

---

## 🔒 Securitate

- ✅ Toate variabilele sensibile sunt în `.env` (nu sunt commit-uite)
- ✅ Validare input cu express-validator
- ✅ Rate limiting pentru protecție DDoS
- ✅ CORS configurat corect
- ✅ Helmet pentru securitate HTTP headers
- ✅ Stripe webhook signature verification

**⚠️ IMPORTANT**: Nu comite niciodată fișierul `.env` sau chei API în cod!

---

## 📄 Structură Proiect

```
lavial-backend/
├── src/
│   ├── config/          # Configurare database
│   ├── controllers/     # Logică business
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── utils/           # Utilitare (PDF, email, seed)
│   └── server.ts        # Entry point
├── public/              # Fișiere statice (Apple Pay verification)
├── .env.example         # Template pentru variabile de mediu
├── .gitignore          # Git ignore rules
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── README.md           # Documentație
```

---

## 🤝 Contribuții

Contribuțiile sunt binevenite! Pentru modificări majore, deschide un issue pentru a discuta ce vrei să schimbi.

1. Fork repository-ul
2. Creează un branch pentru feature (`git checkout -b feature/AmazingFeature`)
3. Commit modificările (`git commit -m 'Add some AmazingFeature'`)
4. Push la branch (`git push origin feature/AmazingFeature`)
5. Deschide un Pull Request

---

## 📞 Support

Pentru întrebări sau probleme:
- 📧 Email: rezervari.lavial@gmail.com

---

## 👨‍💻 Autor

**Chiril Gorbenco**

- GitHub: [@chirilgorbenco](https://github.com/chirilgorbenco)
- LinkedIn: [Chiril Gorbenco](https://linkedin.com/in/chiril-gorbenco)

---

## 📄 Licență

Acest proiect este licențiat sub licența MIT - vezi fișierul [LICENSE](LICENSE) pentru detalii.

---

<div align="center">

**Făcut cu ❤️ pentru comunitatea Lavial**

⭐ Dacă ți-a plăcut proiectul, lasă un star!

</div>
