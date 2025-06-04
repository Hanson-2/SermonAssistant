/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// export { universalScriptureSearch, getAllUniqueTags, getAllUniqueTranslations } from "./universalSearch";
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
    universalScriptureSearchHandler,
    getAllUniqueTagsHandler,
    getAllUniqueTranslationsHandler,
    batchUpdateTagsByCriteriaHandler
} from "./universalSearch";
// Remove v2 imports
// import { onCall, CallableRequest } from "firebase-functions/v2/https";

// UserScriptureVersion interface
interface UserScriptureVersion {
  id?: string;
  userId: string;
  name: string;
  abbreviation: string;
  description?: string;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

// UserScripture interface
interface UserScripture {
  id?: string;
  userId: string;
  versionId: string; // Link to user's custom version
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tags?: string[];
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

// UserTag interface
interface UserTag {
  id?: string;
  userId: string;
  name: string;
  displayName: string;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

// SermonFolder interface
interface SermonFolder {
  id?: string;
  userId: string;
  name: string;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

// User Profile interfaces
interface UserProfile {
  id?: string;
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  preferences: {
    defaultBibleVersion: string;
    theme: 'light' | 'dark' | 'auto';
    language: string;
    emailNotifications: boolean;
    autoSave: boolean;
    sermonBackupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
    pushNotifications?: boolean;
    showWelcomeScreen?: boolean;
    enableKeyboardShortcuts?: boolean;
    showPreviewPane?: boolean;
  };
  
  // Theme Settings (from ThemeSettingsPage)
  themeSettings?: {
    themeMode: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    accentColor?: string;
    backgroundImage?: string;
    fontFamily?: string;
    fontSize?: 'small' | 'medium' | 'large';
    compactMode?: boolean;
    highContrast?: boolean;
    reducedMotion?: boolean;
    customCSS?: string;
  };
  
  // UI Customization (from CustomizeUIPage)
  uiCustomization?: {
    // Layout Settings
    sidebarPosition: 'left' | 'right' | 'hidden';
    navigationStyle: 'horizontal' | 'vertical' | 'compact';
    contentWidth: 'narrow' | 'medium' | 'wide' | 'full';
    
    // Component Visibility
    showWelcomeMessage: boolean;
    showQuickActions: boolean;
    showRecentSermons: boolean;
    showStatistics: boolean;
    showSearchSuggestions: boolean;
    
    // Grid Layout
    dashboardColumns: 1 | 2 | 3 | 4;
    cardSize: 'compact' | 'normal' | 'large';
    cardSpacing: 'tight' | 'normal' | 'loose';
    
    // Typography & Spacing
    interfaceScale: 80 | 90 | 100 | 110 | 120;
    lineHeight: 'compact' | 'normal' | 'relaxed';
    buttonSize: 'small' | 'medium' | 'large';
    
    // Toolbar & Actions
    showToolbarLabels: boolean;
    toolbarPosition: 'top' | 'bottom' | 'floating';
    quickActionButtons: string[];
    
    // Advanced Options
    enableAnimations: boolean;
    showTooltips: boolean;
    enableKeyboardNavigation: boolean;
    autoCollapseSidebar: boolean;
  };
  
  statistics: {
    totalSermons: number;
    totalVerses: number;
    totalTags: number;
    totalFolders: number;
    totalVersions: number;
    joinDate: string;
    lastActivity: string;
  };
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

// Add a new user scripture version
type AddUserScriptureVersionData = {
  name: string;
  abbreviation: string;
  description?: string;
};

// Add a new user scripture
type AddUserScriptureData = {
  versionId: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tags?: string[];
};

type AddUserTagData = {
  name: string;
  displayName: string;
};

type AddSermonFolderData = {
  name: string;
};

type UpdateSermonFolderData = {
  folderId: string;
  name: string;
};

type DeleteSermonFolderData = {
  folderId: string;
};

type UpdateUserProfileData = {
  userId: string;
  profile: {
    displayName?: string;
    preferences?: Partial<UserProfile['preferences']>;
  };
};

// Cloud Functions

export const universalScriptureSearch = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    return universalScriptureSearchHandler({ data, auth: context.auth });
  }
);

export const getAllUniqueTags = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    return getAllUniqueTagsHandler({ data, auth: context.auth });
  }
);

export const getAllUniqueTranslations = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    return getAllUniqueTranslationsHandler({ data, auth: context.auth });
  }
);

