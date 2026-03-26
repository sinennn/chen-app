# Edit Profile Feature

## Overview
The Edit Profile feature allows users to update their username and optional user tag through a modal interface.

## Components

### EditProfileModal
- **Location**: `components/edit-profile-modal.tsx`
- **Purpose**: Modal component for editing user profile information
- **Features**:
  - Username validation (3-20 characters, alphanumeric + underscore)
  - User tag validation (2-10 characters, alphanumeric only)
  - Real-time availability checking
  - Animated modal with smooth transitions
  - Error handling and user feedback

### Profile Screen Integration
- **Location**: `app/(tabs)/profile.tsx`
- **Integration**: Edit Profile button opens the modal
- **Refresh**: Automatically refreshes profile data after updates

## Database Schema

### Users Table Updates
```sql
-- Add user_tag column
ALTER TABLE users ADD COLUMN user_tag TEXT;

-- Create unique index for user_tag
CREATE UNIQUE INDEX idx_users_user_tag_unique 
ON users(user_tag) WHERE user_tag IS NOT NULL;
```

## API Integration

### Backend Updates
- **Endpoint**: `POST /api/v1/auth/user`
- **Validation**: Server-side uniqueness checking for user_tag
- **Error Handling**: Returns 409 Conflict for duplicate user_tag

### Frontend API
- **Method**: `api.profile.update(data)`
- **Data**: `{ username: string, user_tag?: string }`
- **Response**: Success/error handling with user feedback

## User Experience

### Validation Rules
- **Username**: 3-20 characters, letters/numbers/underscore only
- **User Tag**: 2-10 characters, letters/numbers only, optional
- **Uniqueness**: Both username and user_tag must be unique

### Visual Feedback
- Real-time validation with error messages
- Loading states during save operations
- Success/error alerts
- Smooth animations and transitions

### Profile Display
- Username displayed prominently
- User tag shown as @usertag when available
- Automatic refresh after updates

## Usage

1. User taps "Edit Profile" button on profile screen
2. Modal opens with current username and user_tag pre-filled
3. User makes changes with real-time validation
4. Save button updates profile via API
5. Profile screen refreshes with new data
6. Success message confirms update

## Error Handling

- **Network errors**: Generic error message
- **Validation errors**: Field-specific error messages
- **Duplicate user_tag**: Specific error for taken user tags
- **Server errors**: Graceful fallback with retry option