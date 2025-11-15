# ClozeBlaster Backend API

A Clozemaster-style language learning API built with Node.js, Express, and PostgreSQL.

## Features

- Sentence-level cloze exercises
- Multiple learning modes (Multiple Choice, Text Input, Listening)
- Spaced Repetition System (SRS) with staged intervals
- Collections management
- User progress tracking
- Leaderboards
- TTS support

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clozeblaster
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-secret-key-here
PORT=3001

REDIS_HOST=localhost
REDIS_PORT=6379
```

### Database Setup

1. Create the database:
```bash
createdb clozeblaster
```

2. Run the schema:
```bash
psql clozeblaster < database/schema.sql
```

3. Seed the database:
```bash
npm run seed
```

### Running

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

### Testing

```bash
npm test
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Play
- `GET /api/play/new?language=en&mode=mc&page=1` - Get cloze items
- `POST /api/play/answer` - Submit answer

### Reviews
- `GET /api/reviews/queue?language=en` - Get items due for review

### Collections
- `GET /api/collections?language=en` - List collections
- `POST /api/collections` - Create collection (CSV upload)

### Leaderboard
- `GET /api/leaderboard?language=en` - Get leaderboard

## SRS Algorithm

Default staged intervals:
- 0% mastery: Same day (1 hour)
- 25% mastery: 1 day
- 50% mastery: 10 days
- 75% mastery: 30 days
- 100% mastery: 180 days

## License

MIT