export const batchUpdateTagsByCriteria = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    return batchUpdateTagsByCriteriaHandler({ data, auth: context.auth });
  }
);

// Add a new user scripture version
export const addUserScriptureVersion = functions.https.onCall(
  async (data: AddUserScriptureVersionData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to add a version.");
    }
    const userId = context.auth.uid;
    if (!data.name || !data.abbreviation) {
      throw new functions.https.HttpsError("invalid-argument", "Name and abbreviation are required.");
    }
    const docRef = await admin.firestore().collection("userScriptureVersions").add({
      userId,
      name: data.name,
      abbreviation: data.abbreviation,
      description: data.description || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { versionId: docRef.id };
  }
);

// Get all user scripture versions for the current user
export const getUserScriptureVersions = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view your versions.");
    }
    const userId = context.auth.uid;
    const snapshot = await admin.firestore().collection("userScriptureVersions").where("userId", "==", userId).get();
    const versions: UserScriptureVersion[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserScriptureVersion));
    return { versions };
  }
);

// Add a user scripture
export const addUserScripture = functions.https.onCall(
  async (data: AddUserScriptureData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to add scripture.");
    }
    const userId = context.auth.uid;
    if (!data.versionId || !data.book || !data.chapter || !data.verse || !data.text) {
      throw new functions.https.HttpsError("invalid-argument", "All fields except tags are required.");
    }
    const docRef = await admin.firestore().collection("userScriptures").add({
      userId,
      versionId: data.versionId,
      book: data.book,
      chapter: data.chapter,
      verse: data.verse,
      text: data.text,
      tags: data.tags || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { scriptureId: docRef.id };
  }
);

// Get user scriptures
export const getUserScriptures = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view your scriptures.");
    }
    const userId = context.auth.uid;
    const versionId = data?.versionId;
    let query = admin.firestore().collection("userScriptures").where("userId", "==", userId);
    if (versionId) query = query.where("versionId", "==", versionId);
    const snapshot = await query.get();
    const scriptures: UserScripture[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserScripture));
    return { scriptures };
  }
);

// Add a user tag
export const addUserTag = functions.https.onCall(
  async (data: AddUserTagData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to add a tag.");
    }
    const userId = context.auth.uid;
    if (!data.name || !data.displayName) {
      throw new functions.https.HttpsError("invalid-argument", "Name and displayName are required.");
    }
    const docRef = await admin.firestore().collection("userTags").add({
      userId,
      name: data.name,
      displayName: data.displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { tagId: docRef.id };
  }
);

// Get user tags
export const getUserTags = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view your tags.");
    }
    const userId = context.auth.uid;
    const snapshot = await admin.firestore().collection("userTags").where("userId", "==", userId).get();
    const tags: UserTag[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTag));
    return { tags };
  }
);

// Add a new sermon folder
export const addSermonFolder = functions.https.onCall(
  async (data: AddSermonFolderData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to add a folder.");
    }
    const userId = context.auth.uid;
    if (!data.name) {
      throw new functions.https.HttpsError("invalid-argument", "Folder name is required.");
    }
    const docRef = await admin.firestore().collection("sermonFolders").add({
      userId,
      name: data.name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { folderId: docRef.id };
  }
);

// Get all sermon folders for the current user
export const getSermonFolders = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view your folders.");
    }
    const userId = context.auth.uid;
    const snapshot = await admin.firestore().collection("sermonFolders").where("userId", "==", userId).get();
    const folders: SermonFolder[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SermonFolder));
    return { folders };
  }
);

