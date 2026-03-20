# Server Restart Instructions

## The Issue
The auth routes were not properly protected by JWT middleware, causing 401 errors when trying to update user profiles.

## What Was Fixed
1. **Separated auth routes**: Split into public and protected routes
2. **Protected routes**: `/auth/user` GET and POST now require JWT authentication
3. **Public routes**: `/auth/callback` and `/auth/signout` remain public

## To Apply the Fix
1. Stop the current Go server (Ctrl+C)
2. Restart the server:
   ```bash
   cd server
   go run server.go
   ```

## Routes After Fix
- **Public**: `POST /api/v1/auth/callback`, `POST /api/v1/auth/signout`
- **Protected**: `GET /api/v1/auth/user`, `POST /api/v1/auth/user`

The edit profile functionality should now work correctly with proper authentication.