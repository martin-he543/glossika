# ClozeBlaster Backend - Project Structure

```
clozeblaster-backend/
├── src/
│   ├── index.ts                 # Main server entry point
│   ├── db/
│   │   └── connection.ts       # PostgreSQL connection pool
│   ├── routes/
│   │   ├── auth.ts             # Authentication endpoints
│   │   ├── play.ts             # Play/answer endpoints
│   │   ├── reviews.ts          # Review queue endpoints
│   │   ├── collections.ts      # Collection management
│   │   └── leaderboard.ts      # Leaderboard endpoints
│   ├── utils/
│   │   ├── srs.ts              # SRS algorithm implementation
│   │   ├── srs.test.ts         # SRS unit tests
│   │   └── cloze-generator.ts  # Generate cloze items from sentences
│   └── scripts/
│       └── seed.ts              # Database seeding script
├── database/
│   └── schema.sql              # PostgreSQL schema
├── package.json
├── tsconfig.json
├── jest.config.js
├── README.md
└── .env.example
```

## Key Files

### Core SRS Logic
- `src/utils/srs.ts` - Implements staged SRS and SM-2 algorithms
- `src/utils/srs.test.ts` - Comprehensive unit tests

### API Routes
- `src/routes/play.ts` - Core gameplay endpoints
- `src/routes/auth.ts` - User authentication
- `src/routes/reviews.ts` - Review queue management
- `src/routes/collections.ts` - Collection CRUD and CSV upload
- `src/routes/leaderboard.ts` - Leaderboard queries

### Database
- `database/schema.sql` - Complete PostgreSQL schema with indexes and triggers

## Next Steps

1. Add authentication middleware to protected routes
2. Implement TTS integration
3. Add Redis caching for leaderboards
4. Create admin endpoints
5. Add integration tests