// Update a sermon folder's name
export const updateSermonFolder = functions.https.onCall(
  async (data: UpdateSermonFolderData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to update a folder.");
    }
    const userId = context.auth.uid;
    if (!data.folderId || !data.name) {
      throw new functions.https.HttpsError("invalid-argument", "Folder ID and new name are required.");
    }
    const folderRef = admin.firestore().collection("sermonFolders").doc(data.folderId);
    const folderSnap = await folderRef.get();
    if (!folderSnap.exists || folderSnap.data()?.userId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to update this folder.");
    }
    await folderRef.update({
      name: data.name,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

// Delete a sermon folder
export const deleteSermonFolder = functions.https.onCall(
  async (data: DeleteSermonFolderData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete a folder.");
    }
    const userId = context.auth.uid;
    if (!data.folderId) {
      throw new functions.https.HttpsError("invalid-argument", "Folder ID is required.");
    }
    const folderRef = admin.firestore().collection("sermonFolders").doc(data.folderId);
    const folderSnap = await folderRef.get();
    if (!folderSnap.exists || folderSnap.data()?.userId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to delete this folder.");
    }
    await folderRef.delete();
    return { success: true };
  }
);

// Update user profile
export const updateUserProfile = functions.https.onCall(
  async (data: UpdateUserProfileData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to update your profile.");
    }
    const userId = context.auth.uid;
    if (data.userId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "You can only update your own profile.");
    }
    const userRef = admin.firestore().collection("userProfiles").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }
    await userRef.update({
      ...data.profile,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

// Get user profile
export const getUserProfile = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view your profile.");
    }
    const userId = context.auth.uid;
    const userRef = admin.firestore().collection("userProfiles").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }
    return { profile: { id: userSnap.id, ...userSnap.data() } };
  }
);

// Delete user account
export const deleteUserAccount = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete your account.");
    }
    const userId = context.auth.uid;
    
    try {
      // Delete all user-related data
      const batch = admin.firestore().batch();
      
      // Get all user documents
      const [
        userProfileSnapshot,
        sermonsSnapshot,
        versionsSnapshot,
        scripturesSnapshot,
        tagsSnapshot,
        foldersSnapshot
      ] = await Promise.all([
        admin.firestore().collection("userProfiles").doc(userId).get(),
        admin.firestore().collection("sermons").where("userID", "==", userId).get(),
        admin.firestore().collection("userScriptureVersions").where("userId", "==", userId).get(),
        admin.firestore().collection("userScriptures").where("userId", "==", userId).get(),
        admin.firestore().collection("userTags").where("userId", "==", userId).get(),
        admin.firestore().collection("sermonFolders").where("userId", "==", userId).get()
      ]);

      // Add all documents to deletion batch
      if (userProfileSnapshot.exists) batch.delete(userProfileSnapshot.ref);
      sermonsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      versionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      scripturesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      tagsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      foldersSnapshot.docs.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      // Delete the user from Firebase Auth
      await admin.auth().deleteUser(userId);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error deleting user account:", error);
      throw new functions.https.HttpsError("internal", "Failed to delete user account.");
    }
});

// ============================================================================
// ADVANCED SERMON ORGANIZATION FEATURES
// ============================================================================

// Advanced Filtering Interface
interface AdvancedSearchCriteria {
  query?: string;
  tags?: string[];
  books?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  folderId?: string;
  seriesId?: string;
  category?: string;
  sortBy?: 'date' | 'title' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Extended Sermon Interface for cloud functions
interface SermonData {
  id: string;
  title: string;
  description: string;
  date?: FirebaseFirestore.Timestamp;
  tags?: string[];
  books?: string[];
  category?: string;
  seriesId?: string;
  folderId?: string;
  userID: string;
  [key: string]: any;
}

// Sermon Series Interface
interface SermonSeries {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  startDate?: FirebaseFirestore.Timestamp;
  endDate?: FirebaseFirestore.Timestamp;
  sermonIds: string[];
  tags?: string[];
  imageUrl?: string;
  isComplete: boolean;
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

// Category Interface
interface SermonCategory {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  keywords: string[]; // Keywords for auto-categorization
  color?: string;
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

// Auto-tag result interface
interface AutoTagResult {
  sermonId: string;
  suggestedTags: string[];
  suggestedCategory?: string;
  confidence: number;
}

// ============================================================================
// 1. SMART CATEGORIZATION AND AUTO-TAGGING
// ============================================================================

// Auto-categorize sermons based on content analysis
export const autoCategorizeSermonsFunc = functions.https.onCall(
  async (data: { sermonIds?: string[] }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to auto-categorize sermons.");
    }
    const userId = context.auth.uid;

    try {
      // Get user's categories for matching
      const categoriesSnapshot = await admin.firestore()
        .collection("sermonCategories")
        .where("userId", "==", userId)
        .get();
      
      const categories = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SermonCategory));

      // Get sermons to categorize
      let sermonsQuery = admin.firestore()
        .collection("sermons")
        .where("userID", "==", userId);
      
