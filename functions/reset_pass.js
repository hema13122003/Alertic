const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const resetPassword = async () => {
  try {
    const user = await admin.auth().getUserByEmail("admin@alertic.com");
    await admin.auth().updateUser(user.uid, {
      password: "Admin@123"
    });
    console.log("Successfully updated password to Admin@123");
    process.exit(0);
  } catch (error) {
    console.error("Error updating password:", error);
    process.exit(1);
  }
};

resetPassword();
