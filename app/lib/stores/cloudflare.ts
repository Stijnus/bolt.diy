import { atom } from 'nanostores';
import type { ToastOptions } from 'react-toastify'; // Assuming ToastOptions might be needed for error handling
import { logStore } from './logs'; // Assuming logStore might be needed for logging errors
import { toast } from 'react-toastify'; // Assuming toast might be needed for notifications

// Define the structure for Cloudflare connection details
export interface CloudflareUser {
  email: string; // Example user detail
  // Add other relevant user details here if needed
}

export interface CloudflareConnection {
  token: string | null;
  accountId: string | null;
  user: CloudflareUser | null;
  // We can add stats here later if needed, similar to Netlify/Vercel
}

// Initialize with stored connection or defaults
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('cloudflare_connection') : null;
const initialConnection: CloudflareConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      token: null,
      accountId: null,
      user: null,
    };

export const cloudflareConnection = atom<CloudflareConnection>(initialConnection);
export const isConnectingCloudflare = atom<boolean>(false); // Similar to isConnecting in other stores

// Function to update the connection and persist to localStorage
const updateCloudflareConnection = (updates: Partial<CloudflareConnection>) => {
  const currentState = cloudflareConnection.get();
  const newState = { ...currentState, ...updates };
  cloudflareConnection.set(newState);

  if (typeof window !== 'undefined') {
    localStorage.setItem('cloudflare_connection', JSON.stringify(newState));
  }
};

// Action to set the Cloudflare API token
export const setCloudflareToken = (token: string) => {
  updateCloudflareConnection({ token });
};

// Action to set the Cloudflare Account ID
export const setCloudflareAccountId = (accountId: string) => {
  updateCloudflareConnection({ accountId });
};

// Action to connect to Cloudflare
export const connectCloudflare = async (token: string, accountId: string, userDetails?: CloudflareUser) => {
  isConnectingCloudflare.set(true);
  try {
    // Here you would typically make an API call to verify the token and accountId,
    // and fetch user details if not provided.
    // For this example, we'll assume the token and accountId are valid.

    // Example: Simulate fetching user details if not provided
    let userToSet: CloudflareUser | null = userDetails || null;
    if (!userToSet && token) { // Assuming a token implies we can fetch user details
        // const response = await fetch('https://api.cloudflare.com/client/v4/user', {
        //   headers: {
        //     'Authorization': `Bearer ${token}`,
        //     'Content-Type': 'application/json',
        //   },
        // });
        // if (!response.ok) {
        //   throw new Error(`Failed to fetch Cloudflare user: ${response.statusText}`);
        // }
        // const userData = await response.json();
        // userToSet = { email: userData.result.email }; // Adjust based on actual API response
        
        // For now, let's mock it if userDetails are not passed
        userToSet = { email: "mockuser@example.com" };
        logStore.logInfo('Mocking Cloudflare user connection.');
    }


    updateCloudflareConnection({
      token,
      accountId,
      user: userToSet,
    });

    toast.success('Successfully connected to Cloudflare.');
    logStore.logInfo('Cloudflare connection established.');

  } catch (error) {
    console.error('Error connecting to Cloudflare:', error);
    logStore.logError('Failed to connect to Cloudflare', { error });
    toast.error(`Failed to connect to Cloudflare: ${(error as Error).message}`);
    // Clear partial data on connection failure to avoid inconsistent state
    updateCloudflareConnection({
      token: null,
      accountId: null,
      user: null,
    });
  } finally {
    isConnectingCloudflare.set(false);
  }
};

// Action to disconnect from Cloudflare
export const disconnectCloudflare = () => {
  updateCloudflareConnection({
    token: null,
    accountId: null,
    user: null,
  });
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cloudflare_connection'); // Also remove from local storage
  }
  toast.info('Disconnected from Cloudflare.');
  logStore.logInfo('Cloudflare connection terminated.');
};

// Optional: Action to initialize connection from environment variables (if applicable)
// Similar to initializeNetlifyConnection
export async function initializeCloudflareConnectionFromEnv() {
  const envToken = import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
  const envAccountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
  const currentState = cloudflareConnection.get();

  if (currentState.user || !envToken || !envAccountId) {
    return;
  }

  // console.log('Initializing Cloudflare connection from environment variables.');
  // logStore.logInfo('Initializing Cloudflare connection from environment variables.');
  // await connectCloudflare(envToken, envAccountId);
  // Commented out automatic connection from ENV for now, can be enabled if needed.
}

// Call initialization when the store is loaded, if desired
// if (typeof window !== 'undefined') {
//   initializeCloudflareConnectionFromEnv();
// }