      if (data.sermonIds && data.sermonIds.length > 0) {
        // Limit to specific sermons
        sermonsQuery = sermonsQuery.where(admin.firestore.FieldPath.documentId(), "in", data.sermonIds);
      }

      const sermonsSnapshot = await sermonsQuery.get();
      const results: AutoTagResult[] = [];

      for (const sermonDoc of sermonsSnapshot.docs) {
        const sermon = sermonDoc.data();
        const content = `${sermon.title} ${sermon.description}`.toLowerCase();
        
        // Analyze content for category matches
        let bestCategory = '';
        let bestCategoryScore = 0;
        const suggestedTags: string[] = [];

        // Category matching
        for (const category of categories) {
          let score = 0;
          for (const keyword of category.keywords) {
            if (content.includes(keyword.toLowerCase())) {
              score += 1;
            }
          }
          
          if (score > bestCategoryScore) {
            bestCategoryScore = score;
            bestCategory = category.name;
          }
        }

        // Extract potential tags from common biblical themes
        const biblicalThemes = [
          'love', 'faith', 'hope', 'grace', 'salvation', 'forgiveness', 'prayer',
          'worship', 'discipleship', 'ministry', 'church', 'community', 'service',
          'leadership', 'teaching', 'prophecy', 'healing', 'miracles', 'parables',
          'kingdom', 'cross', 'resurrection', 'holy spirit', 'trinity', 'covenant',
          'redemption', 'sanctification', 'justification', 'evangelism', 'missions'
        ];

        for (const theme of biblicalThemes) {
          if (content.includes(theme)) {
            suggestedTags.push(theme);
          }
        }

        const confidence = Math.min((bestCategoryScore + suggestedTags.length) / 10, 1);

        results.push({
          sermonId: sermonDoc.id,
          suggestedTags: suggestedTags.slice(0, 5), // Limit to top 5 tags
          suggestedCategory: bestCategory || undefined,
          confidence
        });
      }

      return { results };
    } catch (error) {
      functions.logger.error("Error auto-categorizing sermons:", error);
      throw new functions.https.HttpsError("internal", "Failed to auto-categorize sermons.");
    }
  }
);

// Apply auto-categorization results
export const applyAutoCategorizationFunc = functions.https.onCall(
  async (data: { results: AutoTagResult[] }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to apply categorization.");
    }
    const userId = context.auth.uid;

    try {
      const batch = admin.firestore().batch();

      for (const result of data.results) {
        const sermonRef = admin.firestore().collection("sermons").doc(result.sermonId);
        
        // Verify ownership
        const sermonDoc = await sermonRef.get();
        if (!sermonDoc.exists || sermonDoc.data()?.userID !== userId) {
          continue; // Skip if not owned by user
        }

        const updateData: any = {};
        
        if (result.suggestedTags.length > 0) {
          const currentTags = sermonDoc.data()?.tags || [];
          const newTags = [...new Set([...currentTags, ...result.suggestedTags])];
          updateData.tags = newTags;
        }
        
        if (result.suggestedCategory) {
          updateData.category = result.suggestedCategory;
        }
        
        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        batch.update(sermonRef, updateData);
      }

      await batch.commit();
      return { success: true, applied: data.results.length };
    } catch (error) {
      functions.logger.error("Error applying auto-categorization:", error);
      throw new functions.https.HttpsError("internal", "Failed to apply categorization.");
    }
  }
);

// ============================================================================
// 2. ADVANCED FILTERING AND SEARCH
// ============================================================================

