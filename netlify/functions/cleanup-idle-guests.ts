import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Config } from "@netlify/functions";

// Initialize Firebase Admin
const initAdmin = () => {
  if (getApps().length > 0) return;

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!serviceAccount.project_id) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set or invalid');
    return;
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
};

/**
 * BETTER WAY: Batch-based idle guest cleanup
 * 1. Uses batch deletions for Firestore to reduce round-trips.
 * 2. Uses auth().deleteUsers() for batch auth deletion.
 * 3. Includes a secret key check for manual API triggers.
 */
export default async (req: Request) => {
  console.log('Starting idle guest cleanup...');
  
  // Security Check for manual trigger (optional but recommended)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CLEANUP_CRON_SECRET;
  
  // If a secret is defined, require it (unless it's a scheduled call from Netlify)
  // Note: Netlify Scheduled functions don't usually send this, so we check if it's a GET/POST from outside.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.method !== 'SCHEDULE') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  initAdmin();
  
  const auth = getAuth();
  const db = getFirestore();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  let totalDeleted = 0;
  let nextToken: string | undefined = undefined;

  try {
    do {
      const listUsers = await auth.listUsers(100, nextToken);
      nextToken = listUsers.pageToken;

      const uidsToDelete: string[] = [];

      for (const userRecord of listUsers.users) {
        // 1. Filter for anonymous users (no providers linked)
        const isAnonymous = userRecord.providerData.length === 0;
        if (!isAnonymous) continue;

        // 2. Filter for users inactive for 30+ days
        const lastSignInTime = new Date(userRecord.metadata.lastSignInTime).getTime();
        const isIdle = (now - lastSignInTime) > THIRTY_DAYS_MS;
        if (!isIdle) continue;

        const uid = userRecord.uid;
        console.log(`Cleaning up idle guest: ${uid} (Last sign-in: ${userRecord.metadata.lastSignInTime})`);

        // 3. Cleanup Firestore Data
        const batch = db.batch();
        let hasOps = false;

        // A. Groups created by this guest
        const createdGroupsSnap = await db.collection('groups').where('createdBy', '==', uid).get();
        for (const groupDoc of createdGroupsSnap.docs) {
          const gid = groupDoc.id;
          
          // Delete expenses & members (Note: In production, consider a recursive delete for subcollections)
          const expensesSnap = await db.collection('groups').doc(gid).collection('expenses').get();
          expensesSnap.docs.forEach(doc => batch.delete(doc.ref));
          
          const membersSnap = await db.collection('groups').doc(gid).collection('members').get();
          membersSnap.docs.forEach(doc => batch.delete(doc.ref));
          
          batch.delete(groupDoc.ref);
          hasOps = true;
        }

        // B. Joined groups (unbind)
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          const joinedGroupIds = userData.joinedGroupIds || [];

          for (const gid of joinedGroupIds) {
            const membersSnap = await db.collection('groups').doc(gid).collection('members').where('userId', '==', uid).get();
            membersSnap.docs.forEach(doc => batch.update(doc.ref, { userId: null }));
            hasOps = true;
          }
          batch.delete(userDoc.ref);
          hasOps = true;
        }

        if (hasOps) {
          await batch.commit();
        }

        uidsToDelete.push(uid);
      }

      // 4. Batch Delete Auth Users (More efficient than one-by-one)
      if (uidsToDelete.length > 0) {
        await auth.deleteUsers(uidsToDelete);
        totalDeleted += uidsToDelete.length;
      }

    } while (nextToken);

    console.log(`Cleanup complete. Deleted ${totalDeleted} idle guests.`);
    return new Response(JSON.stringify({ success: true, deletedCount: totalDeleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  schedule: "0 4 * * *" // Daily at 4 AM
};
