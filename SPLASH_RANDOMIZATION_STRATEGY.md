// Enhanced Splash Screen Randomization Strategy

## Problem Identified
The user correctly identified that the previous implementation would show repetitive content due to:
1. Limited document fetching (only 10-50 documents)
2. Firestore's predictable ordering without proper randomization
3. No mechanism to ensure full collection coverage over time

## Solution Implemented

### Multi-Strategy Randomization Approach

#### Strategy 1: Large Sample Randomization (Current)
- Fetch 50 documents with `orderBy("__name__")` 
- Randomly select from this larger sample
- Provides better variety than 10 documents

#### Strategy 2: Time-Based Offset (Alternative)
```javascript
// Use current time to create pseudo-random but consistent-within-timeframe selection
const timeBasedOffset = Math.floor(Date.now() / (1000 * 60 * 5)) % totalDocs; // Changes every 5 minutes
```

#### Strategy 3: Session-Based Tracking (Enhanced)
```javascript
// Track shown content in localStorage to avoid immediate repeats
const shownContent = JSON.parse(localStorage.getItem('shownSplashContent') || '[]');
// Filter out recently shown items
// Reset list when all items have been shown
```

#### Strategy 4: Random Field Implementation (Future)
```javascript
// Add randomValue field (0-1) to each document during creation
// Query: where('randomValue', '>=', Math.random()).limit(1)
```

## Current Implementation Benefits
- **Better Coverage**: 50 documents vs 10 (5x improvement)
- **Document Name Ordering**: `orderBy("__name__")` provides consistent but varied base ordering
- **Client-Side Randomization**: Random selection from the fetched sample
- **Fast Performance**: Still only one Firestore query per content type

## Future Enhancements
1. **Session Tracking**: Prevent repeats within session
2. **Weighted Randomization**: Favor less-recently-shown content
3. **Collection Size Awareness**: Adjust sample size based on total collection size
4. **Background Preloading**: Cache next content while current is displaying

## Expected Improvement
- **Before**: User sees same 10 items repeatedly
- **After**: User cycles through 50 different items per session
- **Coverage**: 5x better variety with same performance