// Advanced sermon search with multiple criteria
export const advancedSermonSearchFunc = functions.https.onCall(
  async (data: AdvancedSearchCriteria, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to search sermons.");
    }
    const userId = context.auth.uid;

    try {
      let query = admin.firestore()
        .collection("sermons")
        .where("userID", "==", userId);

      // Apply filters
      if (data.folderId) {
        query = query.where("folderId", "==", data.folderId);
      }

      if (data.seriesId) {
        query = query.where("seriesId", "==", data.seriesId);
      }

      if (data.category) {
        query = query.where("category", "==", data.category);
      }

      if (data.dateRange) {
        const startDate = admin.firestore.Timestamp.fromDate(new Date(data.dateRange.start));
        const endDate = admin.firestore.Timestamp.fromDate(new Date(data.dateRange.end));
        query = query.where("date", ">=", startDate).where("date", "<=", endDate);
      }

      // Apply sorting
      if (data.sortBy) {
        const direction = data.sortOrder === 'desc' ? 'desc' : 'asc';
        query = query.orderBy(data.sortBy, direction);
      }

      // Apply pagination
      if (data.offset) {
        query = query.offset(data.offset);
      }
      if (data.limit) {
        query = query.limit(data.limit);
      }

      const querySnapshot = await query.get();
      let sermons: SermonData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SermonData));

      // Client-side filtering for complex criteria
      if (data.query) {
        const searchTerms = data.query.toLowerCase().split(' ');
        sermons = sermons.filter(sermon => {
          const searchableText = `${sermon.title || ''} ${sermon.description || ''}`.toLowerCase();
          return searchTerms.some(term => searchableText.includes(term));
        });
      }

      if (data.tags && data.tags.length > 0) {
        sermons = sermons.filter(sermon => {
          const sermonTags = sermon.tags || [];
          return data.tags!.some(tag => sermonTags.includes(tag));
        });
      }

      if (data.books && data.books.length > 0) {
        sermons = sermons.filter(sermon => {
          const sermonBooks = sermon.books || [];
          return data.books!.some(book => sermonBooks.includes(book));
        });
      }

      return { 
        sermons, 
        total: sermons.length,
        hasMore: sermons.length === (data.limit || 50)
      };
    } catch (error) {
      functions.logger.error("Error in advanced sermon search:", error);
      throw new functions.https.HttpsError("internal", "Failed to search sermons.");
    }
  }
);

// Get sermon analytics and insights
export const getSermonAnalyticsFunc = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view analytics.");
    }
    const userId = context.auth.uid;
    try {
      const sermonsSnapshot = await admin.firestore()
        .collection("sermons")
        .where("userID", "==", userId)
        .get();
      const sermons: SermonData[] = sermonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SermonData));
      const analytics = {
        totalSermons: sermons.length,
        sermonsByMonth: {},
        mostUsedTags: {},
        categoryDistribution: {},
        seriesCounts: {},
        averageSermonLength: 0,
        booksReferenceMost: {},
      };
      sermons.forEach(sermon => {
        if (sermon.date) {
          let sermonDateObj;
          if (sermon.date && typeof (sermon.date as any).toDate === 'function') {
            sermonDateObj = (sermon.date as any).toDate();
          } else if (typeof sermon.date === 'string' || typeof sermon.date === 'number') {
            sermonDateObj = new Date(sermon.date);
          } else {
            sermonDateObj = null;
          }
          if (sermonDateObj && !isNaN(sermonDateObj.getTime())) {
            const month = sermonDateObj.toISOString().slice(0, 7);
            (analytics.sermonsByMonth as any)[month] = ((analytics.sermonsByMonth as any)[month] || 0) + 1;
          }
        }
        if (sermon.tags) {
          sermon.tags.forEach((tag: string) => {
            (analytics.mostUsedTags as any)[tag] = ((analytics.mostUsedTags as any)[tag] || 0) + 1;
          });
        }
        if (sermon.category) {
          (analytics.categoryDistribution as any)[sermon.category] = ((analytics.categoryDistribution as any)[sermon.category] || 0) + 1;
        }
        if (sermon.seriesId) {
          (analytics.seriesCounts as any)[sermon.seriesId] = ((analytics.seriesCounts as any)[sermon.seriesId] || 0) + 1;
        }
        if (sermon.books) {
          sermon.books.forEach((book: string) => {
            (analytics.booksReferenceMost as any)[book] = ((analytics.booksReferenceMost as any)[book] || 0) + 1;
          });
        }
        if (sermon.description) {
          analytics.averageSermonLength += sermon.description.length;
        }
      });
      if (sermons.length > 0) {
        analytics.averageSermonLength = Math.round(analytics.averageSermonLength / sermons.length);
      }
      return { analytics };
    } catch (error) {
      functions.logger.error("Error getting sermon analytics:", error);
      throw new functions.https.HttpsError("internal", "Failed to get analytics.");
    }
  }
);

// ============================================================================
// 3. SERMON SERIES AND COLLECTION MANAGEMENT
// ============================================================================

