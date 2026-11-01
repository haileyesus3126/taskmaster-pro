
import "dotenv/config";
import mongoose from "mongoose";

import User from "../src/models/User.js";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      "Usage: node scripts/promoteAdmin.js email@example.com"
    );
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error(
      "No registered user found with that email"
    );
  }

  user.role = "ADMIN";
  await user.save();

  console.log(
    `Admin role assigned to ${user.email}`
  );
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
