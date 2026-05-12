const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const createSuperAdmin = async (email, password) => {
  try {
    let user;
    try {
      // 1. Try to create user
      user = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: "Super Admin",
      });
      console.log("Created new user.");
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        // 2. If already exists, get user
        user = await admin.auth().getUserByEmail(email);
        console.log("User already exists, updating access...");
      } else {
        throw error;
      }
    }

    // 3. Set Custom Claims (Role: admin)
    await admin.auth().setCustomUserClaims(user.uid, { role: "admin" });

    // 4. Update/Set in Firestore
    await admin.firestore().collection("users").doc(user.uid).set({
      name: "Super Admin",
      email: email,
      role: "admin",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`Successfully assigned Super Admin role to: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error("Error creating/updating admin:", error);
    process.exit(1);
  }
};

createSuperAdmin("admin@alertic.com", "Admin@123");