// Create a new sermon series
export const createSermonSeriesFunc = functions.https.onCall(
  async (data: {
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    tags?: string[];
    imageUrl?: string;
  }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to create a series.");
    }
    const userId = context.auth.uid;

    if (!data.name?.trim()) {
      throw new functions.https.HttpsError("invalid-argument", "Series name is required.");
    }

    try {
      const seriesData: SermonSeries = {
        userId,
        name: data.name.trim(),
        description: data.description || '',
        startDate: data.startDate ? admin.firestore.Timestamp.fromDate(new Date(data.startDate)) : undefined,
        endDate: data.endDate ? admin.firestore.Timestamp.fromDate(new Date(data.endDate)) : undefined,
        sermonIds: [],
        tags: data.tags || [],
        imageUrl: data.imageUrl,
        isComplete: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await admin.firestore()
        .collection("sermonSeries")
        .add(seriesData);

      return { seriesId: docRef.id };
    } catch (error) {
      functions.logger.error("Error creating sermon series:", error);
      throw new functions.https.HttpsError("internal", "Failed to create sermon series.");
    }
});

// Get all sermon series for user
export const getSermonSeriesFunc = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to get series.");
    }
    const userId = context.auth.uid;

    try {
      const snapshot = await admin.firestore()
        .collection("sermonSeries")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();

      const series = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { series };
    } catch (error) {
      functions.logger.error("Error getting sermon series:", error);
      throw new functions.https.HttpsError("internal", "Failed to get sermon series.");
    }
});

