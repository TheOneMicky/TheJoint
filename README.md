# The Joint - Real-Time Collaborative Workout Platform

A comprehensive multiplayer fitness application that enables users to workout together in real-time, track progress, and build lasting fitness partnerships.

## Features

### Core Functionality
- ✅ **Real-Time Multiplayer Workouts**: Collaborative workout sessions with live partner synchronization via Supabase Realtime
- ✅ **Dynamic Workout Templates**: Create, edit, and manage custom workout templates with exercise libraries
- ✅ **Live Activity Feed**: Real-time partner activity tracking showing completed sets and exercises
- ✅ **Matchmaking System**: Find workout partners through intelligent search and invite mechanisms
- ✅ **Session Management**: Host or join workout lobbies with template selection and ready states
- ✅ **Progress Tracking**: Automatic stats logging (reps, minutes, workouts completed) with partner history

### User Experience
- ✅ **Avatar-Only UI**: Clean, space-efficient participant display with fallback initials
- ✅ **Independent Exit Protocol**: Users can leave sessions individually without disrupting partners
- ✅ **Host Lobby Dashboard**: Locked-in state when in active lobby with clear navigation
- ✅ **Graceful Eviction**: Guests save stats before being routed away on session deletion
- ✅ **State Vault Pattern**: Prevents stale closure bugs in async callbacks using React refs
- ✅ **Partner Memory Bank**: Locks partner ID early to prevent null references at session end

### Technical Architecture
- ✅ **2-Player Session Support**: Configurable session capacity with flexible participant management
- ✅ **Race Condition Prevention**: Explicit UI-bound commits and last-person-out logic
- ✅ **Schema-Compliant Logging**: Strict adherence to database schema for session_logs
- ✅ **Local State Mapping**: Exercise names resolved from local template state
- ✅ **Error Handling**: Comprehensive try/catch blocks with user-friendly alerts

## Tech Stack

- **Frontend**: React 19 + Vite 8
- **Styling**: Tailwind CSS 4.2
- **Icons**: Lucide React
- **Backend**: Supabase (Authentication + Database + Realtime)
- **Routing**: React Router DOM 7

## Getting Started

### 1. Environment Setup

Copy the environment variables file:
```bash
cp .env.example .env
```

Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── InviteListener.jsx       # Real-time invite notification handler
│   ├── MatchmakingLobby.jsx     # Partner discovery and invitation UI
│   ├── LoadingScreen.jsx        # App loading animation
│   ├── LoginForm.jsx           # User authentication form
│   ├── SignupForm.jsx          # User registration form
│   └── ProtectedRoute.jsx      # Route protection wrapper
├── contexts/
│   ├── AuthContext.jsx         # Authentication state management
│   └── ThemeContext.jsx        # Dark/light theme management
├── lib/
│   └── supabase.js            # Supabase client configuration
├── pages/
│   ├── AuthPage.jsx            # Login/Signup page
│   ├── Dashboard.jsx           # Main dashboard (legacy)
│   ├── WorkoutDashboard.jsx    # Workout template and matchmaking hub
│   ├── Profile.jsx             # User profile and partner history
│   ├── SessionLobby.jsx        # Pre-workout lobby with template selection
│   ├── WorkoutTracker.jsx      # Real-time workout execution
│   ├── CreateTemplate.jsx      # Workout template builder
│   ├── Landing.jsx             # Landing page
│   ├── ForgotPassword.jsx      # Password recovery
│   └── ResetPassword.jsx       # Password reset form
└── App.jsx                     # Main app with routing
```

## Database Schema

### Core Tables

**profiles** - User profile data with workout stats
```sql
CREATE TABLE profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  total_reps INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  workouts_completed INTEGER DEFAULT 0,
  partner_count INTEGER DEFAULT 0,
  search_status BOOLEAN DEFAULT false,
  current_session_id UUID REFERENCES live_sessions(id)
);
```

**live_sessions** - Active workout sessions
```sql
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(user_id),
  template_id UUID REFERENCES workout_templates(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**session_participants** - Session membership tracking
```sql
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id),
  user_id UUID REFERENCES profiles(user_id),
  status TEXT DEFAULT 'pending'
);
```

**session_logs** - Workout activity logs
```sql
CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_sessions(id),
  user_id UUID REFERENCES profiles(user_id),
  exercise_id UUID REFERENCES exercises(id),
  sets_number INTEGER,
  reps INTEGER,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Key Architectural Patterns

### State Vault Pattern
Prevents stale closure bugs in React async callbacks by storing fresh state in refs:
```javascript
const vaultRef = useRef({ isComplete: false, reps: 0, minutes: 0, partnerId: null });

useEffect(() => {
  vaultRef.current = {
    isComplete: activeExerciseIndex >= templateExercises.length,
    reps: Math.round(totalReps) || 0,
    minutes: Math.round(totalMinutes) || 0,
    partnerId: partnerIdRef.current
  };
}, [activeExerciseIndex, templateExercises, sessionLogs, partnerIdRef.current]);
```

### Independent Exit Protocol
Users leave sessions individually without disrupting partners:
```javascript
const finishAndExit = async () => {
  await commitUserStats();
  
  const { data: participants } = await supabase
    .from('session_participants')
    .select('user_id')
    .eq('session_id', sessionId);

  if (participants && participants.length <= 1) {
    // Last person - delete the session
    await supabase.from('live_sessions').delete().eq('id', sessionId);
  } else {
    // Partner still present - only remove self
    await supabase.from('session_participants').delete().eq('user_id', user.id);
  }
};
```

### Partner Memory Bank
Locks partner ID early to prevent null references:
```javascript
const partnerIdRef = useRef(null);

useEffect(() => {
  if (partnerProfile) {
    partnerIdRef.current = partnerProfile.user_id;
  }
}, [partnerProfile]);
```

## Authentication Flow

1. Users sign up/login through `/auth`
2. Supabase handles authentication
3. A database trigger automatically creates a profile record
4. Authenticated users are redirected to `/dashboard`
5. Users can search for partners or create workout templates
6. Hosts invite partners to sessions via real-time notifications
7. Partners accept invites and join the session lobby
8. Host selects a workout template
9. Both users navigate to the workout tracker
10. Real-time synchronization tracks partner activity
11. Stats are committed on workout completion
12. Partner history is updated automatically

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deployment

This project is deployed and live at https://the-fitness-joint.vercel.app
