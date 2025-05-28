import * as functions from 'firebase-functions';

export const openaiProxy = functions.https.onCall(async (request, context) => {
  console.log('openaiProxy function invoked');
  if (!context || !('auth' in context)) {
    console.error('Authentication error: context.auth is missing');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const { prompt, action } = request.data;
  console.log('Request data:', { prompt, action });
  if (!prompt || !action) {
    console.error('Invalid arguments: prompt or action is missing');
    throw new functions.https.HttpsError('invalid-argument', 'Prompt and action are required');
  }
  let systemPrompt = '';
  switch (action) {
    case 'summarize':
      systemPrompt = 'Summarize the following text:';
      break;
    case 'review':
      systemPrompt = 'Review the following text for clarity and correctness:';
      break;
    case 'edit':
      systemPrompt = 'Edit the following text for grammar and style:';
      break;
    default:
      console.error('Invalid action:', action);
      systemPrompt = '';
  }
  console.log('System prompt:', systemPrompt);
  // Removed OpenAI API call
  return { result: 'OpenAI functionality has been removed from this function.' };
});