// Add sermon to series
export const addSermonToSeriesFunc = functions.https.onCall(
  async (data: { seriesId: string; sermonId: string; }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to modify series.");
    }
    const userId = context.auth.uid;

    try {
      const seriesRef = admin.firestore().collection("sermonSeries").doc(data.seriesId);
      const seriesDoc = await seriesRef.get();
      
      if (!seriesDoc.exists || seriesDoc.data()?.userId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "Series not found or access denied.");
      }

      // Verify sermon ownership
      const sermonDoc = await admin.firestore().collection("sermons").doc(data.sermonId).get();
      if (!sermonDoc.exists || sermonDoc.data()?.userID !== userId) {
        throw new functions.https.HttpsError("permission-denied", "Sermon not found or access denied.");
      }

      const seriesData = seriesDoc.data() as SermonSeries;
      const updatedSermonIds = [...new Set([...seriesData.sermonIds, data.sermonId])];

      // Update series
      await seriesRef.update({
        sermonIds: updatedSermonIds,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update sermon with series reference
      await admin.firestore().collection("sermons").doc(data.sermonId).update({
        seriesId: data.seriesId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      functions.logger.error("Error adding sermon to series:", error);
      throw new functions.https.HttpsError("internal", "Failed to add sermon to series.");
    }
});

// Remove sermon from series
export const removeSermonFromSeriesFunc = functions.https.onCall(
  async (data: { seriesId: string; sermonId: string; }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to modify series.");
    }
    const userId = context.auth.uid;

    try {
      const seriesRef = admin.firestore().collection("sermonSeries").doc(data.seriesId);
      const seriesDoc = await seriesRef.get();
      
      if (!seriesDoc.exists || seriesDoc.data()?.userId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "Series not found or access denied.");
      }

      const seriesData = seriesDoc.data() as SermonSeries;
      const updatedSermonIds = seriesData.sermonIds.filter(id => id !== data.sermonId);

      // Update series
      await seriesRef.update({
        sermonIds: updatedSermonIds,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Remove series reference from sermon
      await admin.firestore().collection("sermons").doc(data.sermonId).update({
        seriesId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      functions.logger.error("Error removing sermon from series:", error);
      throw new functions.https.HttpsError("internal", "Failed to remove sermon from series.");
    }
});

// Delete sermon series
export const deleteSermonSeriesFunc = functions.https.onCall(
  async (data: { seriesId: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete series.");
    }
    const userId = context.auth.uid;

    try {
      const seriesRef = admin.firestore().collection("sermonSeries").doc(data.seriesId);
      const seriesDoc = await seriesRef.get();
      
      if (!seriesDoc.exists || seriesDoc.data()?.userId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "Series not found or access denied.");
      }

      const seriesData = seriesDoc.data() as SermonSeries;
      
      // Remove series reference from all sermons in the series
      const batch = admin.firestore().batch();
      for (const sermonId of seriesData.sermonIds) {
        const sermonRef = admin.firestore().collection("sermons").doc(sermonId);
        batch.update(sermonRef, {
          seriesId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      // Delete the series
      batch.delete(seriesRef);
      await batch.commit();

      return { success: true };
    } catch (error) {
      functions.logger.error("Error deleting sermon series:", error);
      throw new functions.https.HttpsError("internal", "Failed to delete sermon series.");
    }
});

// ============================================================================
// SERMON CATEGORY MANAGEMENT
// ============================================================================

// Create sermon category
export const createSermonCategoryFunc = functions.https.onCall(
  async (data: {
    name: string;
    description?: string;
    keywords: string[];
    color?: string;
  }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to create categories.");
    }
    const userId = context.auth.uid;

    if (!data.name?.trim()) {
      throw new functions.https.HttpsError("invalid-argument", "Category name is required.");
    }

    try {
      const categoryData: SermonCategory = {
        userId,
        name: data.name.trim(),
        description: data.description || '',
        keywords: data.keywords || [],
        color: data.color || '#1e293b',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await admin.firestore()
        .collection("sermonCategories")
        .add(categoryData);

      return { categoryId: docRef.id };
    } catch (error) {
      functions.logger.error("Error creating sermon category:", error);
      throw new functions.https.HttpsError("internal", "Failed to create sermon category.");
    }
});

// Get all sermon categories for user
export const getSermonCategoriesFunc = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to get categories.");
    }
    const userId = context.auth.uid;

    try {
      const snapshot = await admin.firestore()
        .collection("sermonCategories")
        .where("userId", "==", userId)
        .orderBy("name")
        .get();

      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { categories };
    } catch (error) {
      functions.logger.error("Error getting sermon categories:", error);
      throw new functions.https.HttpsError("internal", "Failed to get sermon categories.");
    }
});

// Delete sermon category
export const deleteSermonCategoryFunc = functions.https.onCall(
  async (data: { categoryId: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to delete categories.");
    }
    const userId = context.auth.uid;

    try {
      const categoryRef = admin.firestore().collection("sermonCategories").doc(data.categoryId);
      const categoryDoc = await categoryRef.get();
      
      if (!categoryDoc.exists || categoryDoc.data()?.userId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "Category not found or access denied.");
      }

      await categoryRef.delete();
      return { success: true };
    } catch (error) {
      functions.logger.error("Error deleting sermon category:", error);
      throw new functions.https.HttpsError("internal", "Failed to delete sermon category.");
    }
});

// ============================================================================
// DATA IMPORT/EXPORT FUNCTIONALITY
// ============================================================================

// Export all user data
export const exportUserData = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to export data.");
    }
    const userId = context.auth.uid;

    try {
      // Get all user documents in parallel
      const [
        userProfileSnapshot,
        sermonsSnapshot,
        versionsSnapshot,
        scripturesSnapshot,
        tagsSnapshot,
        foldersSnapshot,
        categoriesSnapshot,
        seriesSnapshot
      ] = await Promise.all([
        admin.firestore().collection("userProfiles").doc(userId).get(),
        admin.firestore().collection("sermons").where("userID", "==", userId).get(),
        admin.firestore().collection("userScriptureVersions").where("userId", "==", userId).get(),
        admin.firestore().collection("userScriptures").where("userId", "==", userId).get(),
        admin.firestore().collection("userTags").where("userId", "==", userId).get(),
        admin.firestore().collection("sermonFolders").where("userId", "==", userId).get(),
        admin.firestore().collection("sermonCategories").where("userId", "==", userId).get(),
        admin.firestore().collection("sermonSeries").where("userId", "==", userId).get()
      ]);

      // Format the data for export
      const exportData = {
        userProfile: userProfileSnapshot.exists ? { id: userProfileSnapshot.id, ...userProfileSnapshot.data() } : null,
        sermons: sermonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        userScriptureVersions: versionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        userScriptures: scripturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        userTags: tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        sermonFolders: foldersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        sermonCategories: categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        sermonSeries: seriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };

      return { exportData };
    } catch (error) {
      functions.logger.error("Error exporting user data:", error);
      throw new functions.https.HttpsError("internal", "Failed to export user data.");
    }
});

