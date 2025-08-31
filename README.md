# Staff Panel API Server

A Node.js Express API server that handles database operations for the Roblox Staff Panel system.

## Features

- **PostgreSQL Integration**: Direct connection to Railway PostgreSQL database
- **RESTful API**: Clean endpoints for all database operations
- **CORS Support**: Allows requests from Roblox Studio
- **Error Handling**: Comprehensive error handling and logging
- **Health Checks**: Built-in health monitoring

## API Endpoints

### Health Check
- `GET /health` - Check if the server is running

### Database Operations
- `POST /query` - Execute custom SQL queries
- `POST /init` - Initialize database schema
- `POST /players` - Create or update player
- `POST /moderations` - Create new moderation
- `GET /players/:userId/moderations` - Get player's moderation history
- `GET /moderations/active/:userId/:type` - Get active moderations
- `POST /moderations/cleanup` - Clean up expired moderations
- `GET /statistics` - Get moderation statistics

## Setup Instructions

### 1. Install Dependencies
```bash
cd api-server
npm install
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your Railway database URL
DATABASE_URL=postgresql://postgres:SAibNuAemkVGRayrIarIJTjrbrQYMSaa@switchback.proxy.rlwy.net:58627/railway
PORT=3000
NODE_ENV=development
```

### 3. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 4. Test the Connection
Visit `http://localhost:3000/health` in your browser to verify the server is running.

## Integration with Roblox

The Roblox game will automatically connect to this API server at `http://localhost:3000`. Make sure:

1. **API server is running** before starting the Roblox game
2. **Port 3000 is available** (or change the port in both .env and DatabaseService.lua)
3. **CORS is enabled** (already configured in the server)

## Deployment Options

### Local Development
- Run on your local machine
- Good for testing and development
- Roblox Studio can connect to localhost

### Railway Deployment
You can deploy this API server to Railway:
1. Create a new Railway project
2. Connect your GitHub repository
3. Set environment variables
4. Deploy automatically

### Other Hosting Services
- **Heroku**: Easy deployment with PostgreSQL addon
- **DigitalOcean**: App Platform or Droplet
- **AWS**: EC2 or Lambda
- **Vercel**: Serverless functions

## Troubleshooting

### Database Connection Issues
- Check your Railway database URL
- Verify the database is running
- Check SSL settings

### CORS Issues
- Ensure CORS is enabled in the server
- Check if Roblox Studio can access localhost:3000

### Port Issues
- Change the port in .env if 3000 is in use
- Update DatabaseService.lua to match the new port

## Security Notes

- **API Key**: Consider adding authentication for production
- **Rate Limiting**: Add rate limiting for production use
- **Input Validation**: Validate all inputs before database queries
- **HTTPS**: Use HTTPS in production

## Example Usage

### Initialize Database
```bash
curl -X POST http://localhost:3000/init
```

### Create Player
```bash
curl -X POST http://localhost:3000/players \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123456789, "username": "TestPlayer"}'
```

### Create Moderation
```bash
curl -X POST http://localhost:3000/moderations \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123456789,
    "moderator_id": 987654321,
    "moderator_name": "Admin",
    "type": "ban",
    "reason": "Breaking rules",
    "evidence": ["https://example.com/evidence"],
    "duration_seconds": 3600
  }'
```

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify the database connection
3. Test the API endpoints manually
4. Check the Roblox console for connection errors
