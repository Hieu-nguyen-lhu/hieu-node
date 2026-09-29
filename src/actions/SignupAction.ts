"use server";

import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User } from "@/database/entity/User.entity";
import { redirect } from "next/navigation";
import z from "zod";
import bcrypt from "bcrypt";
import mailer from "@/services/Nodemailer";
import { otpTemplate } from "@/mails/emailVerificationTemplate";
import { Profile } from "@/database/entity/Profile.entity";

enum AccountType {
  ADMIN = "Admin",
  STUDENT = "Student",
  INSTRUCTOR = "Instructor",
}

type UserInput = {
  accountType: AccountType;
  email: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  password: string;
  confirmPassword: string;
};

const SignupAction = async (formData: FormData) => {
  const userInput = {
    accountType: formData.get("accountType"),
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    contactNumber: formData.get("contactNumber"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  } as UserInput;

  if (userInput.password !== userInput.confirmPassword) return;

  await InitializeDatabase();

  const userRepo = AppDataSource.getRepository(User);
  const profileRepo = AppDataSource.getRepository(Profile);

  const existingUser = await userRepo.findOne({
    where: { email: userInput.email },
  });

  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  const hashedPassword = await bcrypt.hash(userInput.password, rounds);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[SIGNUP] Generated OTP for ${userInput.email}: ${otp}`);

  if (existingUser) {
    if (existingUser.isSignedIn) {
      redirect(`/errorPage/${encodeURIComponent("Email already registered")}`);
    }

    try {
      await mailer(
        userInput.email,
        "StudyNotion Verification Email",
        otpTemplate(otp)
      );
    } catch (error: any) {
      console.error("[SIGNUP] Mailer error:", error);
      redirect(
        `/errorPage/${encodeURIComponent(
          "Problem while sending OTP email: " + (error?.message || "Please check SMTP configuration")
        )}`
      );
    }

    existingUser.verificationOtp = otp;
    existingUser.firstName = userInput.firstName;
    existingUser.lastName = userInput.lastName;
    existingUser.contactNumber = userInput.contactNumber;
    existingUser.password = hashedPassword;
    existingUser.accountType = userInput.accountType;
    existingUser.isSignedIn = false;
    existingUser.image = `https://api.dicebear.com/5.x/initials/svg?seed=${userInput.firstName} ${userInput.lastName}`;

    try {
      await userRepo.save(existingUser);

      let profile = await profileRepo.findOne({
        where: { user: existingUser },
      });

      if (!profile) {
        profile = new Profile();
        profile.user = existingUser;
      }

      await profileRepo.save(profile);
    } catch (error) {
      console.error(error);
      redirect(
        `/errorPage/${encodeURIComponent(
          "Problem while signup! Try again later"
        )}`
      );
    }

    redirect(`/auth/otp-verification/${encodeURIComponent(userInput.email)}`);
  }

  const userSchema = z
    .object({
      accountType: z.enum(["Student", "Instructor", "Admin"]),
      firstName: z.string().trim(),
      lastName: z.string().trim(),
      email: z.string().email("Please provide a proper email"),
      contactNumber: z.string().trim().min(10),
      password: z.string().trim(),
      confirmPassword: z.string().trim(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Password and Confirm Password must be the same",
      path: ["password", "confirmPassword"],
    });

  try {
    userSchema.parse(userInput);
  } catch (error) {
    redirect(
      `/errorPage/${encodeURIComponent(
        "Wrong Inputs! Please ensure correct inputs"
      )}`
    );
  }

  try {
    await mailer(
      userInput.email,
      "StudyNotion Verification Email",
      otpTemplate(otp)
    );
  } catch (error: any) {
    console.error("[SIGNUP] Mailer error:", error);
    redirect(
      `/errorPage/${encodeURIComponent(
        "Problem while sending OTP email: " + (error?.message || "Please check SMTP configuration")
      )}`
    );
  }

  const user = new User();
  user.accountType = userInput.accountType;
  user.firstName = userInput.firstName;
  user.lastName = userInput.lastName;
  user.email = userInput.email;
  user.password = hashedPassword;
  user.contactNumber = userInput.contactNumber;
  user.verificationOtp = otp;
  user.isSignedIn = false;
  user.image = `https://api.dicebear.com/5.x/initials/svg?seed=${userInput.firstName} ${userInput.lastName}`;

  try {
    await userRepo.save(user);

    let profile = new Profile();
    profile.user = user;

    await profileRepo.save(profile);
  } catch (error) {
    console.error("Signup save error:", error);
    redirect(
      `/errorPage/${encodeURIComponent(
        "Problem while signup! Try again later"
      )}`
    );
  }

  redirect(`/auth/otp-verification/${encodeURIComponent(userInput.email)}`);
};

export default SignupAction;