// Import user data from backup
export const importUserData = functions.https.onCall(
  async (data: {
    userProfile?: any;
    sermons?: any[];
    userScriptureVersions?: any[];
    userScriptures?: any[];
    userTags?: any[];
    sermonFolders?: any[];
    sermonCategories?: any[];
    sermonSeries?: any[];
    replaceExisting?: boolean;
  }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to import data.");
    }
    const userId = context.auth.uid;

    try {
      const batch = admin.firestore().batch();
      let operationsCount = 0;
      const maxBatchSize = 450; // Leave some buffer under Firestore's 500 limit

      // If replaceExisting is true, delete all existing data first
      if (data.replaceExisting) {
        const [
          existingSermonsSnapshot,
          existingVersionsSnapshot,
          existingScripturesSnapshot,
          existingTagsSnapshot,
          existingFoldersSnapshot,
          existingCategoriesSnapshot,
          existingSeriesSnapshot
        ] = await Promise.all([
          admin.firestore().collection("sermons").where("userID", "==", userId).get(),
          admin.firestore().collection("userScriptureVersions").where("userId", "==", userId).get(),
          admin.firestore().collection("userScriptures").where("userId", "==", userId).get(),
          admin.firestore().collection("userTags").where("userId", "==", userId).get(),
          admin.firestore().collection("sermonFolders").where("userId", "==", userId).get(),
          admin.firestore().collection("sermonCategories").where("userId", "==", userId).get(),
          admin.firestore().collection("sermonSeries").where("userId", "==", userId).get()
        ]);

        // Delete existing data
        existingSermonsSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });
        existingVersionsSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });
        existingScripturesSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });
        existingTagsSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });
        existingFoldersSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });
        existingCategoriesSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });
        existingSeriesSnapshot.docs.forEach(doc => {
          if (operationsCount < maxBatchSize) {
            batch.delete(doc.ref);
            operationsCount++;
          }
        });

        // Commit deletion batch if we have operations
        if (operationsCount > 0) {
          await batch.commit();
          // Reset for import operations
          operationsCount = 0;
        }
      }

      // Create a new batch for imports
      const importBatch = admin.firestore().batch();

      // Helper function to process import data and manage batch size
      const processBatchData = async (collection: string, items: any[], userField: string = 'userId') => {
        if (!items || items.length === 0) return;

        for (const item of items) {
          if (operationsCount >= maxBatchSize) {
            await importBatch.commit();
            operationsCount = 0;
          }

          const { id, ...itemData } = item;
          // Ensure the data belongs to the current user
          itemData[userField] = userId;
          // Update timestamps
          itemData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
          if (!itemData.createdAt) {
            itemData.createdAt = admin.firestore.FieldValue.serverTimestamp();
          }

          const docRef = admin.firestore().collection(collection).doc();
          importBatch.set(docRef, itemData);
          operationsCount++;
        }
      };

      // Import user profile
      if (data.userProfile && operationsCount < maxBatchSize) {
        const { id, ...profileData } = data.userProfile;
        profileData.userId = userId;
        profileData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        const userProfileRef = admin.firestore().collection("userProfiles").doc(userId);
        importBatch.set(userProfileRef, profileData, { merge: true });
        operationsCount++;
      }

      // Import all data collections
      await processBatchData('sermons', data.sermons || [], 'userID');
      await processBatchData('userScriptureVersions', data.userScriptureVersions || []);
      await processBatchData('userScriptures', data.userScriptures || []);
      await processBatchData('userTags', data.userTags || []);
      await processBatchData('sermonFolders', data.sermonFolders || []);
      await processBatchData('sermonCategories', data.sermonCategories || []);
      await processBatchData('sermonSeries', data.sermonSeries || []);

      // Commit final batch if there are pending operations
      if (operationsCount > 0) {
        await importBatch.commit();
      }

      return { 
        success: true, 
        imported: {
          userProfile: data.userProfile ? 1 : 0,
          sermons: data.sermons?.length || 0,
          userScriptureVersions: data.userScriptureVersions?.length || 0,
          userScriptures: data.userScriptures?.length || 0,
          userTags: data.userTags?.length || 0,
          sermonFolders: data.sermonFolders?.length || 0,
          sermonCategories: data.sermonCategories?.length || 0,
          sermonSeries: data.sermonSeries?.length || 0
        }
      };
    } catch (error) {
      functions.logger.error("Error importing user data:", error);
      throw new functions.https.HttpsError("internal", "Failed to import user data.");
    }
});
