# 🎾 Club Pádel — Reservas automáticas

App para gestionar reservas de pistas de pádel y actividades dirigidas, con:

- Login con **2FA por email**.
- **Programar reserva**: calendario + pista (1-4 u 5) + franja horaria.
- Ejecución automática de la reserva real contra la API del club, **4 días
  antes** de la fecha del partido, **a las 20:00h**.
- **Mis reservas**: histórico con estado (programada, confirmada, fallida, cancelada).

## Arquitectura (100% gratuita)

| Pieza | Servicio gratuito | Por qué |
|---|---|---|
| Backend (API) | [Render](https://render.com) – Free Web Service | Sin tarjeta de crédito. Se "duerme" tras 15 min sin tráfico, pero eso no es un problema (ver más abajo). |
| Base de datos | [Neon](https://neon.tech) – Postgres serverless | Capa gratuita generosa, sin tarjeta. |
| Frontend | [Vercel](https://vercel.com) o [Netlify](https://netlify.com) | Hosting estático gratuito. |
| Emails 2FA | Gmail SMTP con contraseña de aplicación | Gratis, sin límites prácticos para este volumen. |
| "Reloj" de las 20:00h | **GitHub Actions** (cron programado) | Gratis e ilimitado para uso personal. Es quien realmente dispara la ejecución, así no dependemos de que Render esté despierto justo a las 20:00h. |

### ¿Por qué GitHub Actions y no el cron interno del servidor?

Los planes gratuitos "always-on" reales (Railway, etc.) ya no son gratis.
Render sí lo es, pero apaga el proceso si no recibe tráfico. Por eso, en vez
de confiar en que el proceso Node esté vivo exactamente a las 20:00h, un
workflow de GitHub Actions llama cada noche a un endpoint protegido
(`/internal/run-scheduler`) que despierta el backend y ejecuta las reservas
pendientes. El backend solo actúa sobre las reservas cuya ventana ya llegó,
así que es inofensivo si se llama de más.

## Estructura del proyecto

```
padel-booking-app/
├── backend/         API en Node + Express + TypeScript + Prisma
├── frontend/         React + Vite
└── .github/workflows/nightly-booking.yml   cron gratuito (GitHub Actions)
```

## 1. Desarrollo local

### Backend

```bash
cd backend
cp .env.example .env     # rellena DATABASE_URL, SMTP_*, JWT_SECRET, etc.
npm install
npx prisma migrate dev --name init
npm run dev               # http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

### Probar la automatización sin esperar a las 20:00h

Con sesión iniciada, llama a `POST /reservations/run-now` (ya está montado
en el backend) para forzar la ejecución de las reservas cuya fecha ya
tocaría procesar. También puedes lanzar el workflow de GitHub Actions a
mano desde la pestaña "Actions" del repositorio ("Run workflow").

## 2. Poner en producción, paso a paso

### 2.1 Base de datos (Neon)

1. Crea una cuenta gratuita en neon.tech y un proyecto nuevo.
2. Copia el `connection string` que te dan (formato `postgresql://...`).
3. Pégalo como `DATABASE_URL` en las variables de entorno del backend (paso 2.2).

### 2.2 Backend (Render)

1. Sube este repositorio a GitHub.
2. En Render: **New → Web Service**, conecta el repo, selecciona la carpeta `backend`.
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npx prisma migrate deploy && npm start`
5. Añade todas las variables del `.env.example` del backend en "Environment",
   usando el `DATABASE_URL` de Neon y credenciales SMTP reales.
6. Genera un `CRON_SECRET` aleatorio (por ejemplo con `openssl rand -hex 32`)
   y ponlo también aquí.
7. Despliega. Anota la URL pública, ej. `https://tu-app.onrender.com`.

### 2.3 Emails (Gmail)

1. Activa la verificación en dos pasos en tu cuenta de Gmail.
2. Genera una "contraseña de aplicación" (Google Account → Seguridad →
   Contraseñas de aplicaciones).
3. Usa esa contraseña como `SMTP_PASS`, y tu email como `SMTP_USER`.
4. Gmail PWD: qdss luuc mmbx hqsj

### 2.4 Frontend (Vercel)

1. En Vercel: **New Project**, selecciona la carpeta `frontend` del repo.
2. Variable de entorno `VITE_API_URL` = la URL de Render del paso 2.2.
3. Despliega. Actualiza `FRONTEND_URL` en el backend (Render) con la URL
   final de Vercel, para que CORS funcione correctamente.

### 2.5 El cron gratuito (GitHub Actions)

1. En el repositorio de GitHub: **Settings → Secrets and variables → Actions**.
2. Crea dos secrets:
   - `BACKEND_URL` → la URL de Render (sin barra final), ej. `https://tu-app.onrender.com`
   - `CRON_SECRET` → el mismo valor que pusiste en Render.
3. El workflow `.github/workflows/nightly-booking.yml` ya está listo:
   se dispara automáticamente cada noche (dos horarios, para cubrir el
   cambio de hora verano/invierno) y puedes probarlo manualmente desde la
   pestaña **Actions → Ejecutar reservas programadas → Run workflow**.

## 3. Conexión con PrinciSport (ya implementada)

El flujo completo contra `princiesport.miclubonline.net` ya está implementado
y verificado contra dos capturas `.har` reales (incluyendo login, selección
de franja y confirmación final de la Pista 5):

```
backend/src/services/princiesport.client.ts       login + reserva + confirmación
backend/src/services/princiesport-courts.map.ts   mapeo Pista 1-5 -> códigos del club
backend/src/services/cookie-jar.ts                gestión de la sesión (cookies)
backend/src/services/booking-api.client.ts         punto de entrada usado por el scheduler
```

Por defecto, mientras `CLUB_BOOKING_API_KEY=pendiente` en el `.env`, las
reservas se **simulan** (para poder probar el resto de la app - emails,
estados, cron - sin tocar la web real). En cuanto quieras activarlo de
verdad:

1. Cambia `CLUB_BOOKING_API_KEY` por cualquier valor no vacío (ej. `"activo"`).
2. Prueba con una reserva real usando `POST /reservations/run-now` (o
   lanzando el workflow de GitHub Actions a mano) y revisa los logs del
   backend para confirmar que ha llegado el email de "reserva confirmada".

Si el club cambia algo en su web en el futuro (nuevo campo obligatorio,
otro texto de botón, etc.), lo normal es que solo haga falta tocar
`princiesport.client.ts`.

## 4. Horarios de pistas (ya configurado)

- **Pistas 1-4**: franjas de 1h30 → 16:30, 18:00, 19:30 (hasta 21:00).
- **Pista 5**: franjas de 1h15 → 16:30, 17:45, 19:00, 20:15 (hasta 21:30).

Se puede ajustar en `backend/src/services/courts.config.ts`.
